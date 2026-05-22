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
  pendingResponses: Map<string, (data: unknown) => void>
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
    description: "Join a chat room to send and receive messages.",
    inputSchema: { roomId: z.string().describe("Room ID (UUID)") },
  }, async ({ roomId }) => {
    await sendAndWait({ type: "join_room", roomId }, "room_joined");
    return { content: [{ type: "text" as const, text: `Joined room ${roomId}` }] };
  });

  mcp.registerTool("leave_room", {
    description: "Leave a chat room.",
    inputSchema: { roomId: z.string().describe("Room ID (UUID)") },
  }, async ({ roomId }) => {
    await sendAndWait({ type: "leave_room", roomId }, "room_left");
    return { content: [{ type: "text" as const, text: `Left room ${roomId}` }] };
  });

  mcp.registerTool("send_message", {
    description: "Send a message to a room. All room members will receive it.",
    inputSchema: {
      roomId: z.string().describe("Room ID (UUID)"),
      text: z.string().describe("Message text"),
    },
  }, async ({ roomId, text }) => {
    getWs().send(JSON.stringify({ type: "message", roomId, text }));
    return { content: [{ type: "text" as const, text: `Message sent to room ${roomId}` }] };
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
    description: "List participants in a chat room.",
    inputSchema: { roomId: z.string().describe("Room ID (UUID)") },
  }, async ({ roomId }) => {
    const res = await sendAndWait({ type: "list_participants", roomId }, "participants");
    const names = (res.names as string[]) || [];
    return { content: [{ type: "text" as const, text: names.join(", ") || "(no participants)" }] };
  });
}
