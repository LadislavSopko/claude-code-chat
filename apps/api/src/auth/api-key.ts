import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";
import { type Result, ok, fail, ErrorCode } from "@claude-code-chat/core";

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}

export interface ApiKeyInfo {
  readonly id: string;
  readonly name: string;
}

export async function validateApiKey(db: Db, key: string): Promise<Result<ApiKeyInfo>> {
  if (!key) {
    return fail(ErrorCode.Unauthorized, "API key is required");
  }
  const hashed = await hashApiKey(key);
  const [found] = await db
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, hashed));
  if (!found) {
    return fail(ErrorCode.Unauthorized, "Invalid API key");
  }
  if (found.expiresAt && found.expiresAt < new Date()) {
    return fail(ErrorCode.Unauthorized, "API key expired");
  }
  return ok({ id: found.id, name: found.name });
}
