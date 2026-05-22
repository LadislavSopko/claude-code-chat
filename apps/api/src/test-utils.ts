import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import pino from "pino";
import { createDb } from "./db";
import { schema } from "./db";
import { hashApiKey } from "./auth/api-key";
import { createAuth } from "./auth";
import type { Config } from "./common/config";
import { healthRoutes } from "./health";
import { chatRoutes } from "./chat";
import { wsHub } from "./ws";

const TEST_API_KEY = "test-key-12345";
const TEST_DB_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL!.replace(/\/[^/]+$/, "/claude_chat_test");

const testConfig: Config = {
  NODE_ENV: "test",
  PORT: 0,
  LOG_LEVEL: "error",
  DATABASE_URL: TEST_DB_URL,
  ADMIN_EMAIL: "admin@test.com",
  ALLOWED_ORIGINS: "http://localhost:4200",
  SEED_API_KEY: TEST_API_KEY,
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  REST_RATE_LIMIT_PER_MINUTE: 1000,
  WS_MESSAGE_RATE_LIMIT_PER_MINUTE: 1000,
  WS_CONNECT_RATE_LIMIT_PER_MINUTE: 1000,
};

export async function createTestApp(options?: { listen?: boolean }) {
  const db = createDb(TEST_DB_URL);
  const logger = pino({ level: "silent" });
  const auth = createAuth(db, testConfig);

  await db.delete(schema.apiKeys);
  const keyHash = await hashApiKey(TEST_API_KEY);
  await db.insert(schema.apiKeys).values({
    name: "test-key",
    keyHash,
    expiresAt: null,
  });

  const app = new Elysia()
    .use(cors())
    .get("/chat", async () => {
      const html = await Bun.file(new URL("./chat/chat.html", import.meta.url)).text();
      return new Response(html, { headers: { "content-type": "text/html" } });
    })
    .use(healthRoutes)
    .use(chatRoutes(db))
    .use(wsHub(db, logger, auth, testConfig));

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
