# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

- **Name**: claude-code-chat
- **Purpose**: Chat hub for distributed Claude Code sessions with real-time messaging
- **Stack**: Bun (runtime) + Elysia (API) + Angular 21 + PrimeNG 21 + PostgreSQL + Drizzle ORM + Better Auth
- **Architecture**: Bun workspace monorepo — `apps/api`, `apps/web`, `libs/core`, `src/` (standalone broker + MCP client)

## Critical Rules

### Code Style
- Strict TypeScript: `strict: true` — no `any` type
- Immutable DTOs: `readonly` on all properties
- Enums everywhere: never string constants, serialize as string values
- JSON serialization: "as is" — no camelCase/snake_case transformation
- Zero warnings policy: fix all warnings before committing
- Angular: OnPush change detection, signals for state, `input()`/`output()` functions, `inject()`, native control flow (`@if`, `@for`)

### Architecture
- `libs/core` is zero-dependency — interfaces, DTOs, enums, errors only
- All entities implement `IEntity { id, createdAt, updatedAt }`
- API error responses use `ErrorCode` enum + `AppError` type from core
- `Result<T>` for operations that can fail (no raw throw)
- Config validated at startup via zod — missing value = crash

### Security
- No hardcoded secrets — use `.env` (see `.env.example`)
- Auth via Better Auth (Google OAuth + JWT)
- All user input validated
- Error messages never leak internals

## Project Structure

```
apps/api/          Elysia REST API (Bun)
apps/web/          Angular 21 + PrimeNG 21 frontend
libs/core/         Shared types, interfaces, DTOs, enums (zero deps)
src/client.ts      MCP channel client (bridges Claude Code ↔ API)
docker/            docker-compose (PostgreSQL), Dockerfile configs
tools/             OpenAPI client generation script
```

## Commands

| Command | Description |
|---|---|
| `bun install` | Install all workspace dependencies |
| `bun run api:dev` | Start API dev server (port 3000) |
| `bun run web:dev` | Start Angular dev server (port 4200) |

| `bun run test` | Run all tests |
| `bun run generate:api-client` | Generate Angular API client from OpenAPI spec |
| `cd apps/api && bun run db:generate` | Generate Drizzle migrations |
| `cd apps/api && bun run db:migrate` | Apply migrations |
| `docker compose -f docker/docker-compose.yml up -d` | Start PostgreSQL + broker |

## CODING & INTERACTION NOTES

If you want to ask questions for more spec or other info always use AskUserQuestion tool.

## Memory Bank - Critical System

The Memory Bank is Claude's ONLY connection to the project between sessions. Without it, Claude starts completely fresh with zero knowledge of the project.

### How Memory Bank Works

1. **User triggers**: Type `mb`, `update memory bank`, or `check memory bank`
2. **Claude's process**:
   - Reads `memory-bank/README.md` and follows its instructions

### Important Rules

- Follow instructions in `memory-bank/README.md` - it defines what to read and when
- Memory Bank is the single source of truth - overrides any other documentation
