#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
API_URL="${API_URL:-http://localhost:3000}"
OUTPUT_DIR="$PROJECT_ROOT/apps/web/src/app/generated"

echo "Fetching OpenAPI spec from $API_URL/docs/json..."
curl -sf "$API_URL/docs/json" -o /tmp/openapi-spec.json

echo "Generating Angular client..."
npx @openapitools/openapi-generator-cli generate \
  -i /tmp/openapi-spec.json \
  -g typescript-angular \
  -o "$OUTPUT_DIR" \
  --additional-properties=ngVersion=21,supportsES6=true,withInterfaces=true

echo "Client generated at $OUTPUT_DIR"
