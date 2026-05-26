import { Elysia, t } from "elysia";
import { eq, and, asc } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { checkApiKey } from "../auth/api-key-guard";

export function chatRoutes(db: Db, devMode = false) {
  return new Elysia({ prefix: "/api/chat" })
    .onBeforeHandle(async ({ request, set }) => {
      return checkApiKey(db, request, set, devMode);
    })
    .get("/rooms", async () => {
      return db.select().from(schema.rooms).where(eq(schema.rooms.status, "ACTIVE"));
    }, {
      detail: { summary: "List active rooms", tags: ["Chat"] },
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
      detail: { summary: "Get room by ID", tags: ["Chat"] },
    })
    .post("/rooms", async ({ body }) => {
      const [room] = await db
        .insert(schema.rooms)
        .values({ name: body.name })
        .returning();
      return room;
    }, {
      body: t.Object({ name: t.String({ minLength: 1 }) }),
      detail: { summary: "Create a room", tags: ["Chat"] },
    })
    .post("/rooms/:id/join", async ({ params, body }) => {
      const [participant] = await db
        .insert(schema.participants)
        .values({ roomId: params.id, name: body.name })
        .returning();
      return participant;
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({ name: t.String({ minLength: 1 }) }),
      detail: { summary: "Join a room", tags: ["Chat"] },
    })
    .post("/rooms/:id/leave", async ({ params, body, set }) => {
      const deleted = await db
        .delete(schema.participants)
        .where(
          and(
            eq(schema.participants.roomId, params.id),
            eq(schema.participants.name, body.name)
          )
        )
        .returning();
      if (deleted.length === 0) {
        set.status = 404;
        return { code: "NOT_FOUND", message: "Participant not found" };
      }
      return { ok: true };
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({ name: t.String({ minLength: 1 }) }),
      detail: { summary: "Leave a room", tags: ["Chat"] },
    })
    .get("/rooms/:id/messages", async ({ params }) => {
      return db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.roomId, params.id))
        .orderBy(asc(schema.messages.createdAt));
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { summary: "Get messages for a room (ordered)", tags: ["Chat"] },
    });
}
