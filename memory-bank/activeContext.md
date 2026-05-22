§MBEL:5.0

[FOCUS]
@state::PLAN
@task::j-new-project{scaffolding+allFoundations}

[PLAN:APPROVED]
?scaffold::Nx+pnpm:monorepo
?structure::apps/{api+web}+libs/{core}+src/{broker+client:existing}
?foundations::#16{all:applied}
?architecture::IEntity+genericRepo+genericController+UoW+enums+factories

[STRUCTURE]
apps/api/→NestJS+Fastify{config+auth+chat+health+common}
apps/web/→Angular21+PrimeNG21{features+shared+core+generated}
libs/core/→SharedTypes{interfaces+models+errors}
src/→ExistingBun{broker.ts+client.ts:unchanged}
tools/→OpenAPI:clientGeneration
docker/→docker-compose{PostgreSQL+services}

[NEXT:STEPS]
?1::UserRestart{MCP:tools:added→Angular+xmp4}
?2::AfterRestart→verify:libs:versions+scaffold
?3::Create:Nx:workspace+apps+libs
?4::Apply:all:16:foundations
?5::Verify:build+test+config+logging

[BLOCKERS]
!restart::User:needs→restart:session{MCP:tools:Angular+xmp4}
