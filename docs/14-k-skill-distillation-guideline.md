# 14. k-skill Distillation Guideline

## Purpose

Issue #45 defines how this repo may learn from k-skill without adopting it as a dependency or copying it wholesale.

Core rule:
- **k-skill은 dependency adoption 대상이 아니라 distillation source다.**

## Non-negotiable rules

1. **No dependency install solely for k-skill**
   - k-skill package/plugin/runtime must not be added to repo dependencies.
   - ideas may be referenced; shipped code must be rewritten into gongsiri-owned contracts.

2. **Map every borrowed idea to our SoT docs**
   - data-plane adapter ideas -> `docs/12-external-api-registry.md`
   - backend↔agent boundary ideas -> `docs/03-interface-schema.md`, `docs/06-pi-agent-architecture.md`, `docs/07-pi-agent-contracts.md`
   - env/rate/error ownership -> `docs/04-env-vars.md`

3. **Re-own auth, rate, error, and output policy**
   - endpoint shape, auth keys, rate-limit behavior, and typed error mapping must be authored in this repo.
   - upstream wording or raw payload shape must not leak through unreviewed.

4. **Reasoning belongs to 공시리, facts belong to adapters**
   - if a borrowed idea fetches deterministic facts, it must become a backend adapter contract.
   - if a borrowed idea explains, rewrites, or interprets, it belongs on the 공시리 agent skill/tool boundary instead.

## Distillation checklist

Before using an idea inspired by k-skill, record:
- source file/url/name
- borrowed idea in one sentence
- transformed local contract (`source_id`, endpoint, schema, or agent mode)
- owner lane (A / B / C)
- tests that prove the transformed contract
- explicit note that no k-skill dependency was added

## Example mappings

| Distillation source idea | Local ownership target |
| --- | --- |
| korean-stock search query shape | `krx_stock_search` registry row + `GET /api/stocks/search` |
| trade-info price/volume semantics | `krx_trade_info` snapshot schema |
| remote throttle expectation | typed `rate_limited` adapter state in backend wrappers |
| prompt wording for explanation | 공시리 agent mode prompt, not backend collector |

## Anti-patterns

- copying k-skill code into a `utils` file with light renames
- adding a package just because k-skill already uses it
- exposing raw upstream payloads to frontend or agent
- letting agent prompts browse/fetch what a deterministic adapter should return

## Review rule

Every PR that references k-skill inspiration should answer:
- What was distilled?
- Which gongsiri contract now owns it?
- Which test proves the transformed behavior?
- Which dependency was *not* adopted?
