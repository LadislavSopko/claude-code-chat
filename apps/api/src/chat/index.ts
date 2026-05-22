import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";

export function chatRoutes(db: Db) {
  return new Elysia({ prefix: "/api/chat" })
    .get("/rooms", async () => {
      return db.select().from(schema.rooms);
    }, {
      detail: {
        summary: "List all rooms",
        tags: ["Chat"],
      },
    })
    .get("/rooms/:id", async ({ params, set }) => {
      const [room] = await db
        .select()
        .from(schema.rooms)
        .where(eq(schema.rooms.id, params.id));
      if (!room) {
        set.status = 404;
        return { code: "NOT_FOUND", message: "Room not found" };
      }
      return room;
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: {
        summary: "Get room by ID",
        tags: ["Chat"],
      },
    })
    .get("/rooms/:id/messages", async ({ params }) => {
      return db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.roomId, params.id));
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: {
        summary: "Get messages for a room",
        tags: ["Chat"],
      },
    });
}
