# TDDAB Phase 3: Three-Level Roles (OWNER/HUMAN/AGENT)
**Date:** 2026-05-22
**Type:** Feature
**Priority:** HIGH

## Executive Summary
Add three participant roles: OWNER (room creator, human), HUMAN (logged in via HTML, sees all DMs), AGENT (CC-CLI via API key, sees only own DMs). Role derived from connection type, not self-declared. DM delivery filtered server-side.

## Design Decisions (from critic review)
1. Role derived from auth method: HTML login → HUMAN, API key → AGENT, room creator → OWNER
2. `canSeeAllDMs(role)` helper — returns true for OWNER and HUMAN
3. DM visibility filtered SERVER-side in broadcastToRoom, not client-side
4. Role assignment isolated in one function: `resolveParticipantRole()`
5. Dev-only: HTML = HUMAN, MCP = AGENT. Auth via Better Auth comes later (TODO comment)
6. API key name bound to participant name (from validateApiKey result)

---

## TDDAB-12: DB Migration + Role Assignment

### 12.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/ws/ws-roles-v2.test.ts`
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

describe("Three-Level Roles", () => {
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

  function connect(name: string, clientType?: string) {
    const ct = clientType ? '&clientType=' + clientType : '';
    const ws = new WebSocket(`${baseUrl}/ws?apiKey=${API_KEY}&name=${name}${ct}`);
    sockets.push(ws);
    return { ws, queue: createMessageQueue(ws) };
  }

  it("should assign OWNER to room creator", async () => {
    const c = connect("role2-creator", "human");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();
    c.ws.send(JSON.stringify({ type: "join_room", name: "role2-room" }));
    const joined = await c.queue.next();
    expect(joined.role).toBe("OWNER");
  });

  it("should assign HUMAN to HTML client joining existing room", async () => {
    const c = connect("role2-human", "human");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();
    c.ws.send(JSON.stringify({ type: "join_room", name: "role2-room" }));
    const joined = await c.queue.next();
    expect(joined.role).toBe("HUMAN");
  });

  it("should assign AGENT to MCP client", async () => {
    const c = connect("role2-agent", "agent");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();
    c.ws.send(JSON.stringify({ type: "join_room", name: "role2-room" }));
    const joined = await c.queue.next();
    expect(joined.role).toBe("AGENT");
  });

  it("should default to AGENT when no clientType specified", async () => {
    const c = connect("role2-default");
    await new Promise(r => { c.ws.onopen = r; });
    await c.queue.next();
    c.ws.send(JSON.stringify({ type: "join_room", name: "role2-room" }));
    const joined = await c.queue.next();
    expect(joined.role).toBe("AGENT");
  });
});
```

### 12.2 Implementation (GREEN)

**Step 1 — Add HUMAN and AGENT to pgEnum:**
Update `apps/api/src/db/schema.ts` line 5:
```typescript
export const participantRoleEnum = pgEnum("participant_role", ["OWNER", "MEMBER", "OBSERVER", "HUMAN", "AGENT"]);
```
Generate + apply migration. Apply to both live and test DB.

**Step 2 — Store clientType in ws connection:**
Update `apps/api/src/ws/index.ts` open handler — read `clientType` from URL query param, store in wsNameMap or separate map.

**Step 3 — Create resolveParticipantRole():**
Add to `apps/api/src/ws/index.ts`:
```typescript
// dev-only: role from clientType param. Replace with Better Auth when dashboard is built.
function resolveParticipantRole(clientType: string | null, isRoomCreator: boolean): string {
  if (isRoomCreator) return "OWNER";
  if (clientType === "human") return "HUMAN";
  return "AGENT";
}
```

**Step 4 — Update join_room handler:**
Replace `const role = (msg.role === "OWNER" || room.created) ? "OWNER" : "MEMBER";` with `resolveParticipantRole()`.

**Step 5 — Update chat HTML:**
Change join_room to send `clientType: "human"` instead of `role: "OWNER"`.

**Step 6 — Update MCP client-ws.ts:**
Add `clientType=agent` to WS URL query params.

### 12.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/ws/ws-roles-v2.test.ts
```

---

## TDDAB-13: DM Delivery with Role-Based Visibility

### 13.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/ws/ws-dm-roles.test.ts`
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

describe("DM Delivery with Roles", () => {
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

  function connect(name: string, clientType?: string) {
    const ct = clientType ? '&clientType=' + clientType : '';
    const ws = new WebSocket(`${baseUrl}/ws?apiKey=${API_KEY}&name=${name}${ct}`);
    sockets.push(ws);
    return { ws, queue: createMessageQueue(ws) };
  }

  it("HUMAN should see DMs between agents", async () => {
    const human = connect("dm-role-human", "human");
    const agent1 = connect("dm-role-agent1", "agent");
    const agent2 = connect("dm-role-agent2", "agent");
    await Promise.all([
      new Promise(r => { human.ws.onopen = r; }),
      new Promise(r => { agent1.ws.onopen = r; }),
      new Promise(r => { agent2.ws.onopen = r; }),
    ]);
    await human.queue.next();
    await agent1.queue.next();
    await agent2.queue.next();

    human.ws.send(JSON.stringify({ type: "join_room", name: "dm-role-room" }));
    await human.queue.next(); // OWNER

    agent1.ws.send(JSON.stringify({ type: "join_room", name: "dm-role-room" }));
    await agent1.queue.next();
    await human.queue.next(); // participant_joined

    agent2.ws.send(JSON.stringify({ type: "join_room", name: "dm-role-room" }));
    await agent2.queue.next();
    await human.queue.next(); // participant_joined
    await agent1.queue.next(); // participant_joined

    // agent1 sends DM to agent2
    agent1.ws.send(JSON.stringify({ type: "message", name: "dm-role-room", text: "secret agent msg", to: "dm-role-agent2" }));

    // agent2 receives DM
    const a2msg = await agent2.queue.next();
    expect(a2msg.text).toBe("secret agent msg");
    expect(a2msg.dm).toBe(true);

    // human receives DM (sees all)
    const hmsg = await human.queue.next();
    expect(hmsg.text).toBe("secret agent msg");
    expect(hmsg.dm).toBe(true);

    // agent1 (sender) should NOT receive own DM
    const noMsg = await Promise.race([
      agent1.queue.next(),
      new Promise(r => setTimeout(() => r("timeout"), 300)),
    ]);
    expect(noMsg).toBe("timeout");
  });

  it("AGENT should NOT see DMs between other agents", async () => {
    const agent1 = connect("dm-spy-a1", "agent");
    const agent2 = connect("dm-spy-a2", "agent");
    const agent3 = connect("dm-spy-a3", "agent");
    await Promise.all([
      new Promise(r => { agent1.ws.onopen = r; }),
      new Promise(r => { agent2.ws.onopen = r; }),
      new Promise(r => { agent3.ws.onopen = r; }),
    ]);
    await agent1.queue.next();
    await agent2.queue.next();
    await agent3.queue.next();

    agent1.ws.send(JSON.stringify({ type: "join_room", name: "dm-spy-room" }));
    await agent1.queue.next();

    agent2.ws.send(JSON.stringify({ type: "join_room", name: "dm-spy-room" }));
    await agent2.queue.next();

    agent3.ws.send(JSON.stringify({ type: "join_room", name: "dm-spy-room" }));
    await agent3.queue.next();

    // agent1 DMs agent2
    agent1.ws.send(JSON.stringify({ type: "message", name: "dm-spy-room", text: "private", to: "dm-spy-a2" }));

    // agent2 receives
    const a2msg = await agent2.queue.next();
    expect(a2msg.text).toBe("private");

    // agent3 should NOT receive
    const noMsg = await Promise.race([
      agent3.queue.next(),
      new Promise(r => setTimeout(() => r("timeout"), 300)),
    ]);
    expect(noMsg).toBe("timeout");
  });
});
```

### 13.2 Implementation (GREEN)

**Step 1 — Add canSeeAllDMs helper to room-state.ts:**
```typescript
export function canSeeAllDMs(role: string): boolean {
  return role === "OWNER" || role === "HUMAN";
}

export function getDmVisibleNames(roomId: string): string[] {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  return [...members.values()].filter(m => canSeeAllDMs(m.role)).map(m => m.name);
}
```

**Step 2 — Update DM filter in ws/index.ts message handler:**
Replace `getOwnerNames` with `getDmVisibleNames`:
```typescript
const dmVisible = getDmVisibleNames(room.id);
broadcastToRoom(room.id, payload, name, (memberName) => {
  return memberName === toName || dmVisible.includes(memberName);
});
```

### 13.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/ws/ws-dm-roles.test.ts
```

---

## TDDAB-14: Chat HTML — Pin Icon + No Role Labels

### 14.1 Tests First (RED)

**Create:** `/home/laco/claude-code-chat/apps/api/src/chat/chat-roles.test.ts`
```typescript
import { describe, it, expect, beforeAll } from "bun:test";
import { createTestApp } from "../test-utils";

describe("Chat HTML Role UI", () => {
  let baseUrl: string;

  beforeAll(async () => {
    const r = await createTestApp({ listen: true });
    baseUrl = r.url;
  });

  it("should NOT show MEMBER/OWNER labels", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).not.toContain("p.role");
  });

  it("should have pin icon element", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain("pin-icon");
  });

  it("should send clientType=human in join", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain("clientType");
  });
});
```

### 14.2 Implementation (GREEN)

**Step 1 — Update chat HTML:**
- Remove `p.role` display from participant list
- Add always-visible pin icon (📌) next to each clickable participant
- Click pin icon = toggle pinned DM mode
- Click name = one-shot DM (existing)
- Change `role: 'OWNER'` to `clientType: 'human'` in join message
- Add `clientType=human` to WS URL query params

**Step 2 — Update MCP client-ws.ts:**
- Add `&clientType=agent` to WS connection URL

### 14.3 Verification
```bash
cd /home/laco/claude-code-chat/apps/api && bun test src/chat/chat-roles.test.ts
```

---

## Success Criteria

- [ ] Room creator = OWNER
- [ ] HTML client = HUMAN (dev-only, TODO for Better Auth)
- [ ] MCP client = AGENT (default)
- [ ] HUMAN sees all DMs server-side
- [ ] AGENT sees only own DMs
- [ ] No role labels in UI
- [ ] Pin icon always visible per participant
- [ ] clientType param in WS connection
- [ ] resolveParticipantRole() isolated in one function
- [ ] All tests pass
