import { describe, it, expect } from "bun:test";

function buildNotificationContent(msg: { dm?: boolean; from: string; text: string }): string {
  return msg.dm ? `[DM from ${msg.from}] ${msg.text}` : msg.text;
}

function buildNotificationMeta(msg: { from: string; roomId: string; timestamp: string; dm?: boolean; to?: string }) {
  return { from: msg.from, room: msg.roomId, timestamp: msg.timestamp };
}

describe("DM notification builder", () => {
  it("broadcast: content is plain text, meta has no dm/to", () => {
    const msg = { from: "alice", text: "hello", roomId: "r1", timestamp: "t1" };
    expect(buildNotificationContent(msg)).toBe("hello");
    const meta = buildNotificationMeta(msg);
    expect(meta).toEqual({ from: "alice", room: "r1", timestamp: "t1" });
    expect("dm" in meta).toBe(false);
    expect("to" in meta).toBe(false);
  });

  it("DM: content has [DM from sender] prefix, meta has NO dm/to", () => {
    const msg = { from: "alice", text: "secret", roomId: "r1", timestamp: "t1", dm: true, to: "bob" };
    expect(buildNotificationContent(msg)).toBe("[DM from alice] secret");
    const meta = buildNotificationMeta(msg);
    expect(meta).toEqual({ from: "alice", room: "r1", timestamp: "t1" });
    expect("dm" in meta).toBe(false);
    expect("to" in meta).toBe(false);
  });

  it("DM without dm flag: treated as broadcast", () => {
    const msg = { from: "alice", text: "normal", roomId: "r1", timestamp: "t1", dm: false };
    expect(buildNotificationContent(msg)).toBe("normal");
  });
});
