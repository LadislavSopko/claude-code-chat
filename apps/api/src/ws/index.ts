import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { validateApiKey } from "../auth/api-key";
import type { Auth } from "../auth";
import type { Config } from "../common/config";
import type { Logger } from "../common/logger";
import { AuthType } from "@claude-code-chat/core";
import { RateLimiter } from "../common/rate-limiter";
import {
  initRoomState,
  registerClient,
  getClientEntry,
  updateClientWs,
  unregisterClient,
  addToRoom,
  removeFromRoom,
  broadcastToRoom,
  getRoomMemberNames,
  getRoomMemberRoles,
  getDmVisibleNames,
} from "./room-state";

interface WsAuthContext {
  readonly name: string;
  readonly authType: AuthType;
  readonly userId?: string;
  readonly apiKeyId?: string;
}

const wsAuthMap = new WeakMap<object, WsAuthContext>();

async function resolveRoom(db: Db, msg: Record<string, unknown>): Promise<{ id: string; name: string; created: boolean } | null> {
  if (msg.roomId) {
    const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, msg.roomId as string));
    return room ? { id: room.id, name: room.name, created: false } : null;
  }
  if (msg.name) {
    const roomName = msg.name as string;
    const [existing] = await db.select().from(schema.rooms).where(eq(schema.rooms.name, roomName));
    if (existing) return { id: existing.id, name: existing.name, created: false };
    const [created] = await db.insert(schema.rooms).values({ name: roomName }).returning();
    return { id: created.id, name: created.name, created: true };
  }
  return null;
}

function resolveRole(authType: AuthType, isRoomCreator: boolean): string {
  if (authType === AuthType.ApiKey) return "AGENT";
  return isRoomCreator ? "OWNER" : "HUMAN";
}

export function wsHub(db: Db, logger: Logger, auth: Auth, config: Config) {
  initRoomState(logger);
  const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const connectLimiter = new RateLimiter(60_000, config.WS_CONNECT_RATE_LIMIT_PER_MINUTE);
  const messageLimiter = new RateLimiter(60_000, config.WS_MESSAGE_RATE_LIMIT_PER_MINUTE);

  return new Elysia()
    .ws("/ws", {
      async open(ws) {
        const ip = ws.data.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        if (!connectLimiter.check(ip)) {
          ws.send(JSON.stringify({ type: "error", message: "Too many connections" }));
          ws.close(4029, "Rate limited");
          return;
        }

        const url = new URL(ws.data.request.url);
        const apiKey = url.searchParams.get("apiKey") || "";
        const name = url.searchParams.get("name") || `anon-${Math.random().toString(36).slice(2, 5)}`;

        if (apiKey) {
          const result = await validateApiKey(db, apiKey);
          if (!result.ok) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid API key" }));
            ws.close(4001, "Invalid API key");
            return;
          }

          const authCtx: WsAuthContext = { name, authType: AuthType.ApiKey, apiKeyId: result.data.id };
          wsAuthMap.set(ws, authCtx);
          registerClient(ws, name, result.data.id, AuthType.ApiKey);
          ws.send(JSON.stringify({ type: "registered", name }));
          logger.info({ name, authType: AuthType.ApiKey }, "ws client connected");
          return;
        }

        const origin = ws.data.request.headers.get("origin") || "";
        if (config.NODE_ENV === "production" && origin && !allowedOrigins.includes(origin)) {
          ws.send(JSON.stringify({ type: "error", message: "Forbidden origin" }));
          ws.close(4003, "Forbidden origin");
          return;
        }

        const headers = ws.data.request.headers;
        const session = await auth.api.getSession({ headers });
        if (!session?.user) {
          ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
          ws.close(4001, "Authentication required");
          return;
        }

        const authCtx: WsAuthContext = { name, authType: AuthType.Session, userId: session.user.id };
        wsAuthMap.set(ws, authCtx);
        registerClient(ws, name, session.user.id, AuthType.Session);
        ws.send(JSON.stringify({ type: "registered", name }));
        logger.info({ name, authType: AuthType.Session, userId: session.user.id }, "ws client connected");
      },
      async message(ws, raw) {
        let authCtx = wsAuthMap.get(ws);
        if (!authCtx) {
          const url = new URL(ws.data.request.url);
          const name = url.searchParams.get("name") || undefined;
          if (name) {
            updateClientWs(name, ws);
            const entry = getClientEntry(name);
            if (entry) {
              authCtx = { name, authType: entry.authType as AuthType, apiKeyId: entry.authId };
              wsAuthMap.set(ws, authCtx);
            }
          }
          if (!authCtx) return;
        }
        const name = authCtx.name;

        if (!messageLimiter.check(name)) {
          ws.send(JSON.stringify({ type: "error", message: "Rate limited" }));
          return;
        }

        try {
          const msg = typeof raw === "string" ? JSON.parse(raw) : raw as Record<string, unknown>;

          if (msg.type === "create_room") {
            try {
              const [room] = await db
                .insert(schema.rooms)
                .values({ name: msg.name })
                .returning();
              ws.send(JSON.stringify({ type: "room_created", roomId: room.id, name: room.name }));
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              logger.error({ err: errMsg }, "create_room failed");
              ws.send(JSON.stringify({ type: "error", message: errMsg }));
            }
            return;
          }

          if (msg.type === "join_room") {
            const room = await resolveRoom(db, msg);
            if (!room) {
              ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
              return;
            }
            const role = resolveRole(authCtx.authType, room.created);
            await db.insert(schema.participants).values({ roomId: room.id, name, role: role as "OWNER" | "HUMAN" | "AGENT" });
            addToRoom(name, room.id, role);
            ws.send(JSON.stringify({ type: "room_joined", roomId: room.id, roomName: room.name, role }));
            broadcastToRoom(room.id, { type: "participant_joined", name, roomId: room.id }, name);
            return;
          }

          if (msg.type === "leave_room") {
            const room = await resolveRoom(db, msg);
            if (!room) return;
            await db
              .delete(schema.participants)
              .where(
                and(
                  eq(schema.participants.roomId, room.id),
                  eq(schema.participants.name, name)
                )
              );
            removeFromRoom(name, room.id);
            ws.send(JSON.stringify({ type: "room_left", roomId: room.id }));
            broadcastToRoom(room.id, { type: "participant_left", name, roomId: room.id });
            return;
          }

          if (msg.type === "message") {
            const room = await resolveRoom(db, msg);
            if (!room) {
              ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
              return;
            }
            const toName = (msg.to as string) || null;
            const [stored] = await db
              .insert(schema.messages)
              .values({ roomId: room.id, fromName: name, toName, text: msg.text as string, type: "TEXT" })
              .returning();

            const payload = {
              type: "message",
              from: name,
              text: msg.text,
              roomId: room.id,
              timestamp: stored.createdAt.toISOString(),
              messageId: stored.id,
              ...(toName ? { dm: true, to: toName } : {}),
            };

            if (toName) {
              const members = getRoomMemberNames(room.id);
              if (!members.includes(toName)) {
                ws.send(JSON.stringify({ type: "error", message: `${toName} is not in the room` }));
                return;
              }
              const dmVisible = getDmVisibleNames(room.id);
              broadcastToRoom(room.id, payload, name, (memberName) => {
                return memberName === toName || dmVisible.includes(memberName);
              });
            } else {
              broadcastToRoom(room.id, payload, name);
            }
            return;
          }

          if (msg.type === "list_rooms") {
            const rooms = await db
              .select()
              .from(schema.rooms)
              .where(eq(schema.rooms.status, "ACTIVE"));
            ws.send(JSON.stringify({ type: "rooms", rooms }));
            return;
          }

          if (msg.type === "list_participants") {
            const room = await resolveRoom(db, msg);
            if (!room) {
              ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
              return;
            }
            const participants = getRoomMemberRoles(room.id);
            ws.send(JSON.stringify({ type: "participants", roomId: room.id, participants }));
            return;
          }
        } catch (err) {
          logger.error({ err, name }, "ws message handler error");
          ws.send(JSON.stringify({ type: "error", message: "Internal error" }));
        }
      },
      close(ws) {
        const authCtx = wsAuthMap.get(ws);
        if (authCtx) {
          unregisterClient(authCtx.name);
          wsAuthMap.delete(ws);
          logger.info({ name: authCtx.name }, "ws client disconnected");
        }
      },
    });
}
