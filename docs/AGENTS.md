# Agent Notes

Repo-local notes for coding agents working on this snapshot.

## Source of truth

- Prefer local code over stale docs when behavior differs.
- Use `rg`/`git grep` to verify routes, env names, ports and file paths.
- API routes live under `backend/app/api/v1/endpoints` and are mounted by `backend/app/api/api.py`.
- Frontend routes live in `frontend/src/App.tsx`.
- Docker ports/env live in `docker-compose.yml` and `docker-compose.prod.yml`.

## Documentation rule

When editing code, update docs in the same change:

- Backend route changes -> `docs/API_REFERENCE.md`.
- Docker/env/port changes -> `README.md`, `docs/QUICK_START.md`, `docs/STARTUP_GUIDE.md`.
- Frontend route/client changes -> `docs/FRONTEND_INTEGRATION.md`.
- Gateway behavior changes -> `docs/GATEWAY_QUICKSTART.md`, `gateway/README.md`.
- RAG/parser changes -> `docs/ADVANCED_RAG_FEATURES.md`, `docs/PDF_PARSING.md`.

## External docs

If a Context7 or similar docs MCP is available in a future environment, use it for framework/library references. If it is not configured, do not block the task; rely on local code and official docs only when browsing/network access is explicitly available.
