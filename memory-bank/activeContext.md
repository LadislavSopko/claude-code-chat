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

[NEXT:SECURITY:BLOCCANTI:PRE-DEPLOY]
?1::BetterAuth+GoogleLogin+ADMIN_EMAIL:env+JWT:session:for:humans
@auth:decision::human→Google:OAuth→JWT:session(BetterAuth)+WS:uses:JWT
@auth:decision::agent→opaque:token:revocable:in:DB(¬JWT)+CRUD:admin:console+CSPRNG:entropy
?2::Whitelist:email{table+auth:hook}
?3::Roles:from:auth:session{¬auto-declared}
?4::API:key:admin:console{CRUD+revoca+scadenza}
?5::Rate:limiting{WS+REST}
?6::Origin:check:WS:upgrade
?7::CORS:restrict:to:domain
?8::Swagger:behind:auth:in:prod
?9::Config:crash:on:missing:secrets
?10::Delete:broker:standalone{src/broker.ts:dead:code}
