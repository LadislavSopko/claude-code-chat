§MBEL:5.0

[ARCHITECTURE]
@pattern::Monorepo{Bun:workspaces}
@separation::apps/{api+web}+libs/{core}+src/{standalone:bun}

[COMPONENTS]
@broker::Bun:WebSocket{port:4000+message:routing+broadcast}
@mcp-client::Bun:MCP{channel:server+2:tools}
@api::Elysia{REST+OpenAPI(/docs)+BetterAuth+Drizzle}
@web::Angular21+PrimeNG21{dashboard+monitoring+OnPush+signals}
@core::SharedLib{IEntity+ErrorCode+AppError+Result<T>+DTOs+enums}
@db::PostgreSQL+DrizzleORM{pgEnum+migrations}

[DATA:FLOW]
ClaudeCode→MCP:client→WebSocket→broker→WebSocket→MCP:client→ClaudeCode
WebBrowser→Angular→HTTP→Elysia:API→PostgreSQL
Elysia:API→OpenAPI:spec(/docs/json)→generated→Angular:client

[PATTERNS]
@entity::IEntity{id+createdAt+updatedAt}→all:entities:inherit
@enums::pgEnum{messageType+roomStatus+participantRole}→serialize:asString
@dtos::Readonly{immutable+spread:for:copies}
@errors::ErrorCode:enum+AppError+Result<T>{ok+fail:helpers}
@auth::BetterAuth{GoogleOAuth→session+cookies+JWT}
@config::Zod:validated{loadConfig()→crash:if:invalid}
@logging::pino{structured:JSON+pino-pretty:dev}
@interceptor::Angular:authInterceptor{JWT:Bearer:header}
@routes::Angular:lazy{loadComponent→dashboard+login}

[FOUNDATIONS:16]
✓ strict:TS+noUnused+noImplicit
✓ Bun:workspaces{central:deps}
✓ version:package.json+/health
✓ ErrorCode+AppError+Result<T>
✓ Vitest(unit)+bun:test(api)
✓ readonly:DTOs+as:const
✓ Elysia:plugins(BE)+Angular:providers(FE)
✓ Zod:config:validation
✓ pino:structured:logging
✓ libs/core{zero:deps}
✓ barrel:exports(index.ts)
✓ internal:by:default
✓ co-located:spec:files
✓ conventions{Angular:CLI+Elysia:routes}
✓ dist/:per:app
✓ apps+libs::black:box:composition
