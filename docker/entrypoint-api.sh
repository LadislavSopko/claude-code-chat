#!/bin/sh
set -e

echo "Running migrations..."
cd /app/apps/api && bun run src/db/migrate.ts

echo "Starting API..."
exec bun run /app/apps/api/src/index.ts
