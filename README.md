# Chaos Core

Chaos Core is an offline-friendly daily growth app with a compact progression loop.

## Stack
- Vite + React + TypeScript
- React Router
- Vitest + Testing Library
- GitHub Pages deployment via GitHub Actions

## Local setup
```bash
npm ci
npm run dev
```

## Quality gates
```bash
npm test
npm run build
```

## Architecture
- `src/core`: pure TS domain logic (formulas/rules/storage).
- `src/features/*`: isolated feature containers (UI + calls into core).
- `src/app/*`: routing/layout/providers only.

## GitHub Pages deployment
The project is configured for Pages project-path hosting:
- Vite `base` resolves to `/<repo>/`.
- React Router `basename` uses `import.meta.env.BASE_URL` (same value).
- Workflow: `.github/workflows/pages.yml` (build + deploy to GitHub Pages).

### Steps
1. Push to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Ensure default branch is `main` (or adjust workflow trigger).
4. Push to `main` to trigger deployment.

## Docs
- [Plan](docs/PLAN.md)
- [Map](docs/MAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Codex Rules](docs/CODEX_RULES.md)
- [UX Notes](docs/UX_NOTES.md)
