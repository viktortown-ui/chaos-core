# PLAN

## v0.1 (current hardening)
- Confirm stack baseline: Vite + React + TypeScript.
- Keep `package-lock.json` committed for deterministic `npm ci`.
- GitHub Pages readiness:
  - Vite `base` = `/<repo>/`
  - React Router `basename` = `/<repo>/`
  - Deploy via GitHub Actions Pages workflow.
- Enforce architecture boundaries:
  - `src/core` = pure TS domain logic
  - `src/features/*` = isolated feature containers
  - `src/app/*` = routing/layout/providers only
- Protect core rules with tests:
  - XP → Level formula
  - daily check-in (one per day)
  - storage schema fallback + migration

## v0.2
- Expand quest mechanics and rewards.
- Add deeper progression signals in profile.

## v0.3
- Add bosses and risk/reward loops.
- Balance progression pacing.
