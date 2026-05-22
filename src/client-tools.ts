import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface ToolRegistry {
  readonly tools: Map<string, boolean>;
}

export function registerTools(): ToolRegistry {
  const tools = new Map<string, boolean>();
  tools.set("create_room", true);
  tools.set("join_room", true);
  tools.set("leave_room", true);
  tools.set("send_message", true);
  tools.set("list_rooms", true);
  tools.set("list_participants", true);
  return { tools };
}

export interface WsHolder {
  ws: WebSocket | null;
}

export function registerMcpTools(
  mcp: McpServer,
  wsHolder: WsHolder,
  pendingResponses: Map<string, (data: unknown) => void>,
  joinedRooms: string[],
): void {
  function getWs(): WebSocket {
    if (!wsHolder.ws) throw new Error("WebSocket not connected yet");
    return wsHolder.ws;
  }

  function sendAndWait(msg: object, responseType: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      pendingResponses.set(responseType, resolve as (data: unknown) => void);
      getWs().send(JSON.stringify(msg));
      setTimeout(() => {
        if (pendingResponses.has(responseType)) {
          pendingResponses.delete(responseType);
          reject(new Error(`${responseType} timed out`));
        }
      }, 10000);
    });
  }

  mcp.registerTool("create_room", {
    description: "Create a new chat room.",
    inputSchema: { name: z.string().describe("Room name") },
  }, async ({ name }) => {
    const res = await sendAndWait({ type: "create_room", name }, "room_created");
    return { content: [{ type: "text" as const, text: `Room created: ${res.roomId}` }] };
  });

  mcp.registerTool("join_room", {
    description: "Join a chat room by name (auto-creates if not exists) or by roomId.",
    inputSchema: {
      name: z.string().optional().describe("Room name (auto-creates if not exists)"),
      roomId: z.string().optional().describe("Room ID (UUID) — alternative to name"),
    },
  }, async ({ name, roomId }) => {
    const msg = name ? { type: "join_room", name } : { type: "join_room", roomId };
    const res = await sendAndWait(msg, "room_joined");
    const roomName = (res.roomName as string) || name || roomId || "";
    if (!joinedRooms.includes(roomName)) joinedRooms.push(roomName);
    return { content: [{ type: "text" as const, text: `Joined room ${roomName} (${res.roomId})` }] };
  });

  mcp.registerTool("leave_room", {
    description: "Leave a chat room by name or roomId.",
    inputSchema: {
      name: z.string().optional().describe("Room name"),
      roomId: z.string().optional().describe("Room ID (UUID)"),
    },
  }, async ({ name, roomId }) => {
    const msg = name ? { type: "leave_room", name } : { type: "leave_room", roomId };
    await sendAndWait(msg, "room_left");
    const idx = joinedRooms.indexOf(name || roomId || "");
    if (idx >= 0) joinedRooms.splice(idx, 1);
    return { content: [{ type: "text" as const, text: `Left room ${name || roomId}` }] };
  });

  mcp.registerTool("send_message", {
    description: "Send a message to a room. Omit 'to' for broadcast, set 'to' for DM (only recipient + owners see it).",
    inputSchema: {
      name: z.string().optional().describe("Room name"),
      roomId: z.string().optional().describe("Room ID (UUID) — alternative to name"),
      text: z.string().describe("Message text"),
      to: z.string().optional().describe("Recipient name for DM (optional, omit for broadcast)"),
    },
  }, async ({ name, roomId, text, to }) => {
    const msg: Record<string, unknown> = { type: "message", text };
    if (name) msg.name = name;
    else if (roomId) msg.roomId = roomId;
    if (to) msg.to = to;
    getWs().send(JSON.stringify(msg));
    const target = to ? ` (DM to ${to})` : "";
    return { content: [{ type: "text" as const, text: `Message sent to ${name || roomId}${target}` }] };
  });

  mcp.registerTool("list_rooms", {
    description: "List all active chat rooms.",
  }, async () => {
    const res = await sendAndWait({ type: "list_rooms" }, "rooms");
    const rooms = (res.rooms as Array<{ name: string; id: string }>) || [];
    const text = rooms.map((r) => `${r.name} (${r.id})`).join("\n") || "(no rooms)";
    return { content: [{ type: "text" as const, text }] };
  });

  mcp.registerTool("list_participants", {
    description: "List participants in a chat room with their roles.",
    inputSchema: {
      name: z.string().optional().describe("Room name"),
      roomId: z.string().optional().describe("Room ID (UUID) — alternative to name"),
    },
  }, async ({ name, roomId }) => {
    const msg = name ? { type: "list_participants", name } : { type: "list_participants", roomId };
    const res = await sendAndWait(msg, "participants");
    const participants = (res.participants as Array<{ name: string; role: string }>) || [];
    const text = participants.map((p) => `${p.name} [${p.role}]`).join(", ") || "(no participants)";
    return { content: [{ type: "text" as const, text }] };
  });
}
