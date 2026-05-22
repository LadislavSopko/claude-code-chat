import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTestApp } from "../test-utils";
import { schema } from "../db";
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

describe("Join Room by Name", () => {
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

  it("should create room and join by name in one step", async () => {
    const c = connect("name-test-alice");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "dev-team" }));
    const joined = await c.queue.next();
    expect(joined.type).toBe("room_joined");
    expect(joined.roomId).toBeDefined();
    expect(joined.roomName).toBe("dev-team");
  });

  it("should join existing room by name", async () => {
    const c1 = connect("name-test-bob");
    const c2 = connect("name-test-charlie");
    await Promise.all([
      new Promise(r => { c1.ws.onopen = r; }),
      new Promise(r => { c2.ws.onopen = r; }),
    ]);
    await c1.queue.next();
    await c2.queue.next();

    c1.ws.send(JSON.stringify({ type: "join_room", name: "shared-room" }));
    const j1 = await c1.queue.next();
    expect(j1.type).toBe("room_joined");

    c2.ws.send(JSON.stringify({ type: "join_room", name: "shared-room" }));
    const j2 = await c2.queue.next();
    expect(j2.type).toBe("room_joined");
    expect(j2.roomId).toBe(j1.roomId);
  });

  it("should still support join by roomId", async () => {
    const c = connect("name-test-dave");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "id-fallback-room" }));
    const j1 = await c.queue.next();
    const roomId = j1.roomId as string;

    const c2 = connect("name-test-eve");
    await new Promise(r => { c2.ws.onopen = r; });
    await c2.queue.next();

    c2.ws.send(JSON.stringify({ type: "join_room", roomId }));
    const j2 = await c2.queue.next();
    expect(j2.roomId).toBe(roomId);
  });
});
