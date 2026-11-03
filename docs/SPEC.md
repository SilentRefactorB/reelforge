# SPEC - ReelForge Dashboard (Component C)

Functional and technical specification. It describes what the dashboard is, what it reads,
what it has, and how it behaves. Build order and tests are in `DEVELOPMENT-PLAN.md`.

All names (files, folders, data nodes, keys, identifiers) are in English. The only Spanish in
the project is the Spanish values inside the translations file.

## 1. Summary

A single-page, static web dashboard for the investor panel of ReelForge (the social casino
app store). It shows the business indicators live plus a live connected-viewers counter. It is
deployed on GitHub Pages and reads its data from Firebase Realtime Database. The data is
simulated (pre-launch) and labeled as demo data. The UI is bilingual (Spanish default,
English optional).

## 2. Tech stack and files

- Static page: HTML + CSS + vanilla JS (no framework, no bundler, no server).
- Charts: d3 v7 (UMD from cdnjs, exact version, loaded before the script that uses it).
- Data: Firebase Realtime Database (RTDB), modular web SDK v9+ from gstatic.
- Identity: Firebase Anonymous Authentication (no login screen).
- Hosting: GitHub Pages.

```
dashboard/
  index.html
  css/styles.css
  i18n/translations.json   (es + en strings; Spanish default)
  js/i18n.js               (loads translations, t(key), setLang(), persists choice)
  js/firebase-config.js    (public config; Julio pastes the real one)
  js/data.js               (data layer: one function per endpoint, reads RTDB live)
  js/presence.js           (anonymous auth + /presence + connected widget)
  js/charts.js             (d3: tiles, lines, bars, funnel)
  js/app.js                (orchestrates: subscribes data, renders, filters, states)
  database.rules.json      (RTDB Security Rules)
  reelforge.json           (demo data to import into RTDB)
```

## 3. Data source (Firebase RTDB)

The dashboard has no data in the code: it reads from RTDB live (onValue). Nodes and the meaning
of each field:

### /kpis - current indicators (list)
Each item: `metric` (id), `value` (number), `delta` (fraction 0-1, change vs previous month).
- `registered_users`: total registered users.
- `online_now`: users online (concurrency, simultaneous peak).
- `gmv_30d`: marketplace GMV over 30 days (USD; sales of digital goods).
- `revenue_30d`: platform revenue over 30 days (USD; commission + VIP + media + fees).
- `active_creators`: active affiliated creators/studios.
- `conv_purchase`: purchase conversion rate (fraction 0-1).

### /monthly - monthly series (list ordered by month)
Each item: `month` ("YYYY-MM"), `gmv`, `revenue`, `active_creators`, `new_creators`.
The business evolution over 12 months.

### /catalog - marketplace games (list)
Each item: `game` (name), `plays` (30d), `searches` (30d), `gmv`.
Basis for "most played" (plays) and "most searched" (searches). `game` is a proper noun and is
NOT translated.

### /breakdowns - bar groups (list)
Each item: `group`, `key` (unique id), `value`, `order`.
- group `revenue`: revenue sources (microtransactions, VIP, retail media, fees).
- group `funnel`: funnel stages registered -> played -> purchased -> VIP.
- group `responsible_gaming`: alerts, self-exclusions, configured limits.

Display labels come from i18n keyed by `key` (section 6). There is no label field in the data.

### /presence - runtime, ephemeral (not in the demo data)
Each visitor writes `/presence/<uid>` on arrival (anonymous auth) and removes it on leave
(onDisconnect). The dashboard counts the children for "connected now".

## 4. Dashboard sections (what it has), top to bottom

1. **Header**: title "ReelForge", a one-line takeaway with 1-2 figures from /kpis, the demo-data
   badge, the **language switch**, and the **connected-viewers widget** (from /presence).
2. **KPI row** (from /kpis): six tiles. Each tile: label, formatted value, delta with sign and
   color (green up, red down), and the time window.
3. **Finance by month** (from /monthly): GMV and revenue lines. Period control 12 / 6 / 3
   months. Hover tooltip. Each series labeled at the end of its line.
4. **Revenue mix** (from /breakdowns, group=revenue): horizontal bars with amount and percent.
5. **Conversion funnel** (from /breakdowns, group=funnel): horizontal bars from registered to
   VIP, with percent of registered.
6. **Most played games** (from /catalog): horizontal bars by plays; can toggle to "most
   searched" (searches).
7. **Active affiliated creators** (from /monthly): monthly line of active_creators; follows the
   same period control as Finance.
8. **Responsible gaming** (from /breakdowns, group=responsible_gaming): three figures (alerts,
   self-exclusions, limits).

## 5. Behavior and interactions

- **Live**: each section subscribes to its node (onValue); if the data changes in RTDB, that
  section re-renders without reload.
- **Period filter**: 12/6/3 months affects Finance and Creators.
- **Tooltips**: on the line charts, with the month and the value per series.
- **Formatting**: counts with thousands separators; GMV/revenue with a currency prefix;
  conversion and deltas as percentages. Month abbreviations come from i18n per language.
- **States**: each section handles loading / empty / error without breaking the layout.
- **Responsive**: single column on mobile (~400px), no horizontal scroll.
- **Theme**: light and dark via CSS tokens, both legible.

## 6. Internationalization (i18n)

- The dashboard supports **Spanish and English**. **Default: Spanish.**
- A **language switch** in the header toggles ES/EN and re-renders all text immediately, with no
  reload.
- The selected language persists in `localStorage` (works on GitHub Pages; per-browser; wrap
  reads/writes in try/catch and fall back to Spanish).
- The language is also reflected in the URL as a query string, `?lang=es` or `?lang=en` (plain
  client-side query param, no server routing; safe on GitHub Pages). On load, `?lang` takes
  priority over `localStorage`, so a shared or bookmarked link opens in that language; switching
  language updates the URL via `history.replaceState` (no new history entry, no reload).
- All visible text comes from the translations file; no hard-coded visible strings in markup.
- Data-driven labels resolve by key:
  - KPI labels by `"kpi." + metric` (e.g. `kpi.registered_users`).
  - Breakdown labels by `key` (e.g. `mix_microtx`, `fn_registered`, `rg_alerts`).
  - Game names (`catalog.game`) are proper nouns: not translated.
  - Month abbreviations: the `months` array per language.
- `js/i18n.js`: loads `i18n/translations.json`, keeps the current language (priority: `?lang` URL
  param, then `localStorage`, then default `es`), exposes `t(key)` and `setLang(lang)` (persists
  to both `localStorage` and the URL, and triggers a re-render).

### i18n/translations.json (shape and required keys)

Keys are in English; only the values differ per language.

```json
{
  "es": {
    "app.subtitle": "El app store del casino social",
    "badge.demo": "Datos demostrativos",
    "lang.name": "Espanol",
    "presence.label": "Conectados ahora",
    "kpi.registered_users": "Usuarios registrados",
    "kpi.online_now": "Usuarios en linea",
    "kpi.gmv_30d": "GMV del marketplace",
    "kpi.revenue_30d": "Ingresos de plataforma",
    "kpi.active_creators": "Creadores afiliados activos",
    "kpi.conv_purchase": "Conversion a compra",
    "window.total": "Total acumulado",
    "window.peak": "Pico simultaneo",
    "window.last30": "Ultimos 30 dias",
    "window.thisMonth": "Activos este mes",
    "delta.vsPrev": "vs. mes anterior",
    "section.finance": "Ingresos de plataforma y GMV por mes",
    "section.mix": "Mezcla de ingresos",
    "section.funnel": "Embudo de conversion",
    "section.games": "Juegos mas jugados",
    "section.creators": "Creadores afiliados activos",
    "section.responsible": "Juego responsable",
    "control.period": "Periodo",
    "control.plays": "Mas jugados",
    "control.searches": "Mas buscados",
    "state.loading": "Cargando",
    "state.empty": "Sin datos",
    "state.error": "No se pudo cargar",
    "series.gmv": "GMV",
    "series.revenue": "Ingresos",
    "mix_microtx": "Microtransacciones",
    "mix_vip": "Suscripcion VIP",
    "mix_media": "Retail media",
    "mix_fees": "Fees de publicacion",
    "fn_registered": "Registrados",
    "fn_played": "Jugaron (30d)",
    "fn_purchased": "Compraron",
    "fn_vip": "Miembros VIP",
    "rg_alerts": "Alertas activas (30d)",
    "rg_selfexcl": "Autoexclusiones (30d)",
    "rg_limits": "Limites configurados",
    "months": ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  },
  "en": {
    "app.subtitle": "The social casino app store",
    "badge.demo": "Demo data",
    "lang.name": "English",
    "presence.label": "Connected now",
    "kpi.registered_users": "Registered users",
    "kpi.online_now": "Users online",
    "kpi.gmv_30d": "Marketplace GMV",
    "kpi.revenue_30d": "Platform revenue",
    "kpi.active_creators": "Active affiliated creators",
    "kpi.conv_purchase": "Purchase conversion",
    "window.total": "All-time total",
    "window.peak": "Peak concurrent",
    "window.last30": "Last 30 days",
    "window.thisMonth": "Active this month",
    "delta.vsPrev": "vs. previous month",
    "section.finance": "Platform revenue and GMV by month",
    "section.mix": "Revenue mix",
    "section.funnel": "Conversion funnel",
    "section.games": "Most played games",
    "section.creators": "Active affiliated creators",
    "section.responsible": "Responsible gaming",
    "control.period": "Period",
    "control.plays": "Most played",
    "control.searches": "Most searched",
    "state.loading": "Loading",
    "state.empty": "No data",
    "state.error": "Could not load",
    "series.gmv": "GMV",
    "series.revenue": "Revenue",
    "mix_microtx": "Microtransactions",
    "mix_vip": "VIP subscription",
    "mix_media": "Retail media",
    "mix_fees": "Publishing fees",
    "fn_registered": "Registered",
    "fn_played": "Played (30d)",
    "fn_purchased": "Purchased",
    "fn_vip": "VIP members",
    "rg_alerts": "Active alerts (30d)",
    "rg_selfexcl": "Self-exclusions (30d)",
    "rg_limits": "Limits configured",
    "months": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  }
}
```

Cover every visible string with a key; the example above is the minimum set.

## 7. Firebase artifacts the app produces

### database.rules.json
Business data is public-read (edited from the console, which acts as owner). Presence: each
anonymous user writes only their own node.

```json
{
  "rules": {
    "kpis":       { ".read": true, ".write": false },
    "monthly":    { ".read": true, ".write": false },
    "catalog":    { ".read": true, ".write": false },
    "breakdowns": { ".read": true, ".write": false },
    "presence": {
      ".read": true,
      "$uid": { ".write": "auth != null && auth.uid == $uid" }
    }
  }
}
```

### js/firebase-config.js (placeholder; Julio pastes the real one)
Public by design; security is the rules above.

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "reelforge-dashboard.firebaseapp.com",
  databaseURL: "https://reelforge-dashboard-default-rtdb.firebaseio.com",
  projectId: "reelforge-dashboard",
  appId: "..."
};
```

## 8. Demo data (exact content of reelforge.json)

```json
{
  "kpis": [
    { "metric": "registered_users", "value": 48500,  "delta": 0.124 },
    { "metric": "online_now",       "value": 1840,   "delta": 0.068 },
    { "metric": "gmv_30d",          "value": 214000, "delta": 0.091 },
    { "metric": "revenue_30d",      "value": 78000,  "delta": 0.112 },
    { "metric": "active_creators",  "value": 312,    "delta": 0.080 },
    { "metric": "conv_purchase",    "value": 0.073,  "delta": 0.089 }
  ],
  "monthly": [
    { "month": "2025-12", "gmv": 118000, "revenue": 41000, "active_creators": 165, "new_creators": 22 },
    { "month": "2026-01", "gmv": 126000, "revenue": 44000, "active_creators": 178, "new_creators": 24 },
    { "month": "2026-02", "gmv": 134000, "revenue": 47500, "active_creators": 192, "new_creators": 26 },
    { "month": "2026-03", "gmv": 142000, "revenue": 50000, "active_creators": 205, "new_creators": 25 },
    { "month": "2026-04", "gmv": 151000, "revenue": 53500, "active_creators": 221, "new_creators": 28 },
    { "month": "2026-05", "gmv": 159000, "revenue": 56500, "active_creators": 236, "new_creators": 27 },
    { "month": "2026-06", "gmv": 168000, "revenue": 60000, "active_creators": 251, "new_creators": 30 },
    { "month": "2026-07", "gmv": 176000, "revenue": 62500, "active_creators": 263, "new_creators": 26 },
    { "month": "2026-08", "gmv": 187000, "revenue": 66500, "active_creators": 277, "new_creators": 31 },
    { "month": "2026-09", "gmv": 196000, "revenue": 70000, "active_creators": 289, "new_creators": 29 },
    { "month": "2026-10", "gmv": 205000, "revenue": 74000, "active_creators": 301, "new_creators": 30 },
    { "month": "2026-11", "gmv": 214000, "revenue": 78000, "active_creators": 312, "new_creators": 28 }
  ],
  "catalog": [
    { "game": "Golden Reels",     "plays": 128000, "searches": 9200, "gmv": 38000 },
    { "game": "Neon Blackjack",   "plays": 96000,  "searches": 7100, "gmv": 29500 },
    { "game": "Crash Rocket",     "plays": 88000,  "searches": 8300, "gmv": 26000 },
    { "game": "Lucky Bingo Live", "plays": 72000,  "searches": 5400, "gmv": 19500 },
    { "game": "Mystic Slots",     "plays": 64000,  "searches": 4800, "gmv": 17000 },
    { "game": "Poker Arena",      "plays": 58000,  "searches": 6100, "gmv": 21000 },
    { "game": "Dice Royale",      "plays": 41000,  "searches": 3200, "gmv": 11500 },
    { "game": "Fortune Wheel",    "plays": 37000,  "searches": 2900, "gmv": 9800 }
  ],
  "breakdowns": [
    { "group": "revenue", "key": "mix_microtx", "value": 43000, "order": 1 },
    { "group": "revenue", "key": "mix_vip",     "value": 18500, "order": 2 },
    { "group": "revenue", "key": "mix_media",   "value": 11000, "order": 3 },
    { "group": "revenue", "key": "mix_fees",    "value": 5500,  "order": 4 },

    { "group": "funnel", "key": "fn_registered", "value": 48500, "order": 1 },
    { "group": "funnel", "key": "fn_played",     "value": 31500, "order": 2 },
    { "group": "funnel", "key": "fn_purchased",  "value": 12400, "order": 3 },
    { "group": "funnel", "key": "fn_vip",        "value": 3550,  "order": 4 },

    { "group": "responsible_gaming", "key": "rg_alerts",   "value": 420,  "order": 1 },
    { "group": "responsible_gaming", "key": "rg_selfexcl", "value": 38,   "order": 2 },
    { "group": "responsible_gaming", "key": "rg_limits",   "value": 9600, "order": 3 }
  ]
}
```

## 9. Conventions

- Bilingual UI (ES default, EN optional); plain-text content, no special characters.
- Data layer as-if-API in `js/data.js`: `onKpis(cb)`, `onMonthly(cb)`, `onCatalog(cb)`,
  `onBreakdowns(cb)`. Today they read RTDB with onValue; moving to a real API = change only the
  body of these functions.
- RTDB note: a JSON list is stored with keys 0..n and read back as an array; fine for
  read-only data.
