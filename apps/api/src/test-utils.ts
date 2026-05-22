import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createDb } from "./db";
import { schema } from "./db";
import { hashApiKey } from "./auth/api-key";
import { healthRoutes } from "./health";
import { chatRoutes } from "./chat";

const TEST_API_KEY = "test-key-12345";
const TEST_DB_URL = process.env.DATABASE_URL!;

export async function createTestApp(options?: { listen?: boolean }) {
  const db = createDb(TEST_DB_URL);

  await db.delete(schema.apiKeys);
  const keyHash = await hashApiKey(TEST_API_KEY);
  await db.insert(schema.apiKeys).values({
    name: "test-key",
    keyHash,
    expiresAt: null,
  });

  const app = new Elysia()
    .use(cors())
    .use(healthRoutes)
    .use(chatRoutes(db));

  if (options?.listen) {
    const server = app.listen(0);
    const port = server.server!.port;
    return {
      app,
      db,
      url: `http://localhost:${port}`,
      close: async () => {
        server.stop();
      },
    };
  }

  return { app, db, url: "", close: async () => {} };
}
