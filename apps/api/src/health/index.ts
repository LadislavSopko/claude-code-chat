import { Elysia, t } from "elysia";
import type { HealthDto } from "@claude-code-chat/core";

const startTime = Date.now();

const pkg = await Bun.file(new URL("../../package.json", import.meta.url)).json();
const version: string = pkg.version ?? "0.0.0";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", (): HealthDto => ({
    status: "ok",
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  }), {
    detail: {
      summary: "Health check",
      tags: ["Health"],
    },
    response: t.Object({
      status: t.Literal("ok"),
      version: t.String(),
      uptime: t.Number(),
    }),
  });
