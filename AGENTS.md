# Repository Guidelines

## Project Structure & Module Organization

`PRD.md` defines product behavior and release gates. `frontend/` contains the React and TypeScript preview: views in `src/pages/`, synthetic in-memory data in `src/model.ts`, Vitest checks in `src/*.test.ts`, Playwright flows in `e2e/`, and rendered screenshots in `render/`. No backend exists yet. When adding FastAPI, keep its API, services, worker, persistence, migrations, and tests in `backend/`. Commit OpenAPI before generating frontend API types. Follow the behavior and safety requirements in `PRD.md`.

## Build, Test, and Development Commands

From `frontend/`, run `npm ci` to install locked dependencies, `npm run dev` to serve the preview on `127.0.0.1:5173`, `npm run build` for TypeScript and production bundling, and `npm test` for Vitest. With the dev server running, `npm run test:e2e` checks browser flows and refreshes screenshots. The future backend should use `uv` and document migrations and loopback-bound Uvicorn commands. The credential-free `FakeProvider` demo must eventually run through the backend locally and in Docker.

## Coding Style & Naming Conventions

Use four-space indentation and `snake_case` for Python modules, functions, and variables; use `PascalCase` for React components and TypeScript types. Enable TypeScript strict mode and Pydantic strict validation. Follow Ruff formatting and lint rules once configured. Generate TypeScript API types from committed OpenAPI instead of maintaining duplicate DTOs. Keep database transactions short and provider calls outside write transactions.

## Testing Guidelines

Follow the PRD's red, green, refactor sequence for behavior changes. Use `*.test.ts(x)` for frontend logic and `*.spec.ts` for Playwright flows; name future Python tests `test_*.py`. Cover trace evidence, redaction, imports, cancellation, recovery, and API contracts. Use temporary SQLite databases for future backend integration tests. `FakeProvider` tests are release-blocking; live-provider tests are opt-in.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects such as `Add trace import validation`. In pull requests, describe the behavior changed, link the relevant PRD requirement or issue, list verification commands and results, and include screenshots for UI changes. Call out migration, security, and rollback effects when relevant.

## Security & Configuration

Keep provider credentials in backend environment variables resolved through configured aliases. Never commit secrets or include them in browser state, logs, traces, exports, or error responses. Keep local and Docker servers bound to loopback; public deployment needs the additional controls specified in `PRD.md`.
