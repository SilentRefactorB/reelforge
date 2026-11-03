// Orchestrates: i18n bootstrap, data load (static JSON), tab navigation, global period
// filter, rendering, sortable/searchable tables and CSV export. No Firebase, no live
// jitter: every number is read once from reelforge.json and shown as-is (demo data).
import { initI18n, t, getLang, setLang, otherLangName, onLangChange } from "./i18n.js";
import {
  getKpis,
  getMonthly,
  getCatalog,
  getBreakdowns,
  getCreators,
  getGeography,
  getDevices,
  getCohorts,
  getResponsibleMonthly
} from "./data.js";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  renderLineChart,
  renderHBarChart,
  renderStatRow,
  renderDonut,
  renderStackedArea,
  renderHeatmap,
  renderTable,
  renderCategoryLegend,
  CAT_COLORS
} from "./charts.js";

const state = {
  kpis: null,
  monthly: null,
  catalog: null,
  breakdowns: null,
  creators: null,
  geography: null,
  devices: null,
  cohorts: null,
  rgMonthly: null,
  error: false,
  periodMonths: 12,
  gamesMetric: "plays",
  activeTab: "overview",
  financeVisible: { gmv: true, revenue: true }
};

/* ---------------- Theme ---------------- */

const THEME_KEY = "rf_theme";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}

function effectiveTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

function renderThemeButton() {
  const btn = document.getElementById("theme-toggle");
  const label = effectiveTheme() === "dark" ? t("theme.toLight") : t("theme.toDark");
  btn.textContent = label;
  btn.setAttribute("aria-label", label);
}

function toggleTheme() {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {
    /* ignore */
  }
  applyTheme(next);
  renderThemeButton();
  renderActiveTab(); // chart colors follow CSS vars; re-render to pick new theme
}

/* ---------------- i18n / state helpers ---------------- */

const KPI_WINDOW_KEY = {
  registered_users: "window.total",
  online_now: "window.peak",
  gmv_30d: "window.last30",
  revenue_30d: "window.last30",
  active_creators: "window.thisMonth",
  conv_purchase: "window.last30"
};

const KPI_FORMAT = {
  registered_users: formatNumber,
  online_now: formatNumber,
  gmv_30d: formatCurrency,
  revenue_30d: formatCurrency,
  active_creators: formatNumber,
  conv_purchase: (v) => formatPercent(v, 1)
};

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
}

function showState(stateEl, contentEl, status) {
  if (status === "ready") {
    stateEl.hidden = true;
    contentEl.hidden = false;
    return;
  }
  stateEl.hidden = false;
  contentEl.hidden = true;
  const key = status === "error" ? "state.error" : status === "empty" ? "state.empty" : "state.loading";
  stateEl.className = "section-state state-" + status;
  stateEl.innerHTML = `<span class="state-icon" aria-hidden="true"></span><span>${t(key)}</span>`;
}

function slicedMonthly() {
  if (!state.monthly) return [];
  return state.monthly.slice(-state.periodMonths);
}

function monthLabelFull(m) {
  const [year, mon] = m.split("-");
  return t("months")[parseInt(mon, 10) - 1] + " " + year;
}

/* ---------------- Header ---------------- */

function renderHeaderChrome() {
  document.title = t("app.title");
  applyStaticI18n();
  const langBtn = document.getElementById("lang-toggle");
  langBtn.textContent = otherLangName();
  langBtn.setAttribute("aria-label", otherLangName());
  renderThemeButton();
}

function renderHeaderTakeaway() {
  const el = document.getElementById("header-takeaway");
  if (state.error) {
    el.textContent = t("state.error");
    return;
  }
  if (!state.kpis) {
    el.textContent = t("state.loading");
    return;
  }
  const users = state.kpis.find((k) => k.metric === "registered_users");
  const gmv = state.kpis.find((k) => k.metric === "gmv_30d");
  if (!users || !gmv) {
    el.textContent = t("state.empty");
    return;
  }
  el.textContent = t("header.takeaway")
    .replace("{users}", formatNumber(users.value))
    .replace("{gmv}", formatCurrency(gmv.value));
}

/* ---------------- Overview ---------------- */

function renderKpis() {
  const stateEl = document.getElementById("kpi-state");
  const grid = document.getElementById("kpi-grid");
  if (state.error) return showState(stateEl, grid, "error");
  if (!state.kpis) return showState(stateEl, grid, "loading");
  if (state.kpis.length === 0) return showState(stateEl, grid, "empty");
  showState(stateEl, grid, "ready");

  grid.innerHTML = "";
  state.kpis.forEach((k) => {
    const tile = document.createElement("div");
    tile.className = "kpi-tile";

    const label = document.createElement("div");
    label.className = "kpi-label";
    label.textContent = t("kpi." + k.metric);

    const value = document.createElement("div");
    value.className = "kpi-value";
    const fmt = KPI_FORMAT[k.metric] || formatNumber;
    value.textContent = fmt(k.value);

    const delta = document.createElement("div");
    const up = k.delta >= 0;
    delta.className = "kpi-delta " + (up ? "up" : "down");
    const arrow = up ? "▲" : "▼";
    const deltaText = (up ? "+" : "") + formatPercent(k.delta, 1);
    delta.innerHTML = `<span class="kpi-delta-pill">${arrow} ${deltaText}</span> <span class="kpi-sub">${t("delta.vsPrev")}</span>`;

    const win = document.createElement("div");
    win.className = "kpi-window";
    win.textContent = t(KPI_WINDOW_KEY[k.metric] || "window.last30");

    tile.appendChild(label);
    tile.appendChild(value);
    tile.appendChild(delta);
    tile.appendChild(win);
    grid.appendChild(tile);
  });
}

const FINANCE_SERIES = [
  { key: "gmv", labelKey: "series.gmv", color: "var(--accent)" },
  { key: "revenue", labelKey: "series.revenue", color: "var(--up)" }
];

function renderFinanceLegend() {
  const el = document.getElementById("finance-legend");
  el.innerHTML = "";
  FINANCE_SERIES.forEach((s) => {
    const visible = state.financeVisible[s.key];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "legend-pill" + (visible ? "" : " off");
    btn.style.setProperty("--legend-color", s.color);
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    btn.appendChild(swatch);
    btn.appendChild(document.createTextNode(t(s.labelKey)));
    btn.addEventListener("click", () => {
      const otherVisible = FINANCE_SERIES.some(
        (other) => other.key !== s.key && state.financeVisible[other.key]
      );
      if (visible && !otherVisible) return;
      state.financeVisible[s.key] = !visible;
      renderFinance();
    });
    el.appendChild(btn);
  });
}

function renderFinance() {
  const stateEl = document.getElementById("finance-state");
  const content = document.getElementById("finance-content");
  renderFinanceLegend();
  if (state.error) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const visibleSeries = FINANCE_SERIES.filter((s) => state.financeVisible[s.key]).map((s) => ({
    key: s.key,
    label: t(s.labelKey),
    color: s.color
  }));
  renderLineChart(document.getElementById("finance-chart"), slicedMonthly(), {
    series: visibleSeries,
    monthLabels: t("months"),
    valueFormat: formatCurrency
  });
}

const MIX_KEYS = [
  { key: "mix_microtx", color: CAT_COLORS[0] },
  { key: "mix_vip", color: CAT_COLORS[1] },
  { key: "mix_media", color: CAT_COLORS[2] },
  { key: "mix_fees", color: CAT_COLORS[3] }
];

function mixItems() {
  return state.breakdowns.filter((b) => b.group === "revenue").sort((a, b) => a.order - b.order);
}

function renderMix() {
  const stateEl = document.getElementById("mix-state");
  const content = document.getElementById("mix-chart");
  const legend = document.getElementById("mix-legend");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.breakdowns) return showState(stateEl, content, "loading");
  const items = mixItems();
  if (items.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const colorFor = (key) => (MIX_KEYS.find((m) => m.key === key) || {}).color || CAT_COLORS[0];
  renderCategoryLegend(legend, items.map((d) => ({ label: t(d.key), color: colorFor(d.key) })));
  renderDonut(content, items, {
    labelFn: (d) => t(d.key),
    valueFn: (d) => d.value,
    formatFn: formatCurrency,
    colors: items.map((d) => colorFor(d.key))
  });
}

/* ---------------- Business tab ---------------- */

const STREAM_SERIES = [
  { key: "rev_microtx", labelKey: "mix_microtx", color: CAT_COLORS[0] },
  { key: "rev_vip", labelKey: "mix_vip", color: CAT_COLORS[1] },
  { key: "rev_media", labelKey: "mix_media", color: CAT_COLORS[2] },
  { key: "rev_fees", labelKey: "mix_fees", color: CAT_COLORS[3] }
];

function renderStreams() {
  const stateEl = document.getElementById("streams-state");
  const content = document.getElementById("streams-chart");
  const legend = document.getElementById("streams-legend");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderCategoryLegend(legend, STREAM_SERIES.map((s) => ({ label: t(s.labelKey), color: s.color })));
  renderStackedArea(content, slicedMonthly(), {
    series: STREAM_SERIES.map((s) => ({ key: s.key, label: t(s.labelKey), color: s.color })),
    monthLabels: t("months"),
    valueFormat: formatCurrency
  });
}

function renderGmvGame() {
  const stateEl = document.getElementById("gmvgame-state");
  const content = document.getElementById("gmvgame-chart");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.catalog) return showState(stateEl, content, "loading");
  if (state.catalog.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sorted = [...state.catalog].sort((a, b) => b.gmv - a.gmv);
  renderHBarChart(content, sorted, {
    labelFn: (d) => d.game,
    valueFn: (d) => d.gmv,
    formatFn: formatCurrency,
    color: "var(--accent)"
  });
}

function growthRows() {
  const rows = [];
  const list = slicedMonthly();
  list.forEach((m, i) => {
    const prev = i > 0 ? list[i - 1].revenue : null;
    const growth = prev ? (m.revenue - prev) / prev : 0;
    rows.push({ month: m.month, gmv: m.gmv, revenue: m.revenue, growth });
  });
  return rows;
}

function renderGrowth() {
  const stateEl = document.getElementById("growth-state");
  const content = document.getElementById("growth-table");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderTable(content, growthRows(), {
    columns: [
      { key: "month", label: t("col.month"), format: (v) => monthLabelFull(v) },
      { key: "gmv", label: t("col.gmv"), numeric: true, align: "right", format: (v) => formatCurrency(v) },
      { key: "revenue", label: t("col.revenue"), numeric: true, align: "right", format: (v) => formatCurrency(v) },
      {
        key: "growth",
        label: t("col.growth"),
        numeric: true,
        align: "right",
        format: (v) => (v >= 0 ? "+" : "") + formatPercent(v, 1)
      }
    ],
    defaultSort: { key: "month", dir: "asc" }
  });
}

/* ---------------- Players tab ---------------- */

function renderFunnel() {
  const stateEl = document.getElementById("funnel-state");
  const content = document.getElementById("funnel-chart");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.breakdowns) return showState(stateEl, content, "loading");
  const items = state.breakdowns.filter((b) => b.group === "funnel").sort((a, b) => a.order - b.order);
  if (items.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const registered = items[0].value;
  renderHBarChart(content, items, {
    labelFn: (d) => t(d.key),
    valueFn: (d) => d.value,
    formatFn: formatNumber,
    percentOf: registered,
    color: "var(--up)"
  });
}

const AUDIENCE_SERIES = [
  { key: "mau", labelKey: "metric.mau", color: "var(--accent)" },
  { key: "dau", labelKey: "metric.dau", color: "var(--up)" }
];

function renderAudience() {
  const stateEl = document.getElementById("audience-state");
  const content = document.getElementById("audience-chart");
  const legend = document.getElementById("audience-legend");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderCategoryLegend(legend, AUDIENCE_SERIES.map((s) => ({ label: t(s.labelKey), color: s.color })));
  renderLineChart(content, slicedMonthly(), {
    series: AUDIENCE_SERIES.map((s) => ({ key: s.key, label: t(s.labelKey), color: s.color })),
    monthLabels: t("months"),
    valueFormat: formatNumber
  });
}

function renderRetention() {
  const stateEl = document.getElementById("retention-state");
  const content = document.getElementById("retention-chart");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.cohorts) return showState(stateEl, content, "loading");
  if (!state.cohorts.rows || state.cohorts.rows.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderHeatmap(content, state.cohorts, { monthLabels: t("months") });
}

function renderGeography() {
  const stateEl = document.getElementById("geography-state");
  const content = document.getElementById("geography-chart");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.geography) return showState(stateEl, content, "loading");
  if (state.geography.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sorted = [...state.geography].sort((a, b) => b.users - a.users);
  renderHBarChart(content, sorted, {
    labelFn: (d) => t(d.country),
    valueFn: (d) => d.users,
    formatFn: formatNumber,
    color: "var(--accent)"
  });
}

function renderDevices() {
  const stateEl = document.getElementById("devices-state");
  const content = document.getElementById("devices-chart");
  const legend = document.getElementById("devices-legend");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.devices) return showState(stateEl, content, "loading");
  if (state.devices.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderCategoryLegend(legend, state.devices.map((d, i) => ({ label: t(d.platform), color: CAT_COLORS[i % CAT_COLORS.length] })));
  renderDonut(content, state.devices, {
    labelFn: (d) => t(d.platform),
    valueFn: (d) => d.share,
    formatFn: (v) => formatPercent(v, 0),
    colors: state.devices.map((d, i) => CAT_COLORS[i % CAT_COLORS.length])
  });
}

/* ---------------- Catalog & creators tab ---------------- */

function renderGamesTable() {
  const stateEl = document.getElementById("games-state");
  const content = document.getElementById("games-table");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.catalog) return showState(stateEl, content, "loading");
  if (state.catalog.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const rows = state.catalog.map((g) => ({ ...g, categoryLabel: t(g.category) }));
  renderTable(content, rows, {
    columns: [
      { key: "game", label: t("col.game") },
      { key: "categoryLabel", label: t("col.category") },
      { key: "plays", label: t("col.plays"), numeric: true, align: "right", format: (v) => formatNumber(v) },
      { key: "searches", label: t("col.searches"), numeric: true, align: "right", format: (v) => formatNumber(v) },
      { key: "players", label: t("col.players"), numeric: true, align: "right", format: (v) => formatNumber(v) },
      { key: "gmv", label: t("col.gmv"), numeric: true, align: "right", format: (v) => formatCurrency(v) }
    ],
    searchKeys: ["game", "categoryLabel"],
    searchPlaceholder: t("control.searchGames"),
    defaultSort: { key: "plays", dir: "desc" }
  });
}

function renderGamesBar() {
  const stateEl = document.getElementById("gamesbar-state");
  const content = document.getElementById("gamesbar-chart");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.catalog) return showState(stateEl, content, "loading");
  if (state.catalog.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const metric = state.gamesMetric;
  const sorted = [...state.catalog].sort((a, b) => b[metric] - a[metric]).slice(0, 8);
  renderHBarChart(content, sorted, {
    labelFn: (d) => d.game,
    valueFn: (d) => d[metric],
    formatFn: formatNumber,
    color: "var(--accent)"
  });
}

function categoryItems() {
  const map = {};
  state.catalog.forEach((g) => {
    map[g.category] = (map[g.category] || 0) + g.gmv;
  });
  return Object.keys(map).map((key) => ({ key, value: map[key] }));
}

function renderCategory() {
  const stateEl = document.getElementById("category-state");
  const content = document.getElementById("category-chart");
  const legend = document.getElementById("category-legend");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.catalog) return showState(stateEl, content, "loading");
  if (state.catalog.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const items = categoryItems();
  renderCategoryLegend(legend, items.map((d, i) => ({ label: t(d.key), color: CAT_COLORS[i % CAT_COLORS.length] })));
  renderDonut(content, items, {
    labelFn: (d) => t(d.key),
    valueFn: (d) => d.value,
    formatFn: formatCurrency,
    colors: items.map((d, i) => CAT_COLORS[i % CAT_COLORS.length])
  });
}

function renderCreators() {
  const stateEl = document.getElementById("creators-state");
  const content = document.getElementById("creators-table");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.creators) return showState(stateEl, content, "loading");
  if (state.creators.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderTable(content, state.creators, {
    columns: [
      { key: "name", label: t("col.creator") },
      { key: "games", label: t("col.games"), numeric: true, align: "right", format: (v) => formatNumber(v) },
      { key: "plays", label: t("col.plays"), numeric: true, align: "right", format: (v) => formatNumber(v) },
      { key: "gmv", label: t("col.gmv"), numeric: true, align: "right", format: (v) => formatCurrency(v) },
      { key: "joined", label: t("col.joined"), format: (v) => monthLabelFull(v) }
    ],
    searchKeys: ["name"],
    searchPlaceholder: t("control.searchCreators"),
    defaultSort: { key: "gmv", dir: "desc" }
  });
}

/* ---------------- Responsible gaming tab ---------------- */

function renderResponsible() {
  const stateEl = document.getElementById("responsible-state");
  const content = document.getElementById("responsible-figures");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.breakdowns) return showState(stateEl, content, "loading");
  const items = state.breakdowns
    .filter((b) => b.group === "responsible_gaming")
    .sort((a, b) => a.order - b.order);
  if (items.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  renderStatRow(content, items, {
    labelFn: (d) => t(d.key),
    valueFn: (d) => d.value,
    formatFn: formatNumber
  });
}

const RGTREND_SERIES = [
  { key: "alerts", labelKey: "rg_alerts_s", color: "var(--accent)" },
  { key: "selfexcl", labelKey: "rg_selfexcl_s", color: "var(--down)" }
];

function renderRgTrend() {
  const stateEl = document.getElementById("rgtrend-state");
  const content = document.getElementById("rgtrend-chart");
  const legend = document.getElementById("rgtrend-legend");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.rgMonthly) return showState(stateEl, content, "loading");
  if (state.rgMonthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sliced = state.rgMonthly.slice(-state.periodMonths);
  renderCategoryLegend(legend, RGTREND_SERIES.map((s) => ({ label: t(s.labelKey), color: s.color })));
  renderLineChart(content, sliced, {
    series: RGTREND_SERIES.map((s) => ({ key: s.key, label: t(s.labelKey), color: s.color })),
    monthLabels: t("months"),
    valueFormat: formatNumber
  });
}

function renderRgLimits() {
  const stateEl = document.getElementById("rglimits-state");
  const content = document.getElementById("rglimits-chart");
  if (state.error) return showState(stateEl, content, "error");
  if (!state.rgMonthly) return showState(stateEl, content, "loading");
  if (state.rgMonthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sliced = state.rgMonthly.slice(-state.periodMonths);
  renderLineChart(content, sliced, {
    series: [{ key: "limits", label: t("rg_limits_s"), color: "var(--up)" }],
    monthLabels: t("months"),
    valueFormat: formatNumber
  });
}

/* ---------------- Tab routing ---------------- */

const TAB_RENDER = {
  overview: () => {
    renderKpis();
    renderFinance();
    renderMix();
  },
  business: () => {
    renderStreams();
    renderGmvGame();
    renderGrowth();
  },
  players: () => {
    renderFunnel();
    renderAudience();
    renderRetention();
    renderGeography();
    renderDevices();
  },
  catalog: () => {
    renderGamesTable();
    renderGamesBar();
    renderCategory();
    renderCreators();
  },
  responsible: () => {
    renderResponsible();
    renderRgTrend();
    renderRgLimits();
  }
};

function renderActiveTab() {
  renderHeaderTakeaway();
  const fn = TAB_RENDER[state.activeTab];
  if (fn) fn();
}

function switchTab(name) {
  if (!TAB_RENDER[name]) return;
  state.activeTab = name;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.dataset.tab === name));
  renderActiveTab();
}

/* ---------------- CSV export ---------------- */

function toCsv(rows) {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c == null ? "" : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(","))
    .join("\n");
}

function downloadCsv(name, rows) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvFor(key) {
  const M = t("months");
  const ml = (m) => M[parseInt(m.split("-")[1], 10) - 1] + " " + m.split("-")[0];
  switch (key) {
    case "finance":
      return [[t("col.month"), t("series.gmv"), t("series.revenue")]].concat(
        slicedMonthly().map((m) => [ml(m.month), m.gmv, m.revenue])
      );
    case "mix":
      return [[t("col.stream"), t("col.value")]].concat(mixItems().map((d) => [t(d.key), d.value]));
    case "streams":
      return [[t("col.month"), t("mix_microtx"), t("mix_vip"), t("mix_media"), t("mix_fees")]].concat(
        slicedMonthly().map((m) => [ml(m.month), m.rev_microtx, m.rev_vip, m.rev_media, m.rev_fees])
      );
    case "gmvgame":
      return [[t("col.game"), t("col.gmv")]].concat(
        [...state.catalog].sort((a, b) => b.gmv - a.gmv).map((g) => [g.game, g.gmv])
      );
    case "growth":
      return [[t("col.month"), t("col.gmv"), t("col.revenue"), t("col.growth")]].concat(
        growthRows().map((r) => [ml(r.month), r.gmv, r.revenue, (r.growth * 100).toFixed(1) + "%"])
      );
    case "funnel":
      return [[t("col.stage"), t("col.value")]].concat(
        state.breakdowns.filter((b) => b.group === "funnel").sort((a, b) => a.order - b.order).map((d) => [t(d.key), d.value])
      );
    case "audience":
      return [[t("col.month"), t("metric.mau"), t("metric.dau")]].concat(
        slicedMonthly().map((m) => [ml(m.month), m.mau, m.dau])
      );
    case "retention": {
      const head = [t("col.cohort")].concat(state.cohorts.offsets);
      return [head].concat(
        state.cohorts.rows.map((r) => [ml(r.cohort)].concat(r.values.map((v) => (v == null ? "" : (v * 100).toFixed(0) + "%"))))
      );
    }
    case "geography":
      return [[t("col.country"), t("col.users"), t("col.gmv")]].concat(
        [...state.geography].sort((a, b) => b.users - a.users).map((d) => [t(d.country), d.users, d.gmv])
      );
    case "devices":
      return [[t("col.device"), t("col.share")]].concat(
        state.devices.map((d) => [t(d.platform), (d.share * 100).toFixed(0) + "%"])
      );
    case "games":
      return [[t("col.game"), t("col.category"), t("col.plays"), t("col.searches"), t("col.players"), t("col.gmv")]].concat(
        state.catalog.map((g) => [g.game, t(g.category), g.plays, g.searches, g.players, g.gmv])
      );
    case "category":
      return [[t("col.category"), t("col.gmv")]].concat(categoryItems().map((d) => [t(d.key), d.value]));
    case "creators":
      return [[t("col.creator"), t("col.games"), t("col.plays"), t("col.gmv"), t("col.joined")]].concat(
        state.creators.map((c) => [c.name, c.games, c.plays, c.gmv, ml(c.joined)])
      );
    case "rgtrend":
      return [[t("col.month"), t("rg_alerts_s"), t("rg_selfexcl_s")]].concat(
        state.rgMonthly.slice(-state.periodMonths).map((m) => [ml(m.month), m.alerts, m.selfexcl])
      );
    case "rglimits":
      return [[t("col.month"), t("rg_limits_s")]].concat(
        state.rgMonthly.slice(-state.periodMonths).map((m) => [ml(m.month), m.limits])
      );
    default:
      return [];
  }
}

/* ---------------- Controls ---------------- */

function wireControls() {
  document.getElementById("lang-toggle").addEventListener("click", () => {
    setLang(getLang() === "es" ? "en" : "es");
  });

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll("#global-period button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.periodMonths = parseInt(btn.dataset.months, 10);
      document.querySelectorAll("#global-period button").forEach((b) => b.classList.toggle("active", b === btn));
      renderActiveTab();
    });
  });

  document.querySelectorAll("#games-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.gamesMetric = btn.dataset.metric;
      document.querySelectorAll("#games-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
      renderGamesBar();
    });
  });

  document.querySelectorAll(".csv-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.error || !state.monthly) return;
      const key = btn.dataset.csv;
      downloadCsv("reelforge_" + key, csvFor(key));
    });
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderActiveTab, 150);
  });
}

/* ---------------- Boot ---------------- */

applyTheme(getStoredTheme());

async function loadAll() {
  try {
    const [kpis, monthly, catalog, breakdowns, creators, geography, devices, cohorts, rgMonthly] =
      await Promise.all([
        getKpis(),
        getMonthly(),
        getCatalog(),
        getBreakdowns(),
        getCreators(),
        getGeography(),
        getDevices(),
        getCohorts(),
        getResponsibleMonthly()
      ]);
    Object.assign(state, {
      kpis,
      monthly,
      catalog,
      breakdowns,
      creators,
      geography,
      devices,
      cohorts,
      rgMonthly,
      error: false
    });
  } catch (e) {
    state.error = true;
  }
}

async function main() {
  await initI18n();
  renderHeaderChrome();
  wireControls();
  renderActiveTab(); // shows loading states

  onLangChange(() => {
    renderHeaderChrome();
    renderActiveTab();
  });

  await loadAll();
  renderActiveTab();
}

main();
