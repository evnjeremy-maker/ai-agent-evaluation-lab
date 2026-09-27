# Evaluation Lab frontend

This is the React and TypeScript frontend for the local-first agent evaluation lab. It currently runs as a **synthetic, in-memory preview** because the FastAPI backend and committed OpenAPI contract do not exist yet. Reloading the page restores the sample workspace. No data is sent to a provider or persisted by the preview.

## Design direction

Reading this as a developer observability workspace, using the supplied Braintrust design reference for a white canvas, high contrast, restrained indigo, broad headings, and compact technical labels. Dials: **ENERGY 2 / RHYTHM 2 / MOTION 1**. Indigo identifies primary actions, selected navigation, and trace chronology. Wide suite summaries give way to denser run evidence because those screens ask different questions. Motion is limited to hover feedback and loading indication. Text replaces an invented logo, and synthetic data is labeled wherever it appears.

## Run locally

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The server binds to loopback. Use `npm run build` and `npm test` to verify the bundle and unit checks. With the dev server running in another terminal, use `npm run test:e2e` for Chrome browser flows and screenshots in `render/`.

## Implemented views

- Suite and case library with create, edit, duplicate, search, and deletion confirmation.
- Case revision editor with input messages, fixture JSON, evaluator settings, and unsaved-change warning.
- Agent profiles with FakeProvider connectivity feedback and no secret input.
- Run launcher, basic canonical trace preview validation, and synthetic serial run progression.
- Run list, trace and evaluator detail, redacted preview export, run deletion, and comparison.

The import UI performs preliminary client checks and redacts content before adding it to in-memory preview state. It does not replace the PRD's server validation, atomic import, or output-boundary redaction. The demo evaluator covers text containment, exact text, and simple tool sequence checks; JSON schema and external judging require the backend. Do not use this preview for private traces or credentials.

## Backend integration

When the backend is implemented, generate TypeScript API types from committed OpenAPI, replace the preview data provider with a typed `fetch` client, and bootstrap the same-origin mutation token from `/api/v1/session`. Server responses must own pagination, optimistic versions, idempotency, evaluation, redaction, and durable run state. Preserve the existing route and accessibility behavior when switching the data source.
