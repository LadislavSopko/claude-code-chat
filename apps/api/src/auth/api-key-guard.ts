import { validateApiKey } from "./api-key";
import type { Db } from "../db";
import type { Context } from "elysia";

export async function checkApiKey(db: Db, request: Request, set: Context["set"], devMode = false): Promise<{ code: string; message: string } | undefined> {
  if (devMode) return undefined;
  const authHeader = request.headers.get("authorization");
  const key = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";
  const result = await validateApiKey(db, key);
  if (!result.ok) {
    set.status = 401;
    return { code: "UNAUTHORIZED", message: "Invalid or missing API key" };
  }
  return undefined;
}
