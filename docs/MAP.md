# MAP

## Runtime map
- `src/main.tsx`: bootstraps React app + `BrowserRouter` with repo-aware basename.
- `src/app/providers/ChaosCoreProvider.tsx`: state orchestration between UI and core domain.
- `src/app/router/AppRouter.tsx`: route composition from feature registry.
- `src/app/layout/Layout.tsx`: shell + bottom navigation.

## Feature containers (`src/features/*`)
- `core`: daily check-in and progression loop.
- `quests`: placeholder container for upcoming quest systems.
- `profile`: progression overview.
- `settings`: local behavior toggles and data reset affordance.

## Domain core (`src/core/*`)
- `formulas.ts`: progression formulas (XP → level).
- `storage.ts`: persistence, migration, fallback behavior, daily check-in rules.
- `types.ts`: schema and domain typing contracts.
