import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { loadConfig } from "./common/config";
import { createLogger } from "./common/logger";
import { createDb } from "./db";
import { healthRoutes } from "./health";
import { chatRoutes } from "./chat";

const config = loadConfig();
const logger = createLogger(config);
const db = createDb(config.DATABASE_URL);

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Claude Code Chat API",
          version: "0.1.0",
          description: "Chat hub for distributed Claude Code sessions",
        },
        tags: [
          { name: "Health", description: "Health and version" },
          { name: "Chat", description: "Rooms and messages" },
        ],
      },
      path: "/docs",
    })
  )
  .onRequest(({ request }) => {
    logger.info({ method: request.method, url: request.url }, "request");
  })
  .onError(({ error, set }) => {
    logger.error({ err: error }, "unhandled error");
    set.status = 500;
    return { code: "INTERNAL_ERROR", message: "An unexpected error occurred" };
  })
  .use(healthRoutes)
  .use(chatRoutes(db))
  .listen(config.PORT);

logger.info({ port: config.PORT }, `Claude Code Chat API running`);

export type App = typeof app;
