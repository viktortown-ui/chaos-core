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
