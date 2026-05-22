import { describe, it, expect, beforeAll } from "bun:test";
import { createDb } from "../db";
import { schema } from "../db";
import { eq, asc } from "drizzle-orm";

const TEST_DB_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL!.replace(/\/[^/]+$/, "/claude_chat_test");

describe("Message Persistence + Ordering", () => {
  let db: ReturnType<typeof createDb>;
  let roomId: string;

  beforeAll(async () => {
    db = createDb(TEST_DB_URL);

    const [room] = await db
      .insert(schema.rooms)
      .values({ name: `history-test-${Date.now()}` })
      .returning();
    roomId = room.id;

    const baseTime = new Date("2026-01-01T12:00:00Z");
    await db.insert(schema.messages).values([
      {
        roomId,
        fromName: "alice",
        text: "first message",
        type: "TEXT",
        createdAt: new Date(baseTime.getTime()),
      },
      {
        roomId,
        fromName: "bob",
        text: "second message",
        type: "TEXT",
        createdAt: new Date(baseTime.getTime() + 1000),
      },
      {
        roomId,
        fromName: "alice",
        text: "third message",
        type: "TEXT",
        createdAt: new Date(baseTime.getTime() + 2000),
      },
    ]);
  });

  it("should persist messages with correct fields", async () => {
    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.roomId, roomId));
    expect(msgs.length).toBe(3);
    expect(msgs[0].fromName).toBeDefined();
    expect(msgs[0].text).toBeDefined();
    expect(msgs[0].createdAt).toBeInstanceOf(Date);
  });

  it("should return messages ordered by timestamp ascending", async () => {
    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.roomId, roomId))
      .orderBy(asc(schema.messages.createdAt));
    expect(msgs[0].text).toBe("first message");
    expect(msgs[1].text).toBe("second message");
    expect(msgs[2].text).toBe("third message");
  });

  it("should include sender identity in stored messages", async () => {
    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.roomId, roomId))
      .orderBy(asc(schema.messages.createdAt));
    const senders = msgs.map((m) => m.fromName);
    expect(senders).toEqual(["alice", "bob", "alice"]);
  });
});
