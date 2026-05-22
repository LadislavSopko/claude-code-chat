import { createDb } from "./index";
import { schema } from "./index";
import { hashApiKey } from "../auth/api-key";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const apiKey = process.env.SEED_API_KEY;
if (!apiKey) {
  console.error("SEED_API_KEY is required");
  process.exit(1);
}
const db = createDb(databaseUrl);
const keyHash = await hashApiKey(apiKey);

const [existing] = await db
  .select()
  .from(schema.apiKeys)
  .where(eq(schema.apiKeys.keyHash, keyHash));

if (!existing) {
  await db.insert(schema.apiKeys).values({
    name: "default",
    keyHash,
    expiresAt: null,
  });
  console.log(`Seeded API key: ${apiKey}`);
} else {
  console.log("API key already exists, skipping seed");
}

process.exit(0);
