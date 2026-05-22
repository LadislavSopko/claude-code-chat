§MBEL:5.0

[security-hardening]
@state::COMPLETED
@date::2026-05-22

[DONE]
✓ config:hardened{¬default:secrets+ADMIN_EMAIL+NODE_ENV+ALLOWED_ORIGINS+rate:limits}
✓ broker:standalone:deleted{src/broker.ts+docker+script}
✓ BetterAuth:wired{/api/auth/*+bearer+admin:plugins+databaseHooks+schema:mapping}
✓ whitelist:email{table+hook:rejects:non:whitelisted+admin:always:allowed}
✓ roles:from:auth{¬clientType+API:key=AGENT+session=HUMAN|OWNER}
✓ admin:console{/api/admin/*+session+admin:guard+CRUD:keys+whitelist+revoke:closes:WS}
✓ rate:limiting{REST+WS:connect+WS:message}
✓ origin:check+CORS:restricted{production:only}
✓ swagger:gated{¬production}
✓ tests:ALL:pass{64/64+config+rateLimiter+whitelist+roomState+wsRoles+wsDm}
✓ WeakMap:bug:fixed{getClientEntry:fallback:in:ws:message:handler}
✓ BetterAuth:schema:fixed{text:IDs+banned+banReason+banExpires}
✓ OAuth:Google:verified{tester:account:login:works:in:browser}
✓ DB:migrations:clean{0000+0001+0002+0003:applied:both:main+test}

[PENDING:PHASE5]
? TDDAB-1::/api/keys:for:all:users
? TDDAB-2::admin:whitelist:refactor
? TDDAB-3::chat:page:login:gate+UI
? TDDAB-4::E2E:tests
