# ReelForge - Business Intelligence Dashboard

Context and rules for building this dashboard with Claude Code. The full spec is in
`docs/SPEC.md` and the build order in `docs/DEVELOPMENT-PLAN.md`.

## What it is

Final-project dashboard for the Comercio Electronico course (MATI, UNA): **Component C**
(10 points, Week 10). A Business Intelligence center for the investor panel of **ReelForge**,
"the social casino app store" (a MACH, B2B2C platform for social-casino games with virtual
chips, no real money).

## Stack (required, no build)

- Static site (HTML + CSS + vanilla JS), deployable on **GitHub Pages**.
- Charts with **d3 v7** (UMD build from cdnjs, exact version, before the script that uses it).
- Data and realtime with **Firebase Realtime Database** + **Anonymous Authentication**,
  modular web SDK v9+ from the gstatic CDN.
- No framework, no bundler, no server: everything runs in the browser.

## Working rules

- **Bilingual UI (Spanish + English); Spanish is the default.** All visible text comes from a
  translations file; no hard-coded visible strings in markup. See SPEC section 6.
- Content in plain text, **no special characters** (ASCII).
- **No data in the code**: every number is read from Firebase (SPEC section 3).
- Data layer **abstracted as if calling a backend API** (one function per endpoint); switching
  to a real API must touch only those functions.
- The Firebase config is **public by design**; security lives in the Security Rules. No
  sensitive data, no Admin/service-account keys.
- Data is **simulated** (pre-launch), labeled "Datos demostrativos" / "Demo data".

## Documents (in docs/)

- `SPEC.md` - functional and technical spec: what it reads and represents, sections, behavior,
  i18n, demo data, security rules and config.
- `DEVELOPMENT-PLAN.md` - development phases and tests (the rubric is kept as an appendix).

## Build target

This folder is the project root for the site. Besides this brief (`CLAUDE.md`, `README.md` and
`docs/`), it already contains the two Firebase files, pre-generated for the console setup:
`reelforge.json` (data to import into RTDB) and `database.rules.json` (Security Rules). Keep them as the source of
truth; build the rest of the app fresh into this folder, with `index.html` at the root so
GitHub Pages can serve it.

## Split of work

- **Claude Code** writes the whole app (HTML, CSS, JS, `i18n/translations.json`,
  `database.rules.json`, `firebase-config.js` placeholder, `reelforge.json`).
- **Julio** creates the Firebase project, imports the data and pastes the real config. Those
  console steps are NOT in this brief (Julio does them, guided live if needed).
