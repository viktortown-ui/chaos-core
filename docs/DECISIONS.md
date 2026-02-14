# DECISIONS

## 2026-02-14 - Lockfile + CI install strategy
- **Decision:** Keep GitHub Actions using `npm ci` and add committed `package-lock.json`.
- **Why:** `npm ci` requires a lockfile and gives reproducible installs, which stabilizes CI and Pages builds.
- **Impact:** Local and CI installs are deterministic.

## 2026-02-14 - App shell and container registry split
- **Decision:** Move routing/layout/providers into `src/app` and introduce container manifests with `src/containers/registry.ts`.
- **Why:** Enforces clean boundaries and creates a minimal module-registry extension point.
- **Impact:** Route/nav configuration now flows from manifests instead of duplicated hardcoded lists.

## 2026-02-14 - Storage migration behavior
- **Decision:** `loadCoreData` migrates schema-less payloads into schema v1 and falls back to defaults for unsupported versions.
- **Why:** Prevents user data loss for older/local experimental payloads while protecting against incompatible schema changes.
- **Impact:** Storage behavior is now explicitly tested for fallback and migration.
