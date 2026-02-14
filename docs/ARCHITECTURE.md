# ARCHITECTURE

## Layers
- `src/core`: framework-agnostic TypeScript domain logic. No React imports.
- `src/features/*`: isolated feature containers (UI + interactions with `src/core`).
- `src/app/*`: composition layer only (routing, layout, providers).

## Feature registration
- Each feature exports a manifest.
- `src/features/registry.ts` is the single source of routable feature metadata.
- App routing and navigation read from the registry to avoid duplicated route config.

## Data flow
1. App bootstraps in `src/main.tsx` with `BrowserRouter` basename aligned to Vite base.
2. `ChaosCoreProvider` owns in-memory app state and invokes core-domain transitions.
3. Feature UIs dispatch intents.
4. Persistence is handled through `src/core/storage.ts`.

## Persistence schema policy
- Current schema: `v1`.
- Unsupported schema versions: fallback to defaults.
- Schema-less legacy payloads: migrate forward to current schema with safe defaults.
