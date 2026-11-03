# Development plan and tests

Incremental phases. At the end of each phase, run its tests before moving on. What to build is
in `SPEC.md`. All names (files, data nodes, identifiers) are in English.

## Phase 0 - Base structure + i18n scaffolding
Goal: the site skeleton and the translation layer.
- Create `index.html`, `css/styles.css` and the `js/*.js` files per SPEC section 2.
- Define CSS theme tokens (light/dark) and the responsive layout.
- i18n: create `i18n/translations.json` (es + en) and `js/i18n.js` with `t(key)` and
  `setLang(lang)`; default language `es` from localStorage (wrapped in try/catch); add the
  language switch in the header. Every visible string must go through `t()`.
- Replace any old `index.html`; this folder should contain only the new app.

Tests:
- The page opens locally with no console errors.
- Header and cards show in a "loading" state (no data yet).
- The language switch flips a sample label between ES and EN, and the choice survives a reload.

## Phase 1 - Data layer (as-if-API)
Goal: render real data, still without Firebase.
- Implement `js/data.js` with the endpoint functions (SPEC section 9). To progress without
  Firebase, they may temporarily read `reelforge.json` locally with fetch; this switches to RTDB
  in Phase 3 without touching charts.
- Render the KPI row and the figures, all labels via `t()`.

Tests:
- The six KPIs show correct value and delta, colored by sign.
- Formatting is correct (thousands, currency, percentages).
- KPI labels change with the language switch.

## Phase 2 - Charts and interactions
Goal: all visual sections.
- `js/charts.js`: finance (lines + period + tooltip), mix, funnel, games (toggle
  plays/searches), creators, responsible gaming.

Tests:
- Each chart draws with a correct scale and labels that neither overlap nor get cut off.
- The 12/6/3 filter changes Finance and Creators.
- Tooltips show the correct values; month names follow the selected language.
- At ~400px everything stacks into one column, no horizontal scroll.

## Phase 3 - Firebase live + presence
Goal: live data and connected viewers.
- Connect `js/data.js` to RTDB (onValue). Implement `js/presence.js` (anonymous auth,
  `/presence/<uid>`, onDisconnect). Create `database.rules.json`.
- Julio's prerequisite: project created, RTDB and anonymous auth enabled, `reelforge.json`
  imported, and the real config pasted into `js/firebase-config.js`.

Tests:
- Changing a number in the Firebase console updates the dashboard with no reload.
- With two tabs open, the connected counter shows 2; closing one drops it to 1.
- Rules: public read works; a write attempt to /kpis is rejected.

## Phase 4 - Visual polish
Goal: investor-panel quality.
- Command-center style, clear hierarchy, light/dark theme, demo-data badge, polished
  loading/empty/error states.

Tests:
- Both themes legible; nothing misaligned on desktop or mobile.
- The first view (no scroll) already communicates the state of the business.
- Switching language re-renders everything (titles, KPI labels, months, badge) with no leftover
  hard-coded strings.

## Phase 5 - Deploy to GitHub Pages
Goal: a public URL that opens only the page.
- `git init`; repo on GitHub (may be **private**; the page is served **public**).
- If the site is not at the repo root, move the contents of `dashboard/` to the root (so
  `index.html` is at the root) or point Pages at that folder.
- Settings -> Pages -> deploy from branch `main`, root folder.

Tests:
- The public URL opens the dashboard and loads with no errors (relative paths, allowed CDNs).
- Firebase responds from the GitHub Pages domain (if the apiKey was restricted by referrer,
  include that domain).

## Appendix A - Acceptance criteria (rubric)
So no points are lost; already covered by the phases:
- Hyper-relevant KPIs: users online, conversions, most played/searched, and a time chart
  (Phases 1-2).
- Interactive, live vibe coding, not static (Phases 2-3).
- Clean investor interface, responsive, themed (Phase 4).
- Deployed and reachable by URL (Phase 5).
- Data labeled as demo, not presented as real (Phases 1 and 4).
