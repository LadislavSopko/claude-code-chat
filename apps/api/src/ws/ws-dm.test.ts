import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTestApp } from "../test-utils";
import { schema } from "../db";
import { eq, and } from "drizzle-orm";
import type { Db } from "../db";

function wsConnect(url: string): Promise<{ ws: WebSocket; next: () => Promise<Record<string, unknown>> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const buffer: Record<string, unknown>[] = [];
    let waiting: ((msg: Record<string, unknown>) => void) | null = null;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      if (waiting) { const r = waiting; waiting = null; r(msg); }
      else { buffer.push(msg); }
    };
    ws.onopen = () => resolve({
      ws,
      next: () => buffer.length > 0
        ? Promise.resolve(buffer.shift()!)
        : new Promise<Record<string, unknown>>((r) => { waiting = r; }),
    });
    ws.onerror = () => reject(new Error("WS connection failed"));
  });
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

  it("should deliver DM only to recipient (agents cannot see other DMs)", async () => {
    const [alice, bob, charlie] = await Promise.all([
      wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=dm-alice`),
      wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=dm-bob`),
      wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=dm-charlie`),
    ]);
    sockets.push(alice.ws, bob.ws, charlie.ws);
    await alice.next();
    await bob.next();
    await charlie.next();

    alice.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await alice.next();

    bob.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await bob.next();
    await alice.next();

    charlie.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await charlie.next();
    await alice.next();
    await bob.next();

    alice.ws.send(JSON.stringify({ type: "message", name: "dm-test-room", text: "secret for bob", to: "dm-bob" }));

    const bobMsg = await bob.next();
    expect(bobMsg.type).toBe("message");
    expect(bobMsg.text).toBe("secret for bob");
    expect(bobMsg.from).toBe("dm-alice");
    expect(bobMsg.dm).toBe(true);

    const noMsg = await Promise.race([
      charlie.next(),
      new Promise(r => setTimeout(() => r("timeout"), 300)),
    ]);
    expect(noMsg).toBe("timeout");
  });

  it("should error when DM recipient not in room", async () => {
    const c = await wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=dm-error-sender`);
    sockets.push(c.ws);
    await c.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "dm-error-room" }));
    await c.next();

    c.ws.send(JSON.stringify({ type: "message", name: "dm-error-room", text: "hello", to: "nobody" }));
    const resp = await c.next();
    expect(resp.type).toBe("error");
  });

  it("should persist DM with to_name in DB", async () => {
    const [c1, c2] = await Promise.all([
      wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=dm-persist-sender`),
      wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=dm-persist-receiver`),
    ]);
    sockets.push(c1.ws, c2.ws);
    await c1.next();
    await c2.next();

    c1.ws.send(JSON.stringify({ type: "join_room", name: "dm-persist-room" }));
    const j1 = await c1.next();
    const roomId = j1.roomId as string;

    c2.ws.send(JSON.stringify({ type: "join_room", name: "dm-persist-room" }));
    await c2.next();

    c1.ws.send(JSON.stringify({ type: "message", name: "dm-persist-room", text: "private msg", to: "dm-persist-receiver" }));
    await c2.next();

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
