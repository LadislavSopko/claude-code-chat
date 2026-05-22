import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { createTestApp } from "../test-utils";

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

describe("Participant Roles", () => {
  let baseUrl: string;
  let cleanup: () => Promise<void>;
  const API_KEY = "test-key-12345";
  const sockets: WebSocket[] = [];

  beforeAll(async () => {
    const r = await createTestApp({ listen: true });
    baseUrl = r.url.replace("http", "ws");
    cleanup = r.close;
  });

  afterEach(() => {
    sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.close(); });
    sockets.length = 0;
  });

  afterAll(async () => { await cleanup(); });

  it("should assign AGENT to API key connection creating a room", async () => {
    const { ws, next } = await wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=role-agent-creator`);
    sockets.push(ws);
    const registered = await next();
    expect(registered.type).toBe("registered");

    ws.send(JSON.stringify({ type: "join_room", name: "role-test-room" }));
    const joined = await next();
    expect(joined.role).toBe("AGENT");
  });

  it("should assign AGENT to API key connection joining existing room", async () => {
    const { ws, next } = await wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=role-agent-joiner`);
    sockets.push(ws);
    await next();

    ws.send(JSON.stringify({ type: "join_room", name: "role-test-room" }));
    const joined = await next();
    expect(joined.role).toBe("AGENT");
  });

  it("should reject connection without API key or session", async () => {
    const { ws, next } = await wsConnect(`${baseUrl}/ws?name=no-auth`);
    sockets.push(ws);
    const msg = await next();
    expect(msg.type).toBe("error");
    expect(msg.message).toBe("Authentication required");
  });

  it("should include roles in list_participants response", async () => {
    const { ws, next } = await wsConnect(`${baseUrl}/ws?apiKey=${API_KEY}&name=role-lister`);
    sockets.push(ws);
    await next();

    ws.send(JSON.stringify({ type: "join_room", name: "role-test-room" }));
    await next();

    ws.send(JSON.stringify({ type: "list_participants", name: "role-test-room" }));
    const resp = await next();
    expect(resp.type).toBe("participants");
    const participants = resp.participants as Array<{ name: string; role: string }>;
    expect(participants.length).toBeGreaterThan(0);
    for (const p of participants) {
      expect(p.role).toBe("AGENT");
    }
  });
});
