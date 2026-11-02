# ReelForge - Business Intelligence Dashboard

Academic project for the **Comercio Electronico** course, Maestria en Administracion de
Tecnologias de la Informacion (MATI), Escuela de Informatica, **Universidad Nacional de Costa
Rica** - III Trimestre 2026.

A single-page, static Business Intelligence dashboard for the investor panel of **ReelForge**,
a fictional "social casino app store" (a MACH, B2B2C marketplace of social-casino games with
virtual chips and no real money). This repository is **Component C** of the final project.

> **Academic use only.** All figures are simulated demo data for a pre-launch concept and do not
> represent a real business. ReelForge is a fictional concept created for this course.

## Features

- Business KPIs with month-over-month change: registered users, users online, marketplace GMV,
  platform revenue, active creators, purchase conversion.
- Charts: monthly revenue and GMV with a period filter, revenue mix, conversion funnel, most
  played games, active creators, and a responsible-gaming panel.
- Live data from Firebase Realtime Database, plus a live connected-viewers counter.
- Bilingual UI (Spanish by default, English optional), light/dark theme, responsive.

## Tech stack

- Static site: HTML + CSS + vanilla JavaScript (no framework, no build step).
- Charts: d3 v7.
- Data and realtime: Firebase Realtime Database + Anonymous Authentication.
- Hosting: GitHub Pages.

## Project structure

```
.
  index.html
  css/styles.css
  i18n/translations.json
  js/i18n.js
  js/firebase-config.js
  js/data.js
  js/presence.js
  js/charts.js
  js/app.js
  database.rules.json        Firebase RTDB Security Rules
  reelforge.json             demo data to import into RTDB
  README.md
  CLAUDE.md                  build brief
  docs/SPEC.md               functional and technical spec
  docs/DEVELOPMENT-PLAN.md   development phases and tests
```

## Setup

1. Create a Firebase project; enable Realtime Database and Anonymous Authentication.
2. Import `reelforge.json` into the database root; publish `database.rules.json` as the rules.
3. Paste your web app config into `js/firebase-config.js` (public by design; security lives in
   the Security Rules).
4. Serve the folder as a static site, or deploy it to GitHub Pages.

Full details are in `docs/SPEC.md` and `docs/DEVELOPMENT-PLAN.md`.

## Course

- Course: Comercio Electronico (IPC731O), III Trimestre 2026.
- Program: Maestria en Administracion de Tecnologias de la Informacion (MATI).
- School: Escuela de Informatica, Universidad Nacional de Costa Rica.
- Instructor: Hugo Escalante Sandi.
- Team: Julio Chavarria, Eddie Alvarez.
