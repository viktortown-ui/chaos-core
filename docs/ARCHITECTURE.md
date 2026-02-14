# Architecture

## Folder structure
- `src/core`: pure domain logic and persistence behavior (`no React imports`).
- `src/containers`: feature modules. Each container has `ui/`, `model/`, and `manifest.ts`.
- `src/app`: app shell only (routing, layout, providers).
- `src/ui`: shared presentational components.
- `src/fx`: effects/hooks.

## Container registry pattern
- Every container exports a manifest describing route metadata and the screen component.
- `src/containers/registry.ts` is the single module registry consumed by app routing and nav.
- New feature containers must register their manifest in the registry to become routable.

## Data flow
1. App boots in `src/main.tsx` and mounts app-shell providers and router.
2. `ChaosCoreProvider` holds canonical app state.
3. Containers dispatch user intent while domain transitions execute via `src/core` functions.
4. State changes persist through storage helpers in `src/core/storage.ts`.

## Persistence schema (`v1`)
- `schemaVersion: 1`
- `xp: number`
- `stats: { strength, intelligence, wisdom, dexterity }`
- `lastCheckInISO: string | null`
- `settings: { reduceMotionOverride: boolean | null, soundFxEnabled: boolean }`

Storage supports fallback to defaults and migration of schema-less payloads into `v1`.
