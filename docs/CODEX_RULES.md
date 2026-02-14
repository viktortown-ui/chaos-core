# CODEX RULES

For future agents working on Chaos Core:

1. Keep architecture boundaries strict:
   - `src/core` has no React imports.
   - `src/containers` houses feature modules (`ui/`, `model/`, `manifest.ts`).
   - `src/app` is only routing/layout/providers.
2. Run quality gates before finalizing: `npm ci`, `npm test`, `npm run build`.
3. Keep changes small and intentional (PR-like slices).
4. Do not rewrite unrelated files.
5. Maintain English-only UI and documentation.
