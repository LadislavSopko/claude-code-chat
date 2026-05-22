import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createTestApp } from "../test-utils";
import type { Db } from "../db";
import { schema } from "../db";

describe("Room CRUD API", () => {
  let api: ReturnType<typeof treaty>;
  let db: Db;
  let baseUrl: string;
  const API_KEY = "test-key-12345";

  beforeAll(async () => {
    const result = await createTestApp({ listen: true });
    api = treaty(result.app);
    db = result.db;
    baseUrl = result.url;
  });

  beforeEach(async () => {
    await db.delete(schema.participants);
    await db.delete(schema.messages);
    await db.delete(schema.rooms);
  });

  it("POST /api/chat/rooms should create a room", async () => {
    const res = await api.api.chat.rooms.post(
      { name: "test-room" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.name).toBe("test-room");
    expect(res.data.id).toBeDefined();
    expect(res.data.status).toBe("ACTIVE");
  });

  it("GET /api/chat/rooms should list rooms", async () => {
    await api.api.chat.rooms.post(
      { name: "list-room" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    const res = await api.api.chat.rooms.get({
      headers: { authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBe(1);
  });

  it("POST /api/chat/rooms/:id/join should add participant", async () => {
    const room = await api.api.chat.rooms.post(
      { name: "join-test-room" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    const res = await api.api.chat.rooms[room.data.id].join.post(
      { name: "alice" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    expect(res.status).toBe(200);
    expect(res.data.name).toBe("alice");
    expect(res.data.role).toBe("MEMBER");
  });

  it("POST /api/chat/rooms/:id/leave should remove participant", async () => {
    const room = await api.api.chat.rooms.post(
      { name: "leave-test-room" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    await api.api.chat.rooms[room.data.id].join.post(
      { name: "bob" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    const res = await api.api.chat.rooms[room.data.id].leave.post(
      { name: "bob" },
      { headers: { authorization: `Bearer ${API_KEY}` } }
    );
    expect(res.status).toBe(200);
  });

  it("should reject requests without API key", async () => {
    const res = await fetch(`${baseUrl}/api/chat/rooms`);
    expect(res.status).toBe(401);
  });
});
