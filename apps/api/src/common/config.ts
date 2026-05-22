import { z } from "zod";

const NodeEnv = z.enum(["development", "production", "test"]);

const configSchema = z
  .object({
    NODE_ENV: NodeEnv.default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DATABASE_URL: z.url(),
    ADMIN_EMAIL: z.email(),
    ALLOWED_ORIGINS: z.string().default("http://localhost:4200"),
    SEED_API_KEY: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    REST_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
    WS_MESSAGE_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(30),
    WS_CONNECT_RATE_LIMIT_PER_MINUTE: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
  })
  .refine(
    (c) =>
      c.NODE_ENV !== "production" ||
      (c.GOOGLE_CLIENT_ID !== "" && c.GOOGLE_CLIENT_SECRET !== ""),
    {
      message:
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production",
    },
  );

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`Configuration validation failed:\n${formatted}`);
    process.exit(1);
  }
  return result.data;
}
