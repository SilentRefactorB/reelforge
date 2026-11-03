// Orchestrates: i18n bootstrap, data subscriptions, rendering, filters and states.
import { initI18n, t, getLang, setLang, otherLangName, onLangChange } from "./i18n.js";
import { onKpis, onMonthly, onCatalog, onBreakdowns } from "./data.js";
import { initPresence } from "./presence.js";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  renderLineChart,
  renderHBarChart,
  renderStatRow
} from "./charts.js";

const state = {
  kpis: null,
  kpisError: false,
  monthly: null,
  monthlyError: false,
  catalog: null,
  catalogError: false,
  breakdowns: null,
  breakdownsError: false,
  periodMonths: 12,
  gamesMetric: "plays",
  financeVisible: { gmv: true, revenue: true }
};

// Clicking a KPI tile scrolls to and briefly highlights the panel it relates to.
// Tiles with no natural destination (e.g. online_now has no dedicated chart) stay inert.
const KPI_TARGET = {
  registered_users: "funnel-panel",
  gmv_30d: "finance-panel",
  revenue_30d: "finance-panel",
  active_creators: "creators-panel",
  conv_purchase: "funnel-panel"
};

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
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
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
    // ignore storage errors (private mode, quota, etc.)
  }
  applyTheme(next);
  renderThemeButton();
}

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

// Cosmetic-only "live ticker" on top of the real Firebase values: a small, bounded
// per-tile jitter re-applied every few seconds so the panel reads as live between
// real data pushes. The underlying numbers (state.kpis) always stay exactly what
// Firebase sent; this never touches them, and resets the moment new data arrives.
const KPI_JITTER = {
  registered_users: { type: "drift", cap: 0.004 },
  online_now: { type: "wobble", amp: 0.035 },
  gmv_30d: { type: "drift", cap: 0.006 },
  revenue_30d: { type: "drift", cap: 0.006 },
  active_creators: { type: "drift", cap: 0.01 },
  conv_purchase: { type: "wobble", amp: 0.02 }
};
const KPI_JITTER_INTERVAL_MS = 5000;

let kpiJitterDrift = {};
let kpiEls = {};
let kpiJitterTimer = null;

function resetKpiJitter() {
  kpiJitterDrift = {};
}

function jitteredKpiValue(k) {
  const cfg = KPI_JITTER[k.metric];
  if (!cfg) return k.value;
  if (cfg.type === "drift") {
    const current = kpiJitterDrift[k.metric] || 0;
    return k.value * (1 + current);
  }
  const offset = (Math.random() * 2 - 1) * cfg.amp;
  return k.value * (1 + offset);
}

function flashKpiValue(el) {
  el.classList.remove("value-flash");
  void el.offsetWidth;
  el.classList.add("value-flash");
}

function updateKpiTile(k) {
  const refs = kpiEls[k.metric];
  if (!refs) return;

  const up = k.delta >= 0;
  const fmt = KPI_FORMAT[k.metric] || formatNumber;
  const text = fmt(jitteredKpiValue(k));
  if (refs.lastText !== null && refs.lastText !== text) {
    flashKpiValue(refs.valueEl);
  }
  refs.valueEl.textContent = text;
  refs.lastText = text;

  refs.deltaEl.className = "kpi-delta " + (up ? "up" : "down");
  const deltaText = (up ? "+" : "") + formatPercent(k.delta, 1);
  const arrow = up ? "▲" : "▼";
  refs.deltaEl.innerHTML = `<span class="kpi-delta-pill">${arrow} ${deltaText}</span> <span class="kpi-sub">${t("delta.vsPrev")}</span>`;
}

function tickKpiJitter() {
  if (!state.kpis || state.kpisError || state.kpis.length === 0) return;
  state.kpis.forEach((k) => {
    const cfg = KPI_JITTER[k.metric];
    if (cfg && cfg.type === "drift") {
      const current = kpiJitterDrift[k.metric] || 0;
      kpiJitterDrift[k.metric] = Math.min(cfg.cap, current + Math.random() * (cfg.cap / 4));
    }
  });
  state.kpis.forEach(updateKpiTile);
}

function startKpiJitter() {
  if (kpiJitterTimer) return;
  kpiJitterTimer = setInterval(tickKpiJitter, KPI_JITTER_INTERVAL_MS);
}

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

function scrollToPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("panel-pulse");
  void el.offsetWidth;
  el.classList.add("panel-pulse");
}

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
  if (state.kpisError) {
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

function renderKpis() {
  const stateEl = document.getElementById("kpi-state");
  const grid = document.getElementById("kpi-grid");
  if (state.kpisError) return showState(stateEl, grid, "error");
  if (!state.kpis) return showState(stateEl, grid, "loading");
  if (state.kpis.length === 0) return showState(stateEl, grid, "empty");
  showState(stateEl, grid, "ready");

  grid.innerHTML = "";
  kpiEls = {};
  state.kpis.forEach((k) => {
    const tile = document.createElement("div");
    tile.className = "kpi-tile";

    const label = document.createElement("div");
    label.className = "kpi-label";
    label.textContent = t("kpi." + k.metric);

    const value = document.createElement("div");
    value.className = "kpi-value";

    const delta = document.createElement("div");
    delta.className = "kpi-delta";

    const win = document.createElement("div");
    win.className = "kpi-window";
    win.textContent = t(KPI_WINDOW_KEY[k.metric] || "window.last30");

    tile.appendChild(label);
    tile.appendChild(value);
    tile.appendChild(delta);
    tile.appendChild(win);

    const target = KPI_TARGET[k.metric];
    if (target) {
      tile.classList.add("kpi-tile-linked");
      tile.tabIndex = 0;
      tile.setAttribute("role", "button");
      const go = () => scrollToPanel(target);
      tile.addEventListener("click", go);
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }

    grid.appendChild(tile);

    kpiEls[k.metric] = { valueEl: value, deltaEl: delta, lastText: null };
  });

  state.kpis.forEach(updateKpiTile);
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
      if (visible && !otherVisible) return; // keep at least one series visible
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
  if (state.monthlyError) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sliced = state.monthly.slice(-state.periodMonths);
  const visibleSeries = FINANCE_SERIES.filter((s) => state.financeVisible[s.key]).map((s) => ({
    key: s.key,
    label: t(s.labelKey),
    color: s.color
  }));
  renderLineChart(document.getElementById("finance-chart"), sliced, {
    series: visibleSeries,
    monthLabels: t("months"),
    valueFormat: formatCurrency
  });
}

function renderCreators() {
  const stateEl = document.getElementById("creators-state");
  const content = document.getElementById("creators-content");
  if (state.monthlyError) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sliced = state.monthly.slice(-state.periodMonths);
  renderLineChart(document.getElementById("creators-chart"), sliced, {
    series: [{ key: "active_creators", label: t("section.creators"), color: "var(--accent)" }],
    monthLabels: t("months"),
    valueFormat: formatNumber
  });
}

function renderMix() {
  const stateEl = document.getElementById("mix-state");
  const content = document.getElementById("mix-chart");
  if (state.breakdownsError) return showState(stateEl, content, "error");
  if (!state.breakdowns) return showState(stateEl, content, "loading");
  const items = state.breakdowns.filter((b) => b.group === "revenue").sort((a, b) => a.order - b.order);
  if (items.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const total = d3.sum(items, (d) => d.value);
  renderHBarChart(content, items, {
    labelFn: (d) => t(d.key),
    valueFn: (d) => d.value,
    formatFn: formatCurrency,
    percentOf: total,
    color: "var(--accent)"
  });
}

function renderFunnel() {
  const stateEl = document.getElementById("funnel-state");
  const content = document.getElementById("funnel-chart");
  if (state.breakdownsError) return showState(stateEl, content, "error");
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

function renderResponsible() {
  const stateEl = document.getElementById("responsible-state");
  const content = document.getElementById("responsible-figures");
  if (state.breakdownsError) return showState(stateEl, content, "error");
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

function renderGames() {
  const stateEl = document.getElementById("games-state");
  const content = document.getElementById("games-chart");
  if (state.catalogError) return showState(stateEl, content, "error");
  if (!state.catalog) return showState(stateEl, content, "loading");
  if (state.catalog.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const metric = state.gamesMetric;
  const sorted = [...state.catalog].sort((a, b) => b[metric] - a[metric]);
  renderHBarChart(content, sorted, {
    labelFn: (d) => d.game,
    valueFn: (d) => d[metric],
    formatFn: formatNumber,
    color: "var(--accent)"
  });
}

function renderAll() {
  renderHeaderTakeaway();
  renderKpis();
  renderFinance();
  renderCreators();
  renderMix();
  renderFunnel();
  renderResponsible();
  renderGames();
}

function wireControls() {
  document.getElementById("lang-toggle").addEventListener("click", () => {
    setLang(getLang() === "es" ? "en" : "es");
  });

  document.querySelectorAll("#finance-period button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.periodMonths = parseInt(btn.dataset.months, 10);
      document.querySelectorAll("#finance-period button").forEach((b) => b.classList.toggle("active", b === btn));
      renderFinance();
      renderCreators();
    });
  });

  document.querySelectorAll("#games-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.gamesMetric = btn.dataset.metric;
      document.querySelectorAll("#games-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
      renderGames();
    });
  });

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 150);
  });
}

function initPresenceWidget() {
  const countEl = document.getElementById("presence-count");
  initPresence(
    (count) => {
      countEl.textContent = formatNumber(count);
    },
    () => {
      countEl.textContent = "-";
    }
  );
}

applyTheme(getStoredTheme());

async function main() {
  await initI18n();
  renderHeaderChrome();
  wireControls();
  renderAll();

  onLangChange(() => {
    renderHeaderChrome();
    renderAll();
  });

  onKpis(
    (data) => {
      state.kpis = data;
      state.kpisError = false;
      resetKpiJitter();
      renderHeaderTakeaway();
      renderKpis();
    },
    () => {
      state.kpisError = true;
      renderHeaderTakeaway();
      renderKpis();
    }
  );

  onMonthly(
    (data) => {
      state.monthly = data;
      state.monthlyError = false;
      renderFinance();
      renderCreators();
    },
    () => {
      state.monthlyError = true;
      renderFinance();
      renderCreators();
    }
  );

  onCatalog(
    (data) => {
      state.catalog = data;
      state.catalogError = false;
      renderGames();
    },
    () => {
      state.catalogError = true;
      renderGames();
    }
  );

  onBreakdowns(
    (data) => {
      state.breakdowns = data;
      state.breakdownsError = false;
      renderMix();
      renderFunnel();
      renderResponsible();
    },
    () => {
      state.breakdownsError = true;
      renderMix();
      renderFunnel();
      renderResponsible();
    }
  );

  initPresenceWidget();
  startKpiJitter();
}

main();
