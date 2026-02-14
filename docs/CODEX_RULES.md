# CODEX_RULES

1. Respect layer boundaries:
   - `src/core` — only TypeScript domain logic (no React imports).
   - `src/features/*` — isolated feature containers (UI + calls into core).
   - `src/app/*` — routing/layout/providers only.
2. Keep GitHub Pages pathing aligned:
   - Vite `base` must resolve to `/<repo>/`.
   - Router basename must use the same resolved base path.
3. Keep lockfile committed (`package-lock.json`) and use `npm ci` in CI.
4. Before finalizing, run quality gates: `npm test` and `npm run build`.
5. Update docs + README when architecture or deployment flow changes.
