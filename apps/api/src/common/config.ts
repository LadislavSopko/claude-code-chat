import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4444),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DEV_MODE: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  DATABASE_URL: z.string().url(),
  SEED_API_KEY: z.string().min(1).default("dev-api-key-change-me"),
  BETTER_AUTH_SECRET: z.string().min(1).default("dev-secret-not-for-production"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4444"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
});

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
