import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import type { Auth } from "../auth";
import { hashApiKey } from "../auth/api-key";
import { closeConnectionsByAuthId } from "../ws/room-state";

async function requireAdmin(
  auth: Auth,
  headers: Headers,
  set: { status?: number | string },
): Promise<{ code: string; message: string } | undefined> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    set.status = 401;
    return { code: "UNAUTHORIZED", message: "Authentication required" };
  }
  const role = (session.user as Record<string, unknown>).role as string | undefined;
  if (role !== "admin") {
    set.status = 403;
    return { code: "FORBIDDEN", message: "Admin access required" };
  }
  return undefined;
}

export function adminRoutes(db: Db, auth: Auth) {
  return new Elysia({ prefix: "/api/admin" })
    .onBeforeHandle(async ({ request, set }) => {
      return requireAdmin(auth, request.headers, set);
    })
    .get("/api-keys", async () => {
      return db
        .select({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          createdBy: schema.apiKeys.createdBy,
          expiresAt: schema.apiKeys.expiresAt,
          lastUsedAt: schema.apiKeys.lastUsedAt,
          createdAt: schema.apiKeys.createdAt,
        })
        .from(schema.apiKeys);
    }, {
      detail: { summary: "List all API keys", tags: ["Admin"] },
    })
    .post("/api-keys", async ({ body }) => {
      const rawKey = crypto.randomUUID();
      const keyHash = await hashApiKey(rawKey);
      const [created] = await db
        .insert(schema.apiKeys)
        .values({
          name: body.name,
          keyHash,
          createdBy: body.createdBy ?? null,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        })
        .returning();
      return { id: created.id, name: created.name, key: rawKey };
    }, {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        createdBy: t.Optional(t.String()),
        expiresAt: t.Optional(t.String()),
      }),
      detail: { summary: "Create API key (returns raw key once)", tags: ["Admin"] },
    })
    .delete("/api-keys/:id", async ({ params, set }) => {
      const deleted = await db
        .delete(schema.apiKeys)
        .where(eq(schema.apiKeys.id, params.id))
        .returning();
      if (deleted.length === 0) {
        set.status = 404;
        return { code: "NOT_FOUND", message: "API key not found" };
      }
      closeConnectionsByAuthId(params.id);
      return { ok: true };
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { summary: "Revoke API key and close active WS", tags: ["Admin"] },
    })
    .get("/whitelist", async () => {
      return db.select().from(schema.whitelistedEmails);
    }, {
      detail: { summary: "List whitelisted emails", tags: ["Admin"] },
    })
    .post("/whitelist", async ({ body, set }) => {
      const [existing] = await db
        .select()
        .from(schema.whitelistedEmails)
        .where(eq(schema.whitelistedEmails.email, body.email));
      if (existing) {
        set.status = 409;
        return { code: "CONFLICT", message: "Email already whitelisted" };
      }
      const [created] = await db
        .insert(schema.whitelistedEmails)
        .values({ email: body.email, addedBy: body.addedBy })
        .returning();
      return created;
    }, {
      body: t.Object({
        email: t.String({ format: "email" }),
        addedBy: t.String({ minLength: 1 }),
      }),
      detail: { summary: "Add email to whitelist", tags: ["Admin"] },
    })
    .delete("/whitelist/:id", async ({ params, set }) => {
      const deleted = await db
        .delete(schema.whitelistedEmails)
        .where(eq(schema.whitelistedEmails.id, params.id))
        .returning();
      if (deleted.length === 0) {
        set.status = 404;
        return { code: "NOT_FOUND", message: "Whitelist entry not found" };
      }
      return { ok: true };
    }, {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { summary: "Remove email from whitelist", tags: ["Admin"] },
    });
}
