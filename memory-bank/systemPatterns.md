§MBEL:5.0

[ARCHITECTURE]
@pattern::Monorepo{Nx+pnpm}
@separation::apps/{api+web}+libs/{core}+src/{standalone:bun}

[COMPONENTS]
@broker::Bun:WebSocket{port:4000+message:routing+broadcast}
@mcp-client::Bun:MCP{channel:server+2:tools}
@api::NestJS+Fastify{REST+OpenAPI+JWT+GoogleAuth}
@web::Angular21+PrimeNG21{dashboard+monitoring}
@core::SharedLib{interfaces+DTOs+enums+errors}
@db::PostgreSQL+DrizzleORM{migrations+entities}

[DATA:FLOW]
ClaudeCode→MCP:client→WebSocket→broker→WebSocket→MCP:client→ClaudeCode
WebBrowser→Angular→HTTP→NestJS:API→PostgreSQL
NestJS:API→OpenAPI:spec→generated→Angular:client

[PATTERNS]
@entity::IEntity{id+createdAt+updatedAt}→all:entities:inherit
@repo::GenericRepository<T:extends:IEntity>→Drizzle
@controller::GenericController<T>→NestJS
@uow::UnitOfWork{multi:entity:transactions}
@enums::Everywhere{¬string:constants+serialize:asString}
@dtos::Readonly{immutable+spread:for:copies}
@errors::ErrorCode:enum+AppError+Result<T>
@auth::GoogleOAuth→JWT{generation+validation+interceptor}
@config::Zod:validated{fails:at:startup}
@logging::nestjs-pino{structured:JSON+file+console}
