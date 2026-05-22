import { describe, it, expect, beforeAll } from "bun:test";
import { createDb } from "../db";
import { schema } from "../db";
import { validateApiKey, hashApiKey } from "./api-key";
import { ErrorCode } from "@claude-code-chat/core";

const TEST_DB_URL = process.env.DATABASE_URL!;

describe("API Key Auth", () => {
  let db: ReturnType<typeof createDb>;

  beforeAll(async () => {
    db = createDb(TEST_DB_URL);
    await db.delete(schema.apiKeys);
    const hashed = await hashApiKey("test-key-12345");
    await db.insert(schema.apiKeys).values({
      name: "test-key",
      keyHash: hashed,
      expiresAt: new Date(Date.now() + 86400000),
    });
  });

  it("should accept a valid API key", async () => {
    const result = await validateApiKey(db, "test-key-12345");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("test-key");
    }
  });

  it("should reject an invalid API key", async () => {
    const result = await validateApiKey(db, "wrong-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.Unauthorized);
    }
  });

  it("should reject an empty API key", async () => {
    const result = await validateApiKey(db, "");
    expect(result.ok).toBe(false);
  });

  it("should reject an expired API key", async () => {
    const hashed = await hashApiKey("expired-key");
    await db.insert(schema.apiKeys).values({
      name: "expired",
      keyHash: hashed,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await validateApiKey(db, "expired-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.Unauthorized);
    }
  });
});
