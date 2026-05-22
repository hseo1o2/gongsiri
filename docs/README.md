# docs/

설계 문서. 코드 작성 전 필독.

Pi bootstrap milestone의 repo-local source of truth 문서:
- `02-folder-structure.md` — phase-1 폴더 ownership과 canonical runtime root
- `03-interface-schema.md` — Python domain payload + Pi runtime bridge envelope 경계
- `04-env-vars.md` — PR1 env contract과 `.env.example` 작성 기준
- `05-feature-spec.md` — PR1 feature scope, acceptance criteria, out-of-scope
- `06-pi-agent-architecture.md` — Pi runtime/skill/tool/Python bridge architecture
- `07-pi-agent-contracts.md` — Pi request/response/tool/failure envelope contract
- `backend/openapi.json` — screen-MVP HTTP contract artifact for `/api/v1/reports`

현재 milestone 확장:
- G001 — bootstrap runtime + disclosure bridge
- G002 — trigger source(`user | system | cron`) + manual trigger + scheduler surface + local checkpoint detection
- `10-agent-pipeline-takeover-backlog.md` — deferred backlog and guardrails for the agent pipeline takeover
- `11-dev-db-contract.md` — #44/#43 dev SQLite schema, repository, and seed fixture contract for #27/#31/#32/#33
- `12-external-api-registry.md` — #34-#38 deterministic external adapter registry and data-plane boundary
- `13-end-to-end-state-matrix.md` — #41 auth→dashboard→watchlist→report detail→Q&A state coverage matrix
- `14-k-skill-distillation-guideline.md` — #45 k-skill distillation rule for adapter/prompt borrowing
