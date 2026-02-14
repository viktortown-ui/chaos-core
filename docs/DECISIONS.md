# DECISIONS

## 2026-02-14 — GitHub Pages path should be repo-aware
- **Decision:** Compute Vite `base` as `/<repo>/` from `GITHUB_REPOSITORY` (fallback `chaos-core`), and bind React Router basename to `import.meta.env.BASE_URL`.
- **Why:** Ensures consistent behavior on GitHub Pages across forks/renames without hand-editing path constants.
- **Impact:** Build output URLs and router navigation stay aligned in local builds and Actions builds.

## 2026-02-14 — Keep lockfile under version control
- **Decision:** Commit and maintain `package-lock.json`.
- **Why:** Required for reliable `npm ci` and reproducible CI.
- **Impact:** Deterministic dependency graph in local/CI environments.

## 2026-02-14 — Feature-container architecture boundary
- **Decision:** Use `src/features/*` as isolated feature containers and keep `src/app/*` composition-only.
- **Why:** Prevents domain/UI entanglement and keeps scaling path clear.
- **Impact:** Routing/nav driven by feature registry, while domain rules remain centralized in `src/core`.

## 2026-02-14 — Onboarding with progressive disclosure
- **Decision:** Add a 3-step first-run onboarding flow (path selection, focus stat, ready summary) and gate main routes until completion.
- **Why:** New users need immediate context and a single starting action without overwhelming UI density.
- **Impact:** First-run clarity improves, onboarding completion is persisted, and a one-time initialization toast confirms success.

## 2026-02-14 — Include deterministic demo data
- **Decision:** Add a “Load demo data” control in Settings that seeds a predictable non-empty snapshot.
- **Why:** Empty state slowed initial comprehension; seeded data communicates system shape within ~60 seconds.
- **Impact:** Users can explore progression/history instantly and still clear data with reset controls.
