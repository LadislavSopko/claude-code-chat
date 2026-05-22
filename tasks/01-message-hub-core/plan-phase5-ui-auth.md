# TDDAB Phase 5: User API Keys + Admin Whitelist + Login Gate
**Date:** 2026-05-22
**Type:** Feature
**Branch:** feature/01-message-hub-core

## Current State
- Backend: BetterAuth with Google OAuth working (tested in browser)
- `/api/admin/*` routes exist but ALL are admin-only (wrong: API keys should be per-user)
- `api_keys.created_by` column exists but not enforced (any admin can see all keys)
- Chat page `/chat` shows everything without login (no gate)
- No frontend UI for managing keys or whitelist

## What We Build
1. **User API Keys** — every logged-in user can CRUD their own API keys
2. **Admin Whitelist** — only admin can manage whitelisted emails
3. **Login Gate** — `/chat` shows only Login button if not authenticated

---

## TDDAB-1: User API Key Routes (`/api/keys`)

### 1.1 Tests First (RED)

**Create:** `apps/api/src/keys/keys.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createDb } from "../db";
import { schema } from "../db";
import { createAuth } from "../auth";
import { loadConfig } from "../common/config";

const TEST_DB_URL = process.env.DATABASE_URL_TEST
  || process.env.DATABASE_URL!.replace(/\/[^/]+$/, "/claude_chat_test");

describe("User API Keys Routes", () => {
  // Setup: create test app with a session for a non-admin user

  it("should return 401 without session", async () => {
    // GET /api/keys without session cookie → 401
  });

  it("should return empty array for user with no keys", async () => {
    // GET /api/keys with valid session → []
  });

  it("should create API key and return raw key once", async () => {
    // POST /api/keys { name: "my-agent" } → { id, name, key }
    // key is the raw value, shown only once
  });

  it("should list only keys created by the current user", async () => {
    // User A creates key → User B lists → does not see User A's key
  });

  it("should delete own key", async () => {
    // DELETE /api/keys/:id → { ok: true }
  });

  it("should return 404 when deleting another user's key", async () => {
    // User B tries to delete User A's key → 404
  });

  it("should close active WS connections when key is revoked", async () => {
    // Create key, connect WS with it, delete key → WS closed
  });
});
```

### 1.2 Implementation (GREEN)

**Step 1 — Create session guard helper:**
`apps/api/src/auth/session-guard.ts`
- `requireSession(auth, headers, set)` → returns `{ userId, email, role }` or 401 error
- Reusable by both `/api/keys` and `/api/admin`

**Step 2 — Create user keys routes:**
`apps/api/src/keys/index.ts`
- Prefix: `/api/keys`
- Guard: `requireSession` (any logged-in user)
- `GET /api/keys` → list keys WHERE `created_by = session.user.id`
- `POST /api/keys` → create key with `created_by = session.user.id`
- `DELETE /api/keys/:id` → delete WHERE `id = :id AND created_by = session.user.id`

**Step 3 — Mount in main app:**
`apps/api/src/index.ts`
- `.use(keyRoutes(db, auth))`

**Step 4 — Refactor admin routes:**
`apps/api/src/admin/index.ts`
- Remove API key CRUD from admin routes (moved to `/api/keys`)
- Keep only whitelist management
- Use `requireAdmin` (checks role === "admin")

### 1.3 Verification
```bash
bun test src/keys/keys.test.ts
bun test src/admin/ # verify whitelist still works
bun test # all 64+ tests pass
bun run typecheck
```

---

## TDDAB-2: Admin Whitelist Routes (Refactor)

### 2.1 Tests First (RED)

**Create:** `apps/api/src/admin/admin.test.ts`
```typescript
import { describe, it, expect } from "bun:test";

describe("Admin Whitelist Routes", () => {
  it("should return 401 without session", async () => {
    // GET /api/admin/whitelist without auth → 401
  });

  it("should return 403 for non-admin user", async () => {
    // GET /api/admin/whitelist with user role=user → 403
  });

  it("should list whitelisted emails for admin", async () => {
    // GET /api/admin/whitelist with admin session → array
  });

  it("should add email to whitelist", async () => {
    // POST /api/admin/whitelist { email } → created entry
  });

  it("should reject duplicate email", async () => {
    // POST same email twice → 409
  });

  it("should remove email from whitelist", async () => {
    // DELETE /api/admin/whitelist/:id → { ok: true }
  });
});
```

### 2.2 Implementation (GREEN)

**Step 1 — Refactor admin routes:**
`apps/api/src/admin/index.ts`
- Remove all API key routes (already in `/api/keys`)
- Keep whitelist CRUD with `requireAdmin` guard
- `addedBy` auto-set from session user email (not from body)

### 2.3 Verification
```bash
bun test src/admin/admin.test.ts
bun test # all tests pass
bun run typecheck
```

---

## TDDAB-3: Chat Page Login Gate

### 3.1 Tests First (RED)

**Create:** `apps/api/src/chat/login-gate.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTestApp } from "../test-utils";

describe("Chat Page Login Gate", () => {
  it("should serve /chat page", async () => {
    // GET /chat → 200 with HTML
  });

  it("should show login button when not authenticated", async () => {
    // GET /chat → HTML contains login button, does NOT contain connect-form
  });

  it("should return session info at /api/auth/get-session", async () => {
    // With valid session cookie → { user: { name, email, role } }
  });

  it("should return null at /api/auth/get-session without session", async () => {
    // Without session cookie → null
  });
});
```

### 3.2 Implementation (GREEN)

**Step 1 — Rewrite chat.html:**
`apps/api/src/chat/chat.html`
- Default: hide `connect-form`, `chat-body`, `input-bar`
- Show only `header` with title + centered Login button
- On page load: `fetch('/api/auth/get-session')` 
  - If authenticated: hide login button, show user name, show chat UI, show "My API Keys" section
  - If admin: also show "Whitelist" section
  - If not authenticated: show only login button

**Step 2 — API Keys UI section:**
- Table listing user's API keys (name, created, expires)
- "Create Key" button → shows raw key once in modal/alert
- "Revoke" button per key

**Step 3 — Admin Whitelist UI section (visible only to admin):**
- Table listing whitelisted emails
- "Add Email" input + button
- "Remove" button per email

### 3.3 Verification
```bash
bun test src/chat/login-gate.test.ts
bun test # all tests pass
# Manual verification via Chrome DevTools:
# 1. Open /chat without session → see only Login button
# 2. Login with Google → see chat + My API Keys
# 3. As admin → see Whitelist section too
```

---

## TDDAB-4: E2E Tests (Chrome DevTools)

### 4.1 Tests (E2E scenarios)

**Test scenarios (manual via Chrome DevTools MCP):**

1. **Login flow:**
   - Navigate to /chat → see Login button only
   - Click Login → Google consent → redirect back → see username in header

2. **API Key management:**
   - Click "Create Key" → see raw key displayed
   - Key appears in table
   - Click "Revoke" → key removed from table
   - Connect WS with revoked key → rejected

3. **Admin whitelist:**
   - Admin sees "Whitelist" section
   - Add email → appears in table
   - Remove email → gone from table
   - New user with removed email → login rejected

4. **Non-admin user:**
   - Login as non-admin → no Whitelist section visible
   - Can manage own API keys

### 4.2 Verification
```bash
# All E2E tests executed via Chrome DevTools MCP
# Each scenario documented with screenshots
```

---

## Execution Order
```
TDDAB-1 → TDDAB-2 → TDDAB-3 → TDDAB-4
   │          │          │          │
   │          │          │          └─ E2E (browser)
   │          │          └─ Chat page login gate + UI
   │          └─ Admin whitelist refactor
   └─ User API keys routes (/api/keys)
```

Each block is independently deployable and tested before moving to the next.
