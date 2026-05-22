import { appendFileSync } from "fs";

const LOG_FILE = process.env.CLAUDE_CHAT_LOG || "/tmp/claude-chat-mcp.log";

function log(level: string, msg: string): void {
  try { appendFileSync(LOG_FILE, `${new Date().toISOString()} [${level}] ${msg}\n`); } catch {}
}

export function getBackoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export function connectWithRetry(
  url: string,
  onMessage: (event: MessageEvent) => void,
  onConnected: (ws: WebSocket) => void,
  rooms: string[],
): void {
  let attempt = 0;

  function tryConnect() {
    log("info", `connecting to ${url} (attempt ${attempt})`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      log("info", "connected");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "registered") {
        log("info", `registered as ${msg.name}`);
        onConnected(ws);
        for (const room of rooms) {
          ws.send(JSON.stringify({ type: "join_room", name: room }));
          log("info", `re-joining room: ${room}`);
        }
        return;
      }
      onMessage(event);
    };

    ws.onerror = () => {
      log("error", "WebSocket error");
    };

    ws.onclose = () => {
      const delay = getBackoffMs(attempt);
      log("warn", `disconnected, reconnecting in ${delay}ms`);
      attempt++;
      setTimeout(tryConnect, delay);
    };
  }

  tryConnect();
}
