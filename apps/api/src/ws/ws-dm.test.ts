import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTestApp } from "../test-utils";
import { schema } from "../db";
import { eq, and } from "drizzle-orm";
import type { Db } from "../db";

function createMessageQueue(ws: WebSocket) {
  const buffer: Record<string, unknown>[] = [];
  let waiting: ((msg: Record<string, unknown>) => void) | null = null;
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data as string);
    if (waiting) { const r = waiting; waiting = null; r(msg); }
    else { buffer.push(msg); }
  };
  return {
    next: () => buffer.length > 0
      ? Promise.resolve(buffer.shift()!)
      : new Promise<Record<string, unknown>>((r) => { waiting = r; }),
  };
}

describe("Direct Messages", () => {
  let baseUrl: string;
  let db: Db;
  let cleanup: () => Promise<void>;
  const API_KEY = "test-key-12345";
  const sockets: WebSocket[] = [];

  beforeAll(async () => {
    const r = await createTestApp({ listen: true });
    baseUrl = r.url.replace("http", "ws");
    db = r.db;
    cleanup = r.close;
    await db.delete(schema.participants);
    await db.delete(schema.messages);
    await db.delete(schema.rooms);
  });

  afterEach(() => {
    sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.close(); });
    sockets.length = 0;
  });

  afterAll(async () => { await cleanup(); });

  function connect(name: string) {
    const ws = new WebSocket(`${baseUrl}/ws?apiKey=${API_KEY}&name=${name}`);
    sockets.push(ws);
    return { ws, queue: createMessageQueue(ws) };
  }

  it("should deliver DM only to recipient (agents cannot see other DMs)", async () => {
    const alice = connect("dm-alice");
    const bob = connect("dm-bob");
    const charlie = connect("dm-charlie");
    await Promise.all([
      new Promise(r => { alice.ws.onopen = r; }),
      new Promise(r => { bob.ws.onopen = r; }),
      new Promise(r => { charlie.ws.onopen = r; }),
    ]);
    await alice.queue.next();
    await bob.queue.next();
    await charlie.queue.next();

    alice.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await alice.queue.next();

    bob.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await bob.queue.next();
    await alice.queue.next(); // participant_joined

    charlie.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await charlie.queue.next();
    await alice.queue.next(); // participant_joined
    await bob.queue.next(); // participant_joined

    // Alice sends DM to bob
    alice.ws.send(JSON.stringify({ type: "message", name: "dm-test-room", text: "secret for bob", to: "dm-bob" }));

    // Bob should receive it
    const bobMsg = await bob.queue.next();
    expect(bobMsg.type).toBe("message");
    expect(bobMsg.text).toBe("secret for bob");
    expect(bobMsg.from).toBe("dm-alice");
    expect(bobMsg.dm).toBe(true);

    // Charlie should NOT receive it (agents can't see other DMs)
    const noMsg = await Promise.race([
      charlie.queue.next(),
      new Promise(r => setTimeout(() => r("timeout"), 300)),
    ]);
    expect(noMsg).toBe("timeout");
  });

  it("should error when DM recipient not in room", async () => {
    const c = connect("dm-error-sender");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "dm-error-room" }));
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "message", name: "dm-error-room", text: "hello", to: "nobody" }));
    const resp = await c.queue.next();
    expect(resp.type).toBe("error");
  });

  it("should persist DM with to_name in DB", async () => {
    const c1 = connect("dm-persist-sender");
    const c2 = connect("dm-persist-receiver");
    await Promise.all([
      new Promise(r => { c1.ws.onopen = r; }),
      new Promise(r => { c2.ws.onopen = r; }),
    ]);
    await c1.queue.next();
    await c2.queue.next();

    c1.ws.send(JSON.stringify({ type: "join_room", name: "dm-persist-room" }));
    const j1 = await c1.queue.next();
    const roomId = j1.roomId as string;

    c2.ws.send(JSON.stringify({ type: "join_room", name: "dm-persist-room" }));
    await c2.queue.next();

    c1.ws.send(JSON.stringify({ type: "message", name: "dm-persist-room", text: "private msg", to: "dm-persist-receiver" }));
    await c2.queue.next(); // receive DM

    const [msg] = await db.select().from(schema.messages)
      .where(and(
        eq(schema.messages.roomId, roomId),
        eq(schema.messages.toName, "dm-persist-receiver")
      ));
    expect(msg).toBeDefined();
    expect(msg.text).toBe("private msg");
    expect(msg.toName).toBe("dm-persist-receiver");
  });
});
