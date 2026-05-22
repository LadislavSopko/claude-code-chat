import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTestApp } from "../test-utils";
import { schema } from "../db";
import type { Db } from "../db";

interface MsgQueue {
  next(): Promise<Record<string, unknown>>;
}

function createMessageQueue(ws: WebSocket): MsgQueue {
  const buffer: Record<string, unknown>[] = [];
  let waiting: ((msg: Record<string, unknown>) => void) | null = null;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data as string);
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(msg);
    } else {
      buffer.push(msg);
    }
  };

  return {
    next: () =>
      buffer.length > 0
        ? Promise.resolve(buffer.shift()!)
        : new Promise<Record<string, unknown>>((resolve) => {
            waiting = resolve;
          }),
  };
}

describe("WebSocket Hub", () => {
  let baseUrl: string;
  let db: Db;
  let cleanup: () => Promise<void>;
  const API_KEY = "test-key-12345";
  const openSockets: WebSocket[] = [];

  beforeAll(async () => {
    const result = await createTestApp({ listen: true });
    baseUrl = result.url.replace("http", "ws");
    db = result.db;
    cleanup = result.close;
    await db.delete(schema.participants);
    await db.delete(schema.messages);
    await db.delete(schema.rooms);
  });

  afterEach(() => {
    for (const ws of openSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    openSockets.length = 0;
  });

  afterAll(async () => {
    await db.delete(schema.participants);
    await db.delete(schema.messages);
    await db.delete(schema.rooms);
    await cleanup();
  });

  function connect(name: string): { ws: WebSocket; queue: MsgQueue } {
    const ws = new WebSocket(`${baseUrl}/ws?apiKey=${API_KEY}&name=${name}`);
    openSockets.push(ws);
    return { ws, queue: createMessageQueue(ws) };
  }

  it("should reject connection without API key", async () => {
    const ws = new WebSocket(`${baseUrl}/ws?name=hacker`);
    const msg = await new Promise<string>((resolve) => {
      ws.onmessage = (event) => {
        const parsed = JSON.parse(event.data as string);
        resolve(parsed.type);
        ws.close();
      };
      ws.onclose = () => resolve("closed");
    });
    expect(msg === "error" || msg === "closed").toBe(true);
  });

  it("should register client with name", async () => {
    const { ws, queue } = connect("reg-alice");
    await new Promise((r) => { ws.onopen = r; });
    const msg = await queue.next();
    expect(msg.type).toBe("registered");
    expect(msg.name).toBe("reg-alice");
  });

  it("should create and join a room", async () => {
    const { ws, queue } = connect("cj-bob");
    await new Promise((r) => { ws.onopen = r; });
    await queue.next();

    ws.send(JSON.stringify({ type: "create_room", name: "cj-dev-room" }));
    const created = await queue.next();
    expect(created.type).toBe("room_created");
    expect(created.roomId).toBeDefined();

    ws.send(JSON.stringify({ type: "join_room", roomId: created.roomId }));
    const joined = await queue.next();
    expect(joined.type).toBe("room_joined");
  });

  it("should broadcast message to room members only", async () => {
    const c1 = connect("bc-charlie");
    const c2 = connect("bc-dave");
    const c3 = connect("bc-eve");
    await Promise.all([
      new Promise((r) => { c1.ws.onopen = r; }),
      new Promise((r) => { c2.ws.onopen = r; }),
      new Promise((r) => { c3.ws.onopen = r; }),
    ]);
    await c1.queue.next();
    await c2.queue.next();
    await c3.queue.next();

    c1.ws.send(JSON.stringify({ type: "create_room", name: "bc-broadcast-room" }));
    const created = await c1.queue.next();
    const roomId = created.roomId as string;

    c1.ws.send(JSON.stringify({ type: "join_room", roomId }));
    await c1.queue.next(); // room_joined
    c2.ws.send(JSON.stringify({ type: "join_room", roomId }));
    await c2.queue.next(); // room_joined
    await c1.queue.next(); // drain participant_joined for c2

    c1.ws.send(JSON.stringify({ type: "message", roomId, text: "hello room" }));
    const received = await c2.queue.next();
    expect(received.type).toBe("message");
    expect(received.from).toBe("bc-charlie");
    expect(received.text).toBe("hello room");
    expect(received.timestamp).toBeDefined();

    const noMsg = await Promise.race([
      c3.queue.next(),
      new Promise((r) => setTimeout(() => r("timeout"), 300)),
    ]);
    expect(noMsg).toBe("timeout");
  });

  it("should include sender identity in messages", async () => {
    const c1 = connect("id-frank");
    const c2 = connect("id-grace");
    await Promise.all([
      new Promise((r) => { c1.ws.onopen = r; }),
      new Promise((r) => { c2.ws.onopen = r; }),
    ]);
    await c1.queue.next();
    await c2.queue.next();

    c1.ws.send(JSON.stringify({ type: "create_room", name: "id-identity-room" }));
    const created = await c1.queue.next();
    const roomId = created.roomId as string;

    c1.ws.send(JSON.stringify({ type: "join_room", roomId }));
    await c1.queue.next();
    c2.ws.send(JSON.stringify({ type: "join_room", roomId }));
    await c2.queue.next();
    await c1.queue.next(); // drain participant_joined notification

    c2.ws.send(JSON.stringify({ type: "message", roomId, text: "I am grace" }));
    const received = await c1.queue.next();
    expect(received.from).toBe("id-grace");
  });
});
