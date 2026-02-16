# ARCHITECTURE

## Layers
- `src/core`: framework-agnostic TypeScript domain logic. No React imports.
- `src/features/*`: isolated feature containers (UI + interactions with `src/core`).
- `src/app/*`: composition layer only (routing, layout, providers).

## Feature registration
- Each feature exports a manifest.
- `src/features/registry.ts` is the single source of routable feature metadata.
- App routing and navigation read from the registry to avoid duplicated route config.
- Navigation visibility is controlled per manifest (`showInNav`).

## Data flow
1. App bootstraps in `src/main.tsx` with `BrowserRouter` basename aligned to Vite base.
2. `ChaosCoreProvider` owns in-memory app state and invokes core-domain transitions.
3. `AppRouter` gates non-onboarding routes until onboarding is completed.
4. Feature UIs dispatch intents.
5. Persistence is handled through `src/core/storage.ts`.

## Persistence schema policy
- Current schema: `v2`.
- New data fields: `onboarding`, `profile`, and `history`.
- Unsupported schema versions: fallback to defaults.
- Schema-less legacy payloads and `v1` payloads: migrate forward to `v2` with safe defaults while preserving known values.

## Simulation/Oracle model contract
- Monte Carlo quantiles are computed via `quantileSorted` (linear interpolation on sorted values).
- Success criterion is explicit: world passes if `finalScore >= successThreshold`.
- UI exposes normalized "Level 0-100" for readability, while raw score remains available in Advanced diagnostics.
