import { describe, it, expect, beforeAll } from "bun:test";
import { createTestApp } from "../test-utils";

describe("Chat HTML Improvements", () => {
  let baseUrl: string;

  beforeAll(async () => {
    const r = await createTestApp({ listen: true });
    baseUrl = r.url;
  });

  it("should have participants sidebar", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain('id="participants"');
  });

  it("should have room name display", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain("room-tag");
  });

  it("should have DM styling", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain(".msg.dm");
  });

  it("should support room selector and create", async () => {
    const html = await (await fetch(`${baseUrl}/chat`)).text();
    expect(html).toContain("new-room-name");
    expect(html).toContain("room-select");
  });
});
