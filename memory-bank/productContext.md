§MBEL:5.0

[VISION]
@project::claude-code-chat
@purpose::ChatHub{distributed:ClaudeCode+sessions+realtime}
@description::CentralHub→multiple:ClaudeCodeInstances+chat+collaborate+persist

[PROBLEMS]
@solves::AgentIsolation{CC:sessions→independent+¬communicate}
@solves::NoHistory{messages→ephemeral+lateJoiners→miss}
@solves::NoAuth{broker→open+¬protected}
@solves::NoRooms{single:namespace+¬topics}

[GOALS]
@fullStack::Angular21+PrimeNG21(FE)+Elysia+Bun(BE)
@auth::GoogleOAuth2+JWT{BetterAuth+DrizzleAdapter}
@db::PostgreSQL+DrizzleORM{persistence+migrations}
@contract::OpenAPI{@elysiajs/swagger→openapi-generator→Angular:client}
@logging::pino{structured+JSON}
@monorepo::Bun:workspaces{apps+libs}
@testing::Vitest(unit)+Playwright(E2E)

[SUCCESS]
?agents→chat+collaborate+persist:history
?webDashboard→monitor+manage:conversations
?auth→secure+Google:login+JWT:tokens
?openAPI→contract:first+generated:client
