import { describe, it, expect } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";

const CLIENT_PATH = join(__dirname, "client.ts");
const BASE_ENV = {
  ...process.env,
  CLAUDE_CHAT_URL: "ws://127.0.0.1:1",
};

function spawnClient(name: string) {
  return spawn("bun", ["run", CLIENT_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...BASE_ENV, CLAUDE_CHAT_NAME: name },
  });
}

describe("MCP Client process lifecycle", () => {
  it("should stay alive for 5s while stdin is open", async () => {
    const child = spawnClient("test-stay-alive");
    let exitedEarly = false;
    child.on("exit", () => { exitedEarly = true; });

    await new Promise((r) => setTimeout(r, 5000));

    child.kill("SIGKILL");
    expect(exitedEarly).toBe(false);
  }, 10000);

  it("should survive stdin closing immediately (bunx scenario)", async () => {
    const child = spawnClient("test-stdin-immediate-close");

    // bunx closes stdin right after spawn — simulate this
    child.stdin!.end();

    let exitedEarly = false;
    child.on("exit", () => { exitedEarly = true; });

    await new Promise((r) => setTimeout(r, 5000));

    child.kill("SIGKILL");
    expect(exitedEarly).toBe(false);
  }, 10000);

  it("should exit within 2s when receiving SIGTERM", async () => {
    const child = spawnClient("test-sigterm");

    await new Promise((r) => setTimeout(r, 1500));

    child.kill("SIGTERM");

    const exited = await Promise.race([
      new Promise<true>((resolve) => child.on("exit", () => resolve(true))),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);

    if (!exited) {
      child.kill("SIGKILL");
    }

    expect(exited).toBe(true);
  }, 10000);
});
