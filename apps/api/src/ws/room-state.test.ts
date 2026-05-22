import { describe, it, expect, beforeEach } from "bun:test";
import pino from "pino";
import {
  initRoomState,
  registerClient,
  unregisterClient,
  addToRoom,
  removeFromRoom,
  getRoomMemberNames,
  getRoomMemberRoles,
  canSeeAllDMs,
  getDmVisibleNames,
  getOwnerNames,
  closeConnectionsByAuthId,
} from "./room-state";

function makeMockWs() {
  const sent: string[] = [];
  let closed = false;
  return {
    send(data: string) { sent.push(data); },
    close(_code?: number, _reason?: string) { closed = true; },
    get sentMessages() { return sent; },
    get isClosed() { return closed; },
  };
}

describe("Room State", () => {
  beforeEach(() => {
    initRoomState(pino({ level: "silent" }));
  });

  describe("registerClient / unregisterClient", () => {
    it("should register and unregister a client", () => {
      const ws = makeMockWs();
      registerClient(ws, "agent-1", "key-1", "API_KEY");
      addToRoom("agent-1", "room-1", "AGENT");
      expect(getRoomMemberNames("room-1")).toContain("agent-1");

      unregisterClient("agent-1");
      expect(getRoomMemberNames("room-1")).not.toContain("agent-1");
    });
  });

  describe("addToRoom / removeFromRoom", () => {
    it("should add member to room", () => {
      registerClient(makeMockWs(), "a", "k1", "API_KEY");
      addToRoom("a", "r1", "AGENT");
      expect(getRoomMemberNames("r1")).toEqual(["a"]);
    });

    it("should remove member from room", () => {
      registerClient(makeMockWs(), "a", "k1", "API_KEY");
      addToRoom("a", "r1", "AGENT");
      removeFromRoom("a", "r1");
      expect(getRoomMemberNames("r1")).toEqual([]);
    });
  });

  describe("getRoomMemberRoles", () => {
    it("should return names with roles", () => {
      registerClient(makeMockWs(), "owner", "k1", "SESSION");
      registerClient(makeMockWs(), "agent", "k2", "API_KEY");
      addToRoom("owner", "r1", "OWNER");
      addToRoom("agent", "r1", "AGENT");

      const roles = getRoomMemberRoles("r1");
      expect(roles).toContainEqual({ name: "owner", role: "OWNER" });
      expect(roles).toContainEqual({ name: "agent", role: "AGENT" });
    });

    it("should return empty for unknown room", () => {
      expect(getRoomMemberRoles("nonexistent")).toEqual([]);
    });
  });

  describe("canSeeAllDMs", () => {
    it("should return true for OWNER", () => {
      expect(canSeeAllDMs("OWNER")).toBe(true);
    });

    it("should return true for HUMAN", () => {
      expect(canSeeAllDMs("HUMAN")).toBe(true);
    });

    it("should return false for AGENT", () => {
      expect(canSeeAllDMs("AGENT")).toBe(false);
    });
  });

  describe("getDmVisibleNames", () => {
    it("should return only OWNER and HUMAN names", () => {
      registerClient(makeMockWs(), "owner", "k1", "SESSION");
      registerClient(makeMockWs(), "human", "k2", "SESSION");
      registerClient(makeMockWs(), "agent", "k3", "API_KEY");
      addToRoom("owner", "r1", "OWNER");
      addToRoom("human", "r1", "HUMAN");
      addToRoom("agent", "r1", "AGENT");

      const visible = getDmVisibleNames("r1");
      expect(visible).toContain("owner");
      expect(visible).toContain("human");
      expect(visible).not.toContain("agent");
    });
  });

  describe("getOwnerNames", () => {
    it("should return only OWNER names", () => {
      registerClient(makeMockWs(), "owner", "k1", "SESSION");
      registerClient(makeMockWs(), "agent", "k2", "API_KEY");
      addToRoom("owner", "r1", "OWNER");
      addToRoom("agent", "r1", "AGENT");

      expect(getOwnerNames("r1")).toEqual(["owner"]);
    });
  });

  describe("closeConnectionsByAuthId", () => {
    it("should close WS and unregister clients matching authId", () => {
      const ws1 = makeMockWs();
      const ws2 = makeMockWs();
      registerClient(ws1, "agent-a", "key-revoked", "API_KEY");
      registerClient(ws2, "agent-b", "key-other", "API_KEY");
      addToRoom("agent-a", "r1", "AGENT");
      addToRoom("agent-b", "r1", "AGENT");

      closeConnectionsByAuthId("key-revoked");

      expect(ws1.isClosed).toBe(true);
      expect(ws1.sentMessages.length).toBe(1);
      expect(JSON.parse(ws1.sentMessages[0]).type).toBe("error");
      expect(ws2.isClosed).toBe(false);
      expect(getRoomMemberNames("r1")).not.toContain("agent-a");
      expect(getRoomMemberNames("r1")).toContain("agent-b");
    });

    it("should do nothing if authId not found", () => {
      closeConnectionsByAuthId("nonexistent");
    });
  });
});
