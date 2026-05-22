# TDDAB Phase 2: Hub Features
**Date:** 2026-05-22
**Type:** Feature batch
**Priority:** HIGH

## Executive Summary
Add room join-by-name, participant roles, direct messages, MCP reconnection, and chat HTML improvements. 5 atomic blocks.

---

## TDDAB-7: Join Room by Name

### 7.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/ws/ws-name.test.ts`
```typescript
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
    await c.queue.next(); // registered

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
```

### 7.2 Implementation (GREEN)

Update `/home/laco/claude-code-chat/apps/api/src/ws/index.ts` — `join_room` handler:
- If `msg.name` provided (no `msg.roomId`): look up room by name, create if not exists, then join
- If `msg.roomId` provided: join by ID as before
- Response includes `roomName` field

Update MCP `client-tools.ts`:
- `join_room` input schema adds optional `name` parameter
- If `name` provided, sends `{ type: "join_room", name }` instead of `{ type: "join_room", roomId }`

Remove `create_room` from required workflow — `join_room` with name auto-creates.

### 7.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/ws/ws-name.test.ts
```

---

## TDDAB-8: Participant Roles (OWNER/MEMBER)

### 8.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/ws/ws-roles.test.ts`
```typescript
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
    expect(participants[0].role).toBeDefined();
  });
});
```

### 8.2 Implementation (GREEN)

Update WS `join_room` handler:
- First joiner (creates room) gets `OWNER` role in DB
- Subsequent joiners get `MEMBER`
- Response includes `role` field

Update `list_participants`:
- Accept `name` (room name) in addition to `roomId`
- Return `[{ name, role }]` instead of `[name]`
- Query from DB for roles, merge with in-memory online state

### 8.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/ws/ws-roles.test.ts
```

---

## TDDAB-9: Direct Messages

### 9.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/ws/ws-dm.test.ts`
```typescript
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

  it("should deliver DM only to recipient + owner", async () => {
    const owner = connect("dm-owner");
    const alice = connect("dm-alice");
    const bob = connect("dm-bob");
    await Promise.all([
      new Promise(r => { owner.ws.onopen = r; }),
      new Promise(r => { alice.ws.onopen = r; }),
      new Promise(r => { bob.ws.onopen = r; }),
    ]);
    await owner.queue.next();
    await alice.queue.next();
    await bob.queue.next();

    // Owner creates room (gets OWNER role)
    owner.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await owner.queue.next();

    alice.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await alice.queue.next();
    await owner.queue.next(); // participant_joined

    bob.ws.send(JSON.stringify({ type: "join_room", name: "dm-test-room" }));
    await bob.queue.next();
    await owner.queue.next(); // participant_joined
    await alice.queue.next(); // participant_joined

    // Alice sends DM to bob
    alice.ws.send(JSON.stringify({ type: "message", name: "dm-test-room", text: "secret for bob", to: "dm-bob" }));

    // Bob should receive it
    const bobMsg = await bob.queue.next();
    expect(bobMsg.type).toBe("message");
    expect(bobMsg.text).toBe("secret for bob");
    expect(bobMsg.from).toBe("dm-alice");
    expect(bobMsg.dm).toBe(true);

    // Owner should receive it (sees all)
    const ownerMsg = await owner.queue.next();
    expect(ownerMsg.text).toBe("secret for bob");
    expect(ownerMsg.dm).toBe(true);

    // Alice should NOT get echo in this timeout
    const noEcho = await Promise.race([
      alice.queue.next(),
      new Promise(r => setTimeout(() => r("timeout"), 300)),
    ]);
    // Alice gets echo confirmation
    if (noEcho !== "timeout") {
      expect((noEcho as Record<string, unknown>).from).toBe("dm-alice");
    }
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

    // Check DB
    const { eq, and } = await import("drizzle-orm");
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
```

### 9.2 Implementation (GREEN)

Update WS `message` handler in `/home/laco/claude-code-chat/apps/api/src/ws/index.ts`:
- If `msg.to` present: deliver only to that name + all OWNERs in room
- If `msg.to` absent: broadcast as before
- If `msg.to` not found in room: send error to sender
- Persist with `toName` field
- Add `dm: true` flag to DM payloads

Update room-state.ts:
- `getRoomMemberRole(roomId, name)` — returns role from DB
- `getOwners(roomId)` — returns list of OWNER names

Update `message` handler to accept room by `name` (not just `roomId`), consistent with TDDAB-7.

Update MCP `send_message` tool: add optional `to` parameter.

Update chat HTML: DM messages styled differently (purple border, "[DM]" prefix).

### 9.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/ws/ws-dm.test.ts
```

---

## TDDAB-10: MCP Client Reconnection

### 10.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/src/client-reconnect.test.ts`
```typescript
import { describe, it, expect } from "bun:test";

describe("MCP Client Reconnection", () => {
  it("should have reconnect logic with backoff", async () => {
    const { connectWithRetry } = await import("./client-ws");
    expect(connectWithRetry).toBeDefined();
    expect(typeof connectWithRetry).toBe("function");
  });

  it("should calculate exponential backoff", async () => {
    const { getBackoffMs } = await import("./client-ws");
    expect(getBackoffMs(0)).toBe(1000);
    expect(getBackoffMs(1)).toBe(2000);
    expect(getBackoffMs(2)).toBe(4000);
    expect(getBackoffMs(5)).toBeLessThanOrEqual(30000);
  });
});
```

### 10.2 Implementation (GREEN)

**Create:** `/home/laco/claude-code-chat/src/client-ws.ts`
```typescript
import { appendFileSync } from "fs";

const LOG_FILE = process.env.CLAUDE_CHAT_LOG || "/tmp/claude-chat-mcp.log";

function log(level: string, msg: string): void {
  try { appendFileSync(LOG_FILE, `${new Date().toISOString()} [${level}] ${msg}\n`); } catch {}
}

export function getBackoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export function connectWithRetry(
  url: string,
  onOpen: (ws: WebSocket) => void,
  onMessage: (ws: WebSocket, event: MessageEvent) => void,
  onConnected: (ws: WebSocket) => void,
): void {
  let attempt = 0;

  function tryConnect() {
    log("info", `connecting to ${url} (attempt ${attempt})`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      log("info", "connected");
      onOpen(ws);
      onConnected(ws);
    };

    ws.onmessage = (event) => onMessage(ws, event);

    ws.onerror = () => {
      log("error", "WebSocket error");
    };

    ws.onclose = () => {
      const delay = getBackoffMs(attempt);
      log("warn", `disconnected, reconnecting in ${delay}ms`);
      attempt++;
      setTimeout(tryConnect, delay);
    };
  }

  tryConnect();
}
```

Update `client.ts` to use `connectWithRetry` instead of raw `new WebSocket`.

### 10.3 Verification
```bash
cd /home/laco/claude-code-chat && bun test src/client-reconnect.test.ts
```

---

## TDDAB-11: Chat HTML Improvements

### 11.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/chat/chat-improved.test.ts`
```typescript
import { describe, it, expect, beforeAll } from "bun:test";
import { createTestApp } from "../test-utils";

describe("Chat HTML Improvements", () => {
  let baseUrl: string;

  beforeAll(async () => {
    const r = await createTestApp({ listen: true });
    baseUrl = r.url;
  });

  it("should have participants sidebar", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain('id="participants"');
  });

  it("should have room name display", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain('room-tag');
  });

  it("should have DM styling", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain('.msg.dm');
  });

  it("should support join by room name", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain('new-room-name');
    expect(html).toContain('room-select');
  });
});
```

### 11.2 Implementation (GREEN)

Update `/home/laco/claude-code-chat/apps/api/src/chat/chat.html`:
- Participants sidebar (right side, shows online members with roles)
- Poll `list_participants` every 10s to refresh
- DM styling: purple left border, "[DM to X]" prefix
- Join by name: select dropdown already done, wire to `join_room { name }`
- Send message uses room name: `{ type: "message", name: roomName, text }`

### 11.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/chat/chat-improved.test.ts
```

---

## Success Criteria

After all 5 TDDABs:
- [ ] Join room by name (auto-create if not exists)
- [ ] OWNER/MEMBER roles assigned correctly
- [ ] DMs delivered only to recipient + owners
- [ ] DMs persisted with to_name
- [ ] MCP client reconnects automatically with backoff
- [ ] Chat HTML shows participants, DM styling, room names
- [ ] All tests pass
