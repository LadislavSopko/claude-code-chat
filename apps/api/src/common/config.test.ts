import { describe, it, expect, mock } from "bun:test";
import { loadConfig } from "./config";

describe("Config validation", () => {
  const validEnv: Record<string, string> = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    ADMIN_EMAIL: "admin@test.com",
    SEED_API_KEY: "some-key",
    BETTER_AUTH_SECRET: "a-secret-that-is-at-least-32-characters-long",
  };

  function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
    const saved: Record<string, string | undefined> = {};
    const allKeys = { ...validEnv, ...overrides };
    for (const k of Object.keys(allKeys)) {
      saved[k] = process.env[k];
      if (allKeys[k] === undefined) delete process.env[k];
      else process.env[k] = allKeys[k];
    }
    try {
      fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it("should load valid config with defaults", () => {
    withEnv({}, () => {
      const config = loadConfig();
      expect(["development", "test"]).toContain(config.NODE_ENV);
      expect(config.PORT).toBe(3000);
      expect(config.LOG_LEVEL).toBe("info");
      expect(config.REST_RATE_LIMIT_PER_MINUTE).toBe(100);
      expect(config.WS_MESSAGE_RATE_LIMIT_PER_MINUTE).toBe(30);
      expect(config.WS_CONNECT_RATE_LIMIT_PER_MINUTE).toBe(10);
      expect(config.ALLOWED_ORIGINS).toBe("http://localhost:4200");
    });
  });

  it("should crash when ADMIN_EMAIL is missing", () => {
    withEnv({ ADMIN_EMAIL: undefined }, () => {
      const mockExit = mock(() => {});
      const origExit = process.exit;
      process.exit = mockExit as never;
      const origError = console.error;
      console.error = mock(() => {});

      loadConfig();
      expect(mockExit).toHaveBeenCalledWith(1);

      process.exit = origExit;
      console.error = origError;
    });
  });

  it("should crash when SEED_API_KEY is missing", () => {
    withEnv({ SEED_API_KEY: undefined }, () => {
      const mockExit = mock(() => {});
      process.exit = mockExit as never;
      console.error = mock(() => {});

      loadConfig();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  it("should crash when BETTER_AUTH_SECRET is missing", () => {
    withEnv({ BETTER_AUTH_SECRET: undefined }, () => {
      const mockExit = mock(() => {});
      process.exit = mockExit as never;
      console.error = mock(() => {});

      loadConfig();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  it("should reject BETTER_AUTH_SECRET shorter than 32 chars", () => {
    withEnv({ BETTER_AUTH_SECRET: "short" }, () => {
      const mockExit = mock(() => {});
      process.exit = mockExit as never;
      console.error = mock(() => {});

      loadConfig();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  it("should require GOOGLE credentials in production", () => {
    withEnv({ NODE_ENV: "production", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }, () => {
      const mockExit = mock(() => {});
      process.exit = mockExit as never;
      console.error = mock(() => {});

      loadConfig();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  it("should accept empty GOOGLE credentials in development", () => {
    withEnv({ NODE_ENV: "development", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }, () => {
      const config = loadConfig();
      expect(config.GOOGLE_CLIENT_ID).toBe("");
    });
  });
});
