#!/usr/bin/env bash
set -euo pipefail

AGENT="${1:?Usage: ./agents/start.sh <agent-name>}"
AGENT_DIR="$(cd "$(dirname "$0")/$AGENT" && pwd)"

if [ ! -f "$AGENT_DIR/CLAUDE.md" ]; then
  echo "Agent '$AGENT' not found at $AGENT_DIR" >&2
  exit 1
fi

cd "$AGENT_DIR"
exec claude \
  --setting-sources project \
  --mcp-config .mcp.json \
  --strict-mcp-config \
  --dangerously-skip-permissions \
  --dangerously-load-development-channels server:claude-chat
