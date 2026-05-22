import { describe, it, expect } from "bun:test";
import { getBackoffMs, connectWithRetry } from "./client-ws";

describe("MCP Client Reconnection", () => {
  it("should have connectWithRetry function", () => {
    expect(typeof connectWithRetry).toBe("function");
  });

  it("should calculate exponential backoff starting at 1s", () => {
    expect(getBackoffMs(0)).toBe(1000);
    expect(getBackoffMs(1)).toBe(2000);
    expect(getBackoffMs(2)).toBe(4000);
  });

  it("should cap backoff at 30s", () => {
    expect(getBackoffMs(10)).toBe(30000);
    expect(getBackoffMs(20)).toBe(30000);
  });
});
