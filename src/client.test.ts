import { describe, it, expect, beforeAll } from "bun:test";
import { registerTools, type ToolRegistry } from "./client-tools";

describe("MCP Client Tools", () => {
  let registry: ToolRegistry;

  beforeAll(() => {
    registry = registerTools();
  });

  it("should register create_room tool", () => {
    expect(registry.tools.has("create_room")).toBe(true);
  });

  it("should register join_room tool", () => {
    expect(registry.tools.has("join_room")).toBe(true);
  });

  it("should register leave_room tool", () => {
    expect(registry.tools.has("leave_room")).toBe(true);
  });

  it("should register send_message tool", () => {
    expect(registry.tools.has("send_message")).toBe(true);
  });

  it("should register list_rooms tool", () => {
    expect(registry.tools.has("list_rooms")).toBe(true);
  });

  it("should register list_participants tool", () => {
    expect(registry.tools.has("list_participants")).toBe(true);
  });

  it("should have exactly 6 tools", () => {
    expect(registry.tools.size).toBe(6);
  });
});
