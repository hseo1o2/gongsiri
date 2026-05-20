# 04. Environment Variables — Pi Bootstrap PR1

## Purpose
PR1에서 Pi runtime과 Python collector bridge가 기대하는 환경변수를 명확히 기록한다.

## Required Variables
### Pi runtime / Node side
- `UPSTAGE_API_KEY` — Upstage Solar runtime access key
- `UPSTAGE_MODEL` — optional model override
- `PYTHON_BIN` — optional Python executable override for bridge spawning
- `GONGSIRI_CONTRACT_VERSION` — optional contract version override; default policy is `v1`

### Python collector side
- `DART_API_KEY` — OpenDART disclosure API key

## Default Policy
- `PYTHON_BIN` is optional; if omitted, the runtime may use `python3` as the default executable policy.
- `GONGSIRI_CONTRACT_VERSION` may remain unset when code defaults to `v1`.
- Missing `DART_API_KEY` must produce a typed `missing_env` failure in the bridge response path.

## `.env.example` Policy
Root `.env.example` must document the PR1 bootstrap keys as:

```dotenv
UPSTAGE_API_KEY=
UPSTAGE_MODEL=
PYTHON_BIN=python3
GONGSIRI_CONTRACT_VERSION=v1
DART_API_KEY=
```

`agent/.env.example` may mirror the Pi-only subset, but the repo-root `.env.example` is the onboarding source of truth for PR1.

## Runtime Separation
- Pi runtime env controls orchestration and subprocess invocation.
- Python env controls disclosure fetch execution.
- stderr may contain diagnostics, but business output for the bridge must be machine-readable JSON on stdout only.
