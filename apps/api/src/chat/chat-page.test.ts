import { describe, it, expect, beforeAll } from "bun:test";
import { createTestApp } from "../test-utils";

describe("HTML Chat Window", () => {
  let baseUrl: string;

  beforeAll(async () => {
    const result = await createTestApp({ listen: true });
    baseUrl = result.url;
  });

  it("should serve chat.html at /chat", async () => {
    const res = await fetch(`${baseUrl}/chat`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Claude Code Chat");
  });

  it("should include WebSocket connection script", async () => {
    const res = await fetch(`${baseUrl}/chat`);
    const html = await res.text();
    expect(html).toContain("new WebSocket");
  });

  it("should include STOP ALL button", async () => {
    const res = await fetch(`${baseUrl}/chat`);
    const html = await res.text();
    expect(html).toContain("STOP");
  });

  it("should include message input and send button", async () => {
    const res = await fetch(`${baseUrl}/chat`);
    const html = await res.text();
    expect(html).toContain('id="message-input"');
    expect(html).toContain('id="send-btn"');
  });
});
