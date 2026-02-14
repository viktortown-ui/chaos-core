# Architecture

## Folder structure
- `src/core`: domain logic, formulas, storage schema/types
- `src/containers`: route-level screens and app state provider
- `src/ui`: reusable UI components
- `src/fx`: effects hooks (reduced-motion support)
- `src/modules`: extension point for future modules

## Data flow
1. App boots and loads local data from `localStorage`.
2. `ChaosCoreProvider` holds canonical state.
3. Screen actions mutate state via pure functions in `src/core`.
4. State changes persist back to `localStorage`.

## Persistence schema (`v1`)
- `schemaVersion: 1`
- `xp: number`
- `stats: { strength, intelligence, wisdom, dexterity }`
- `lastCheckInISO: string | null`
- `settings: { reduceMotionOverride: boolean | null, soundFxEnabled: boolean }`
