# UX_NOTES

- Keep the core loop lightweight: one clear daily check-in action.
- Prioritize readability over density (especially on mobile).
- Preserve fast navigation between feature containers via bottom nav.
- Ensure progression feedback is immediate (XP/level/stat updates after check-in).
- Avoid introducing UI complexity inside `src/core`; domain remains UI-agnostic.

## Life-OS Simulation / Oracle (2026 refresh)

- Simulation is now framed as a **scenario library** (layoff, wedding, deal, mortgage, relocation, custom).
- Users choose an **objective selector** before running worlds: finance, energy, composite, scenario goal.
- Result HUD must show only human KPIs by default:
  - chance to pass goal (%),
  - typical outcome (median),
  - bad outcome (worst 10%),
  - good outcome (best 10%),
  - most common failure window,
  - risk price (spread/fog).
- Advanced details keep raw terms (P10/P50/P90/raw-score/sigma equivalents) inside collapsible Advanced only.
- Wording changed from resilience-as-good to **predictability/spread** to avoid "stably bad = stable" confusion.
