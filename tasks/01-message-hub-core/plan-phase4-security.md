# TDDAB Phase 4: Security Hardening (Pre-Deploy)
**Date:** 2026-05-22
**Type:** Security
**Priority:** CRITICAL

## Executive Summary
Close all 10 security blockers before exposing the hub on the internet. Auth via Better Auth (Google OAuth for humans, JWT API key for agents), whitelist, admin console, rate limiting, TLS-ready.

## Auth Design (consensus laco + researcher + critic)
- **Human**: Google OAuth → Better Auth session (JWT)
- **Agent**: JWT token as API key, with claims (name, scope, expiry)
  - JWT is ENVELOPE only — DB row per token is source of truth
  - Revoke = DELETE row + close active WS socket
  - Check DB at EVERY connect (never trust signature alone)
  - Pin signing algorithm, reject alg:none
  - Claims change = generate new token, delete old
- **Admin**: ADMIN_EMAIL in env, first matching login = admin
- **Whitelist**: allowed_emails table, enforced in Better Auth hook

---

## TDDAB-15: Better Auth + Google Login + Admin Bootstrap

### 15.1 Tests First (RED)
```typescript
// apps/api/src/auth/auth.test.ts
describe("Auth Bootstrap", () => {
  it("should require ADMIN_EMAIL in production config", async () => {
    // Config without ADMIN_EMAIL in prod mode should crash
  });

  it("should create admin user when ADMIN_EMAIL matches login", async () => {
    // First Google login with ADMIN_EMAIL → user with is_admin=true
  });

  it("should reject login for email not in whitelist", async () => {
    // Google login with unknown email → 403
  });

  it("should allow admin to add email to whitelist", async () => {
    // POST /api/admin/whitelist with admin session → 200
  });

  it("should allow whitelisted email to login", async () => {
    // After adding email to whitelist → login succeeds
  });
});
```

### 15.2 Implementation
- Update config.ts: `ADMIN_EMAIL` required in prod (crash if missing), `JWT_SECRET` required in prod
- Add `users` table: id, email, name, is_admin, created_at
- Add `allowed_emails` table: id, email, added_by, created_at
- Better Auth config: Google OAuth + databaseHooks that check allowed_emails on sign-in
- ADMIN_EMAIL auto-inserted into allowed_emails + user.is_admin=true on first matching login
- REST endpoints: `POST /api/admin/whitelist` (admin only), `GET /api/admin/whitelist` (admin only), `DELETE /api/admin/whitelist/:email` (admin only)

### 15.3 Verification
```bash
bun test src/auth/auth.test.ts
```

---

## TDDAB-16: JWT API Key Management (Admin Console)

### 16.1 Tests First (RED)
```typescript
// apps/api/src/auth/api-key-jwt.test.ts
describe("JWT API Key Management", () => {
  it("should generate JWT with claims (name, scope, expiry)", async () => {
    // POST /api/admin/api-keys → returns JWT string + stores row in DB
  });

  it("should validate JWT by checking DB row exists", async () => {
    // Valid JWT + row in DB → accepted
  });

  it("should reject JWT when row deleted from DB", async () => {
    // Delete row → same JWT rejected
  });

  it("should reject expired JWT", async () => {
    // JWT with past expiry → rejected even if row exists
  });

  it("should reject JWT with wrong algorithm", async () => {
    // JWT signed with alg:none → rejected
  });

  it("should list all API keys (admin only)", async () => {
    // GET /api/admin/api-keys → list with masked tokens
  });

  it("should revoke API key and close active WS", async () => {
    // DELETE /api/admin/api-keys/:id → row deleted + WS closed
  });
});
```

### 16.2 Implementation
- Replace current api_keys table: add `jti` (JWT ID), `claims` (JSONB), `issued_at`, rename keyHash → tokenId
- `generateApiKey(name, scope, expiresIn)`: create JWT with jti + claims, store row with jti in DB, return JWT shown once
- `validateApiKeyJwt(token)`: verify signature (pinned algo), decode jti, lookup in DB, check not expired
- Admin endpoints: `POST /api/admin/api-keys`, `GET /api/admin/api-keys`, `DELETE /api/admin/api-keys/:id`
- On DELETE: remove DB row + find active WS by apiKeyId + close socket
- room-state.ts: track apiKeyId per client for revoke-and-close

### 16.3 Verification
```bash
bun test src/auth/api-key-jwt.test.ts
```

---

## TDDAB-17: Roles from Auth Session (Not Self-Declared)

### 17.1 Tests First (RED)
```typescript
// apps/api/src/ws/ws-auth-roles.test.ts
describe("Roles from Auth", () => {
  it("human with Better Auth session → HUMAN role", async () => {
    // WS connect with session cookie → HUMAN
  });

  it("agent with JWT API key → AGENT role", async () => {
    // WS connect with JWT → AGENT
  });

  it("room creator human → OWNER role", async () => {
    // Human creates room → OWNER
  });

  it("agent creating room → AGENT (not OWNER)", async () => {
    // Agent creates room → stays AGENT
  });

  it("should reject WS without valid auth", async () => {
    // No session, no API key → rejected
  });
});
```

### 17.2 Implementation
- WS open handler: check for Better Auth session cookie OR JWT API key in header
  - Session cookie → resolve user from DB → HUMAN (or OWNER if creates room)
  - JWT API key → validate + DB check → AGENT
  - Neither → close 4001
- Remove `clientType` query param (was dev-only)
- resolveParticipantRole derives from auth method, not client declaration

### 17.3 Verification
```bash
bun test src/ws/ws-auth-roles.test.ts
```

---

## TDDAB-18: Security Hardening (Rate Limit, Origin, CORS, Config)

### 18.1 Tests First (RED)
```typescript
// apps/api/src/security/security.test.ts
describe("Security Hardening", () => {
  it("should reject WS upgrade with invalid Origin", async () => {
    // WS connect with Origin: evil.com → rejected
  });

  it("should rate limit WS connections per IP", async () => {
    // 100 connections in 1 second → some rejected
  });

  it("should reject oversized messages", async () => {
    // WS message > 64KB → rejected
  });

  it("should not serve /docs in production", async () => {
    // NODE_ENV=production → /docs returns 404
  });

  it("should crash on missing required secrets in prod", async () => {
    // No JWT_SECRET + NODE_ENV=production → process.exit
  });

  it("should restrict CORS to configured origin", async () => {
    // Request with wrong Origin → no CORS headers
  });
});
```

### 18.2 Implementation
- Origin validation on WS upgrade: check against `ALLOWED_ORIGINS` env
- Rate limiting: in-memory counter per IP (connections/minute + messages/second)
- Max message size: 64KB limit in WS handler
- Swagger: disable when `NODE_ENV=production`
- Config: `JWT_SECRET`, `ADMIN_EMAIL` crash in prod if missing. Remove all insecure defaults for prod.
- CORS: `ALLOWED_ORIGINS` env, restrict cors() to those origins
- API key in header `Authorization: Bearer <jwt>` not query string

### 18.3 Verification
```bash
bun test src/security/security.test.ts
```

---

## TDDAB-19: Cleanup + Production Docker

### 19.1 Tests First (RED)
```typescript
// apps/api/src/health/health-prod.test.ts
describe("Production Readiness", () => {
  it("should not have broker.ts referenced anywhere", async () => {
    // grep for :4000 or broker.ts in active code → zero hits
  });

  it("health endpoint should not leak internals", async () => {
    // GET /health → only status, version, uptime
  });
});
```

### 19.2 Implementation
- Delete src/broker.ts (confirmed dead code — all clients connect to :3000/ws)
- Update docker-compose for production: Postgres private network, no published port, strong passwords
- Add Dockerfile for API (Bun)
- Add Caddy config for TLS + reverse proxy
- Update .env.example with all production vars
- DB on private network only

### 19.3 Verification
```bash
bun test src/health/health-prod.test.ts
grep -r ":4000\|broker.ts" apps/api/src/ src/client*.ts --include="*.ts" | grep -v test | grep -v node_modules
```

---

## Review Fixes (researcher + critic)

### Applied to TDDAB-15:
- Auth hook: ADMIN_EMAIL always allowed even when allowed_emails is empty (prevents deadlock)
- Test: admin can login on empty DB
- Whitelist removal also terminates active sessions + WS of that user
- Admin cannot remove self from whitelist / revoke own is_admin

### Applied to TDDAB-16:
- REST guard (api-key-guard.ts) migrated to JWT validation in same TDDAB
- seed.ts updated/removed (incompatible with JWT model)
- Revoke closes ALL sockets with that apiKeyId (not just one)
- Max expiry cap on generated keys
- Claims: JWT is authoritative for reading, DB row for existence/revocation

### Applied to TDDAB-17:
- Reconnect path (index.ts:~105-110) also cleaned of clientType fallback
- Test: reconnection re-derives role from auth, never from query param

### Applied to TDDAB-18:
- Origin check: present → must be in ALLOWED_ORIGINS; absent + valid JWT → allowed (non-browser agents)
- Rate limiting reads real IP from X-Forwarded-For (trusted proxy only)
- Test: no Origin header + valid JWT → accepted

### Applied to TDDAB-19:
- src/client.ts + client-ws.ts updated: auth in header, remove clientType param
- BETTER_AUTH_URL must be https in prod, session cookie Secure + HttpOnly + SameSite
- Backup/restore/monitoring: infra responsibility of laco (not in code plan), documented here

## Success Criteria (ALL required pre-deploy)
- [ ] Google OAuth login via Better Auth
- [ ] ADMIN_EMAIL bootstrap (deterministic, no deadlock on empty DB)
- [ ] Email whitelist enforced in auth hook (ADMIN_EMAIL always passes)
- [ ] JWT API keys with DB-backed revocation
- [ ] Revoke closes ALL active WS sockets for that key
- [ ] Algo pinned, alg:none rejected, max expiry cap
- [ ] Roles derived from auth method (not self-declared, incl. reconnect path)
- [ ] Origin validation on WS upgrade (absent Origin + valid JWT = ok)
- [ ] Rate limiting via X-Forwarded-For (connections + messages)
- [ ] Max message size enforced
- [ ] Swagger disabled in prod
- [ ] Config crashes on missing secrets in prod (JWT_SECRET, ADMIN_EMAIL)
- [ ] CORS restricted to allowed origins
- [ ] API key in Authorization header (not query string)
- [ ] REST guard migrated to JWT validation
- [ ] src/client.ts updated (header auth, no clientType)
- [ ] seed.ts updated/removed
- [ ] broker.ts deleted
- [ ] BETTER_AUTH_URL=https in prod, cookie Secure+HttpOnly+SameSite
- [ ] Production Docker + Caddy config
- [ ] Backup/restore/monitoring = laco infra (documented)
- [ ] All tests pass
