import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMcpTools } from "./client-tools";

const name = process.env.CLAUDE_CHAT_NAME || "agent-" + Math.random().toString(36).slice(2, 5);
const apiKey = process.env.CLAUDE_CHAT_API_KEY || "dev-api-key-change-me";
const hubUrl = process.env.CLAUDE_CHAT_URL || "ws://localhost:3000";

const mcp = new McpServer(
  { name: "claude-chat", version: "2.0.0" },
  {
    capabilities: { experimental: { "claude/channel": {} } },
    instructions:
      'You are connected to a Claude Code Chat hub. Messages arrive as <channel source="claude-chat" from="name" room="roomId">.\n' +
      "Available tools: create_room, join_room, leave_room, send_message, list_rooms, list_participants.\n" +
      "Workflow: create_room or list_rooms → join_room → send_message. Messages are scoped to rooms.\n" +
      'Join/leave notifications arrive as <channel source="claude-chat" event="joined|left">.',
  }
);

const pendingResponses = new Map<string, (data: unknown) => void>();

const transport = new StdioServerTransport();
await mcp.connect(transport);

const wsUrl = `${hubUrl}/ws?apiKey=${encodeURIComponent(apiKey)}&name=${encodeURIComponent(name)}`;
const ws = new WebSocket(wsUrl);

registerMcpTools(mcp, ws, pendingResponses);

ws.onopen = () => {};

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data as string);

  if (msg.type === "registered") return;

  const pending = pendingResponses.get(msg.type);
  if (pending) {
    pendingResponses.delete(msg.type);
    pending(msg);
    return;
  }

  if (msg.type === "message") {
    await mcp.server.notification({
      method: "notifications/claude/channel",
      params: {
        content: msg.text,
        meta: { from: msg.from, room: msg.roomId, timestamp: msg.timestamp },
      },
    });
    return;
  }

  if (msg.type === "participant_joined" || msg.type === "participant_left") {
    await mcp.server.notification({
      method: "notifications/claude/channel",
      params: {
        content: msg.name,
        meta: { event: msg.type.replace("participant_", ""), room: msg.roomId },
      },
    });
    return;
  }

  if (msg.type === "error") {
    console.error("hub error:", msg.message);
  }
};

ws.onerror = () => {
  console.error("WebSocket error — is the hub running?");
  process.exit(1);
};

ws.onclose = () => {
  console.error("hub connection closed");
  process.exit(1);
};
