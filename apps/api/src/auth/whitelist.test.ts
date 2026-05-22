import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { createDb } from "../db";
import { schema } from "../db";
import { isEmailWhitelisted } from "./index";

const TEST_DB_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL!.replace(/\/[^/]+$/, "/claude_chat_test");
const ADMIN_EMAIL = "admin@test.com";

describe("Email Whitelist", () => {
  let db: ReturnType<typeof createDb>;

  beforeAll(async () => {
    db = createDb(TEST_DB_URL);
  });

  beforeEach(async () => {
    await db.delete(schema.whitelistedEmails);
  });

  it("should always allow admin email", async () => {
    const result = await isEmailWhitelisted(db, ADMIN_EMAIL, ADMIN_EMAIL);
    expect(result).toBe(true);
  });

  it("should reject non-whitelisted email", async () => {
    const result = await isEmailWhitelisted(db, "stranger@example.com", ADMIN_EMAIL);
    expect(result).toBe(false);
  });

  it("should allow whitelisted email", async () => {
    await db.insert(schema.whitelistedEmails).values({
      email: "allowed@example.com",
      addedBy: "admin",
    });

    const result = await isEmailWhitelisted(db, "allowed@example.com", ADMIN_EMAIL);
    expect(result).toBe(true);
  });

  it("should be case-sensitive for email matching", async () => {
    await db.insert(schema.whitelistedEmails).values({
      email: "user@example.com",
      addedBy: "admin",
    });

    const result = await isEmailWhitelisted(db, "User@example.com", ADMIN_EMAIL);
    expect(result).toBe(false);
  });
});
