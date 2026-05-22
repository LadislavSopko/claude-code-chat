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

describe("Participant Roles", () => {
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

  it("should assign OWNER role to room creator", async () => {
    const c = connect("role-creator");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "role-test-room" }));
    const joined = await c.queue.next();
    expect(joined.role).toBe("OWNER");
  });

  it("should assign MEMBER role to subsequent joiners", async () => {
    const c = connect("role-joiner");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "role-test-room" }));
    const joined = await c.queue.next();
    expect(joined.role).toBe("MEMBER");
  });

  it("should include roles in list_participants response", async () => {
    const c = connect("role-lister");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "join_room", name: "role-test-room" }));
    await c.queue.next();

    c.ws.send(JSON.stringify({ type: "list_participants", name: "role-test-room" }));
    const resp = await c.queue.next();
    expect(resp.type).toBe("participants");
    const participants = resp.participants as Array<{ name: string; role: string }>;
    expect(participants.length).toBeGreaterThan(0);
    const creator = participants.find(p => p.name === "role-creator");
    expect(creator?.role).toBe("OWNER");
    const joiner = participants.find(p => p.name === "role-lister");
    expect(joiner?.role).toBe("MEMBER");
  });
});
