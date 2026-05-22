§MBEL:5.0

[FOCUS]
@state::DEVELOP
@feature::01-message-hub-core
@branch::feature/01-message-hub-core

[COMPLETED]
✓ Phase1::6:TDDAB{API:key+CRUD+WS:hub+persistence+MCP:client+HTML:chat}
✓ Phase2::5:TDDAB{join:by:name+roles+DM+reconnection+chat:improvements}
✓ Phase3::3:TDDAB{OWNER/HUMAN/AGENT:roles+DM:visibility+pin:UI}
✓ DM:fix::meta.dm:broke:CC:notifications→moved:to:content
✓ Test:DB::separate:claude_chat_test{¬delete:live:data}
✓ Agent:infra::researcher+critic+shared:config+start.sh
✓ Security:analysis::9:bloccanti+7:critic:additions
✓ Security:backend::ALL:10:blockers{BetterAuth+whitelist+roles+admin+rateLimiter+CORS+origin+swagger+config+broker:deleted}
✓ Bug:fix::WeakMap:ws:object:different:in:open:vs:message→fallback:via:getClientEntry
✓ Bug:fix::BetterAuth:schema{uuid→text:IDs+banned:fields:for:admin:plugin}
✓ OAuth:e2e::Google:login:verified:in:browser{tester@0ics.srl.tester}
✓ Tests::64/64:pass{config:7+rateLimiter:6+whitelist:4+roomState:12+wsRoles:4+wsDm:3+rest:28}

[NEXT:PHASE5:UI+AUTH:TDDAB]
@plan::tasks/01-message-hub-core/plan-phase5-ui-auth.md
?TDDAB-1::/api/keys{session:guard+CRUD:own:keys+any:logged:user}
?TDDAB-2::admin:whitelist:refactor{remove:apiKey:CRUD:from:admin+keep:whitelist:only}
?TDDAB-3::chat:page:login:gate{¬loggato→solo:Login+loggato→chat+keys+admin→whitelist}
?TDDAB-4::E2E:Chrome:DevTools{login+keys+whitelist+non-admin}

[KEY:DECISIONS]
@auth::ADMIN_EMAIL=0ics.srl.tester@gmail.com(only:real:user:for:now)
@keys::tutti:umani:loggati:possono:creare:API:keys(¬solo:admin)
@whitelist::solo:admin:gestisce:whitelist:email
@db::PostgreSQL:porta:5434:via:container:claude-chat-pg
@ws:bug::Elysia:passa:diverso:ws:wrapper:a:open:vs:message→WeakMap:fallback:necessario
