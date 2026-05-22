import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { validateApiKey } from "../auth/api-key";
import type { Logger } from "../common/logger";
import {
  registerClient,
  updateClientWs,
  unregisterClient,
  addToRoom,
  removeFromRoom,
  broadcastToRoom,
  getRoomMemberNames,
} from "./room-state";

const wsNameMap = new WeakMap<object, string>();

export function wsHub(db: Db, logger: Logger) {
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

        wsNameMap.set(ws, name);
        registerClient(ws, name, result.data.id);
        ws.send(JSON.stringify({ type: "registered", name }));
        logger.info({ name }, "ws client connected");
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
            await db.insert(schema.participants).values({ roomId: msg.roomId, name });
            addToRoom(name, msg.roomId);
            ws.send(JSON.stringify({ type: "room_joined", roomId: msg.roomId }));
            broadcastToRoom(msg.roomId, { type: "participant_joined", name, roomId: msg.roomId }, name);
            return;
          }

          if (msg.type === "leave_room") {
            await db
              .delete(schema.participants)
              .where(
                and(
                  eq(schema.participants.roomId, msg.roomId),
                  eq(schema.participants.name, name)
                )
              );
            removeFromRoom(name, msg.roomId);
            ws.send(JSON.stringify({ type: "room_left", roomId: msg.roomId }));
            broadcastToRoom(msg.roomId, { type: "participant_left", name, roomId: msg.roomId });
            return;
          }

          if (msg.type === "message") {
            const [stored] = await db
              .insert(schema.messages)
              .values({ roomId: msg.roomId, fromName: name, text: msg.text, type: "TEXT" })
              .returning();
            broadcastToRoom(
              msg.roomId,
              {
                type: "message",
                from: name,
                text: msg.text,
                roomId: msg.roomId,
                timestamp: stored.createdAt.toISOString(),
                messageId: stored.id,
              },
              name
            );
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
            const names = getRoomMemberNames(msg.roomId);
            ws.send(JSON.stringify({ type: "participants", roomId: msg.roomId, names }));
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
