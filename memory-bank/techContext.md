§MBEL:5.0

[STACK]
@runtime::Bun{everything+single:runtime}
@fe::Angular21+PrimeNG21
@be::Elysia{Bun-native+@elysiajs/swagger+OpenAPI}
@db::PostgreSQL+DrizzleORM{bun-sql:driver:native}
@auth::BetterAuth{GoogleOAuth+JWT:plugin+@better-auth/drizzle-adapter}
@contract::@elysiajs/swagger→openapi-generator-cli→Angular:typed:client
@logging::pino{structured:JSON+file+console}
@broker::Bun{native:WebSocket+standalone}
@mcp-client::Bun{MCP:SDK+standalone}
@monorepo::Nx+bun:workspaces
@testing::Vitest(unit)+Playwright(E2E)

[VERIFIED:xmp4]
✓ elysia/elysia{23K:symbols}→Bun-native:framework
✓ drizzle-orm{236K:symbols}→bun-sql:driver:native:PostgreSQL
✓ better-auth{131K:symbols}→Google:OAuth+JWT:plugin+Drizzle:adapter

[EXISTING:CODE]
@src/broker.ts::Bun:WebSocket:server{port:4000+routing+broadcast}
@src/client.ts::MCP:channel:server{send_message+list_participants}
@package.json::Bun:deps{@modelcontextprotocol/sdk+zod}
@docker/::Docker:setup{entrypoint+mcp.json}
@start-collab.sh::tmux:launcher{3agents+broker}
@stop-collab.sh::cleanup:script

[DECISIONS]
@packageManager::bun(single:runtime+fastest)
@beFramework::Elysia(Bun-native+OpenAPI+type-safe)
@auth::BetterAuth(¬manual:passport+complete:solution)
@orm::DrizzleORM+bun-sql(native:Bun:driver)
@feFramework::Angular21+PrimeNG21(latest:stable)
@jsonSerialization::asIs(¬camelCase¬snakeCase)

[COMMANDS]
?install::bun install
?build::nx build api | nx build web
?test::nx test api | nx test web
?serve::nx serve api | nx serve web
?broker::bun run src/broker.ts
?generate-client::tools/generate-api-client.sh
