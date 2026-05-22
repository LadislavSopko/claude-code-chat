§MBEL:5.0

[STACK]
@runtime::Bun:1.3.14{single:runtime+everything}
@fe::Angular:21.2+PrimeNG:21{Aura:theme}
@be::Elysia:1.3{Bun-native+@elysiajs/swagger+@elysiajs/cors}
@db::PostgreSQL:17+DrizzleORM:0.44{postgres.js:driver}
@auth::BetterAuth:1.2{GoogleOAuth+JWT+drizzle-adapter}
@contract::@elysiajs/swagger→openapi-generator-cli→Angular:typed:client
@logging::pino:9{structured:JSON+pino-pretty:dev}
@broker::Bun:native:WebSocket{standalone:port:4000}
@mcp-client::Bun:MCP:SDK{standalone+channel:server}
@monorepo::Bun:workspaces{apps/*+libs/*}
@testing::Vitest:4(Angular:built-in)+bun:test(API)
@node::v22.21.0{installed+Angular:CLI:needs:it}

[VERIFIED:xmp4]
✓ elysia/elysia{23K:symbols}→Bun-native:framework
✓ drizzle-orm{236K:symbols}→bun-sql+postgres.js:drivers
✓ better-auth{131K:symbols}→Google:OAuth+JWT:plugin+Drizzle:adapter

[PROJECT:STRUCTURE]
@root::package.json{workspaces:apps/*+libs/*}
@apps/api/::Elysia{config+auth+chat+health+common+db}
@apps/web/::Angular21+PrimeNG21{features+shared+core+generated}
@libs/core/::SharedTypes{interfaces+models+errors+enums}(zero:deps)
@src/broker.ts::Bun:WebSocket:server{port:4000+routing+broadcast}
@src/client.ts::MCP:channel:server{send_message+list_participants}
@docker/::docker-compose{PostgreSQL+broker}
@tools/::generate-api-client.sh{OpenAPI→Angular}

[DECISIONS]
@packageManager::bun{single:runtime+bun:install}
@beFramework::Elysia{¬NestJS+Bun-native+OpenAPI+type-safe}
@auth::BetterAuth{¬manual:passport+complete:solution}
@orm::DrizzleORM+postgres.js{¬bun-sql:driver→postgres.js:more:mature}
@feFramework::Angular21+PrimeNG21{latest:stable+@primeng/themes:21.0.4}
@jsonSerialization::asIs{¬camelCase¬snakeCase}
@methodology::TDDAB{TestDrivenDevelopment:AtomicBlock}

[COMMANDS]
@install::bun install
@api:dev::bun run api:dev{port:3000}
@web:dev::bun run web:dev{port:4200}
@broker:dev::bun run broker:dev{port:4000}
@test::bun run test
@build:api::bun run api:build
@build:web::cd apps/web && ./node_modules/.bin/ng build
@db:generate::cd apps/api && bun run db:generate
@db:migrate::cd apps/api && bun run db:migrate
@generate-client::bash tools/generate-api-client.sh
@docker:up::docker compose -f docker/docker-compose.yml up -d
