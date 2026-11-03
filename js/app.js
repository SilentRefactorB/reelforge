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
  gamesMetric: "plays"
};

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

function renderHeaderChrome() {
  document.title = t("app.title");
  applyStaticI18n();
  const langBtn = document.getElementById("lang-toggle");
  langBtn.textContent = otherLangName();
  langBtn.setAttribute("aria-label", otherLangName());
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
  state.kpis.forEach((k) => {
    const up = k.delta >= 0;
    const fmt = KPI_FORMAT[k.metric] || formatNumber;
    const windowKey = KPI_WINDOW_KEY[k.metric] || "window.last30";

    const tile = document.createElement("div");
    tile.className = "kpi-tile";

    const label = document.createElement("div");
    label.className = "kpi-label";
    label.textContent = t("kpi." + k.metric);

    const value = document.createElement("div");
    value.className = "kpi-value";
    value.textContent = fmt(k.value);

    const delta = document.createElement("div");
    delta.className = "kpi-delta " + (up ? "up" : "down");
    const deltaText = (up ? "+" : "") + formatPercent(k.delta, 1);
    const arrow = up ? "▲" : "▼";
    delta.innerHTML = `<span class="kpi-delta-pill">${arrow} ${deltaText}</span> <span class="kpi-sub">${t("delta.vsPrev")}</span>`;

    const win = document.createElement("div");
    win.className = "kpi-window";
    win.textContent = t(windowKey);

    tile.appendChild(label);
    tile.appendChild(value);
    tile.appendChild(delta);
    tile.appendChild(win);
    grid.appendChild(tile);
  });
}

function renderFinance() {
  const stateEl = document.getElementById("finance-state");
  const content = document.getElementById("finance-content");
  if (state.monthlyError) return showState(stateEl, content, "error");
  if (!state.monthly) return showState(stateEl, content, "loading");
  if (state.monthly.length === 0) return showState(stateEl, content, "empty");
  showState(stateEl, content, "ready");

  const sliced = state.monthly.slice(-state.periodMonths);
  renderLineChart(document.getElementById("finance-chart"), sliced, {
    series: [
      { key: "gmv", label: t("series.gmv"), color: "var(--accent)" },
      { key: "revenue", label: t("series.revenue"), color: "var(--up)" }
    ],
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
}

main();
