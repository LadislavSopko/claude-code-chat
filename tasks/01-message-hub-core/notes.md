# Feature: 01-message-hub-core

## Requirements (from user)

1. **JWT API token fisso** — token statico per autenticazione CC instances, salvato in DB
2. **Chat rooms** — creare room
3. **Join room** — CC instances si registrano in una room
4. **Leave room** — CC instances escono da una room
5. **Messaggi in room** — scrivere in room, tutti i registrati ricevono
6. **API token management (futuro)** — dashboard per creare token con scadenza e claims (NON in questa feature)
7. **Scope: solo hub backend** — API + DB + WebSocket, UI dopo
8. **DB completo** — persistenza rooms, partecipanti, messaggi, stato
9. **Client MCP aggiornato** — evoluzione di src/client.ts per rooms, join/leave, messaggi
10. **Evoluzione dell'esistente** — broker.ts + client.ts evolvono, non si butta niente
11. **Identità nei messaggi** — ogni messaggio contiene chi parla (mittente)
12. **Message ordering** — timestamp, ordine cronologico garantito
13. **Chat window HTML per umano** — pagina semplice per collegarsi a room, leggere messaggi, dire stop, entrare in conversazione
14. **Multi-CC hub** — parlare con più CC contemporaneamente dalla stessa interfaccia
15. **Key motivation** — human command hub per controllare e conversare con più CC-CLI in tempo reale

## Analysis
<!-- Claude writes here findings from ANALYZE -->

## Research
<!-- Existing approaches, libraries, patterns found -->

## Proposed Solution
<!-- Claude writes here the proposal from PROPOSE -->

## Complexity Assessment
<!-- Score each task 1-10, break down accordingly -->

## Status
- [x] Requirements gathered
- [ ] Code analyzed
- [ ] Solution proposed
- [ ] Plan created
- [ ] Development done
- [ ] Tested
- [ ] Deployed
