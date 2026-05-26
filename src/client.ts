import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { appendFileSync } from "fs";
import { registerMcpTools } from "./client-tools";
import { connectWithRetry } from "./client-ws";

const LOG_FILE = process.env.CLAUDE_CHAT_LOG || "/tmp/claude-chat-mcp.log";
function log(level: string, msg: string): void {
  try { appendFileSync(LOG_FILE, `${new Date().toISOString()} [${level}] ${msg}\n`); } catch {}
}

const name = process.env.CLAUDE_CHAT_NAME || "agent-" + Math.random().toString(36).slice(2, 5);
const apiKey = process.env.CLAUDE_CHAT_API_KEY || "dev-api-key-change-me";
const hubUrl = process.env.CLAUDE_CHAT_URL || "ws://localhost:4444";

const mcp = new McpServer(
  { name: "claude-chat", version: "2.0.0" },
  {
    capabilities: { experimental: { "claude/channel": {} } },
    instructions:
      'You are connected to a Claude Code Chat hub. Messages arrive as <channel source="claude-chat" from="name" room="roomId">.\n' +
      "Available tools: create_room, join_room, leave_room, send_message, list_rooms, list_participants.\n" +
      "Workflow: join_room (by name, auto-creates) → send_message. Messages are scoped to rooms. Use 'to' param for DMs.\n" +
      'Join/leave notifications arrive as <channel source="claude-chat" event="joined|left">.',
  }
);

const pendingResponses = new Map<string, (data: unknown) => void>();
const wsHolder: { ws: WebSocket | null } = { ws: null };
const joinedRooms: string[] = [];

registerMcpTools(mcp, wsHolder, pendingResponses, joinedRooms);

const transport = new StdioServerTransport();
await mcp.connect(transport);

const wsUrl = `${hubUrl}/ws?apiKey=${encodeURIComponent(apiKey)}&name=${encodeURIComponent(name)}&clientType=agent`;

connectWithRetry(
  wsUrl,
  async (event) => {
    const msg = JSON.parse(event.data as string);

    const pending = pendingResponses.get(msg.type);
    if (pending) {
      pendingResponses.delete(msg.type);
      pending(msg);
      return;
    }

    if (msg.type === "message") {
      const content = msg.dm ? `[DM from ${msg.from}] ${msg.text}` : msg.text;
      log("info", `message from ${msg.from}: ${msg.text}${msg.dm ? ` (DM to ${msg.to})` : ""}`);
      await mcp.server.notification({
        method: "notifications/claude/channel",
        params: {
          content,
          meta: { from: msg.from, room: msg.roomId, timestamp: msg.timestamp },
        },
      });
      return;
    }

    if (msg.type === "participant_joined" || msg.type === "participant_left") {
      log("info", `${msg.name} ${msg.type.replace("participant_", "")}`);
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
      log("error", `hub error: ${msg.message}`);
    }
  },
  (ws) => {
    wsHolder.ws = ws;
    log("info", "ws connected, holder updated");
  },
  joinedRooms,
);
