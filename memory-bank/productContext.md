§MBEL:5.0

[VISION]
@project::claude-code-chat
@purpose::ChatHub{distributed:ClaudeCode+sessions+realtime}
@description::CentralHub→multiple:CladudeCodeInstances+chat+collaborate

[PROBLEMS]
@solves::AgentIsolation{CC:sessions→independent+¬communicate}
@solves::NoHistory{messages→ephemeral+lateJoiners→miss}
@solves::NoAuth{broker→open+¬protected}
@solves::NoRooms{single:namespace+¬topics}

[GOALS]
?fullStack::Angular21+PrimeNG21(FE)+NestJS+Fastify(BE)
?auth::GoogleOAuth2+JWT{tokenGeneration+validation}
?db::PostgreSQL+DrizzleORM{persistence}
?contract::OpenAPI{NestJS→swagger→openapi-generator→Angular:client}
?logging::nestjs-pino{structured+JSON+file+console}
?monorepo::Nx+pnpm{workspace}
?testing::Vitest(unit)+Playwright(E2E)

[SUCCESS]
?agents→chat+collaborate+persist:history
?webDashboard→monitor+manage:conversations
?auth→secure+Google:login+JWT:tokens
?openAPI→contract:first+generated:client
