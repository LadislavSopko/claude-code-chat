import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { loadConfig } from "./common/config";
import { createLogger } from "./common/logger";
import { RateLimiter } from "./common/rate-limiter";
import { createDb } from "./db";
import { createAuth } from "./auth";
import { healthRoutes } from "./health";
import { chatRoutes } from "./chat";
import { adminRoutes } from "./admin";
import { wsHub } from "./ws";

const config = loadConfig();
const logger = createLogger(config);
const db = createDb(config.DATABASE_URL);
const auth = createAuth(db, config);

const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
const restLimiter = new RateLimiter(60_000, config.REST_RATE_LIMIT_PER_MINUTE);

const app = new Elysia()
  .use(
    cors({
      origin: config.NODE_ENV === "production" ? allowedOrigins : true,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PATCH", "DELETE"],
    }),
  )
  .use(() => {
    if (config.NODE_ENV === "production") return new Elysia();
    return new Elysia().use(
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
      }),
    );
  })
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .onRequest(({ request }) => {
    logger.info({ method: request.method, url: request.url }, "request");
  })
  .onBeforeHandle(({ request, set }) => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!restLimiter.check(ip)) {
      set.status = 429;
      set.headers["retry-after"] = String(Math.ceil(restLimiter.retryAfterMs(ip) / 1000));
      return { code: "RATE_LIMITED", message: "Too many requests" };
    }
    return undefined;
  })
  .onError(({ error, set }) => {
    logger.error({ err: error }, "unhandled error");
    set.status = 500;
    return { code: "INTERNAL_ERROR", message: "An unexpected error occurred" };
  })
  .get("/chat", async () => {
    const html = await Bun.file(
      new URL("./chat/chat.html", import.meta.url),
    ).text();
    return new Response(html, { headers: { "content-type": "text/html" } });
  })
  .use(healthRoutes)
  .use(chatRoutes(db))
  .use(adminRoutes(db, auth))
  .use(wsHub(db, logger, auth, config))
  .listen(config.PORT);

logger.info({ port: config.PORT }, `Claude Code Chat API running`);

export type App = typeof app;
