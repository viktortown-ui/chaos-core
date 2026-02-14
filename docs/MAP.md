# MAP

## Runtime map
- `src/main.tsx`: bootstraps React app + `BrowserRouter` with repo-aware basename.
- `src/app/providers/ChaosCoreProvider.tsx`: state orchestration between UI and core domain.
- `src/app/router/AppRouter.tsx`: route composition from feature registry + onboarding gate.
- `src/app/layout/Layout.tsx`: shell, toast surface, and bottom navigation.

## Feature containers (`src/features/*`)
- `core`: daily check-in and progression loop.
- `onboarding`: first-run setup (path + focus stat, skippable, completion write-back).
- `glossary`: in-app help/definitions for key terms.
- `quests`: placeholder container for upcoming quest systems.
- `profile`: progression overview.
- `settings`: local behavior toggles, onboarding rerun, demo data controls, and reset affordance.

## Domain core (`src/core/*`)
- `formulas.ts`: progression formulas (XP → level).
- `storage.ts`: persistence, migration, fallback behavior, daily check-in rules, demo snapshot generation.
- `types.ts`: schema and domain typing contracts.
