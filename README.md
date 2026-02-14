# Chaos Core

Chaos Core is a focused, offline-friendly daily growth app with a simple core loop.

## Stack
- Vite + React + TypeScript
- React Router
- Vitest + React Testing Library
- ESLint
- PWA via `vite-plugin-pwa`

## Local development
```bash
npm ci
npm run dev
```

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
- `npm run lint`
- `npm run smoke:preview`

## Deploy to GitHub Pages
1. Push this repository to GitHub under the `main` branch.
2. In GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` to trigger `.github/workflows/pages.yml`.
4. Open the generated Pages URL after deployment completes.

The app is preconfigured for Pages project path `/chaos-core/` via Vite base path and router basename.

## Docs
- [Plan](docs/PLAN.md)
- [Map](docs/MAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [UX Notes](docs/UX_NOTES.md)
- [Codex Rules](docs/CODEX_RULES.md)
