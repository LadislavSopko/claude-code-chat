import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { validateApiKey } from "../auth/api-key";
import type { Logger } from "../common/logger";
import {
  initRoomState,
  registerClient,
  updateClientWs,
  unregisterClient,
  addToRoom,
  removeFromRoom,
  broadcastToRoom,
  getRoomMemberNames,
  getRoomMemberRoles,
  getDmVisibleNames,
} from "./room-state";

const wsNameMap = new WeakMap<object, string>();
const wsClientType = new WeakMap<object, string>();

// dev-only: clientType is self-declared and trivially falsifiable.
// Replace with Better Auth (human=OAuth login, agent=API key with bound name) when dashboard is built.
function resolveParticipantRole(clientType: string, isRoomCreator: boolean): string {
  if (isRoomCreator && clientType === "human") return "OWNER";
  if (clientType === "human") return "HUMAN";
  return "AGENT";
}

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

export function wsHub(db: Db, logger: Logger) {
  initRoomState(logger);
  return new Elysia()
    .ws("/ws", {
      async open(ws) {
        const url = new URL(ws.data.request.url);
        const apiKey = url.searchParams.get("apiKey") || "";
        const name = url.searchParams.get("name") || `agent-${Math.random().toString(36).slice(2, 5)}`;

        const result = await validateApiKey(db, apiKey);
        if (!result.ok) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid API key" }));
          ws.close(4001, "Invalid API key");
          return;
        }

        const clientType = url.searchParams.get("clientType") || "agent";
        wsNameMap.set(ws, name);
        wsClientType.set(ws, clientType);
        registerClient(ws, name, result.data.id);
        ws.send(JSON.stringify({ type: "registered", name }));
        logger.info({ name, clientType }, "ws client connected");
      },
      async message(ws, raw) {
        let name = wsNameMap.get(ws);
        if (!name) {
          const url = new URL(ws.data.request.url);
          name = url.searchParams.get("name") || undefined;
          if (name) {
            wsNameMap.set(ws, name);
            updateClientWs(name, ws);
          }
        }
        if (!name) return;

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
            let clientType = wsClientType.get(ws);
            if (!clientType) {
              const u = new URL(ws.data.request.url);
              clientType = u.searchParams.get("clientType") || "agent";
            }
            const role = resolveParticipantRole(clientType, room.created);
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
        const name = wsNameMap.get(ws);
        if (name) {
          unregisterClient(name);
          wsNameMap.delete(ws);
          logger.info({ name }, "ws client disconnected");
        }
      },
    });
}
