import { describe, it, expect } from "bun:test";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  it("should allow requests within limit", () => {
    const limiter = new RateLimiter(60_000, 3);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(true);
  });

  it("should reject requests exceeding limit", () => {
    const limiter = new RateLimiter(60_000, 2);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(false);
  });

  it("should track keys independently", () => {
    const limiter = new RateLimiter(60_000, 1);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip2")).toBe(true);
    expect(limiter.check("ip1")).toBe(false);
    expect(limiter.check("ip2")).toBe(false);
  });

  it("should reset after window expires", () => {
    const limiter = new RateLimiter(10, 1);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(false);

    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 15) { /* spin */ }

    expect(limiter.check("ip1")).toBe(true);
  });

  it("should return retryAfterMs correctly", () => {
    const limiter = new RateLimiter(60_000, 1);
    expect(limiter.retryAfterMs("ip1")).toBe(0);
    limiter.check("ip1");
    const retry = limiter.retryAfterMs("ip1");
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60_000);
  });

  it("should cleanup expired entries", () => {
    const limiter = new RateLimiter(10, 1);
    limiter.check("ip1");
    limiter.check("ip2");

    const start = Date.now();
    while (Date.now() - start < 15) { /* spin */ }

    limiter.cleanup();
    // After cleanup, keys should be gone — new checks should pass
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip2")).toBe(true);
  });
});
