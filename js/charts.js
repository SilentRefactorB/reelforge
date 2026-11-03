// d3 v7 rendering: line charts (finance, creators), horizontal bars (mix, funnel,
// games) and stat rows (responsible gaming). Also exports shared number formatters.

export function formatNumber(n) {
  return d3.format(",.0f")(n);
}

export function formatCurrency(n) {
  return "$" + d3.format(",.0f")(n);
}

export function formatPercent(fraction, decimals = 1) {
  return (fraction * 100).toFixed(decimals) + "%";
}

let tooltipEl = null;
function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = d3.select("body").append("div").attr("class", "rf-tooltip");
  }
  return tooltipEl;
}

// Generic line chart. opts: { series: [{key,label,color}], monthLabels: string[12], valueFormat }
export function renderLineChart(container, data, opts) {
  const { series, monthLabels, valueFormat } = opts;
  d3.select(container).selectAll("*").remove();

  const width = container.clientWidth || 320;
  const height = 260;
  const margin = { top: 16, right: 64, bottom: 28, left: 56 };
  const innerW = Math.max(width - margin.left - margin.right, 40);
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint().domain(data.map((d) => d.month)).range([0, innerW]);
  const allValues = data.flatMap((d) => series.map((s) => d[s.key]));
  const yMax = d3.max(allValues) || 1;
  const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerH, 0]);

  const monthLabel = (m) => monthLabels[parseInt(m.split("-")[1], 10) - 1];

  g.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(monthLabel));

  g.append("g")
    .attr("class", "axis axis-y")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => valueFormat(v)));

  series.forEach((s) => {
    const line = d3
      .line()
      .x((d) => x(d.month))
      .y((d) => y(d[s.key]));

    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", s.color)
      .attr("stroke-width", 2.5)
      .attr("d", line);

    g.selectAll(null)
      .data(data)
      .join("circle")
      .attr("cx", (d) => x(d.month))
      .attr("cy", (d) => y(d[s.key]))
      .attr("r", 3)
      .attr("fill", s.color);

    if (series.length > 1) {
      const last = data[data.length - 1];
      g.append("text")
        .attr("x", x(last.month) + 8)
        .attr("y", y(last[s.key]))
        .attr("dy", "0.32em")
        .attr("fill", s.color)
        .attr("class", "line-end-label")
        .text(s.label);
    }
  });

  const points = data.map((d) => ({ month: d.month, x: x(d.month) }));
  const tooltip = getTooltip();

  g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      let nearest = points[0];
      let minDist = Infinity;
      for (const p of points) {
        const dist = Math.abs(p.x - mx);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
      const d = data.find((dd) => dd.month === nearest.month);
      const lines = series.map((s) => `${s.label}: ${valueFormat(d[s.key])}`).join("<br>");
      const [year, mon] = d.month.split("-");
      tooltip
        .html(`<strong>${monthLabels[parseInt(mon, 10) - 1]} ${year}</strong><br>${lines}`)
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY - 12 + "px")
        .style("opacity", 1);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));
}

// Generic horizontal bar chart. opts: { labelFn, valueFn, formatFn, percentOf, color }
export function renderHBarChart(container, items, opts) {
  const { labelFn, valueFn, formatFn, percentOf, color } = opts;
  d3.select(container).selectAll("*").remove();

  const width = container.clientWidth || 320;
  const rowH = 36;
  const margin = { top: 4, right: 90, bottom: 4, left: 150 };
  const innerW = Math.max(width - margin.left - margin.right, 40);
  const height = items.length * rowH + margin.top + margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(items, valueFn) || 1;
  const x = d3.scaleLinear().domain([0, maxVal * 1.15]).range([0, innerW]);

  const rows = g
    .selectAll("g.bar-row")
    .data(items)
    .join("g")
    .attr("class", "bar-row")
    .attr("transform", (d, i) => `translate(0,${i * rowH})`);

  rows
    .append("text")
    .attr("x", -10)
    .attr("y", rowH / 2)
    .attr("dy", "0.32em")
    .attr("text-anchor", "end")
    .attr("class", "bar-label")
    .text((d) => labelFn(d));

  rows
    .append("rect")
    .attr("class", "bar-fill")
    .attr("y", (rowH - 18) / 2)
    .attr("height", 18)
    .attr("width", (d) => x(valueFn(d)))
    .attr("fill", color)
    .attr("rx", 4);

  rows
    .append("text")
    .attr("x", (d) => x(valueFn(d)) + 8)
    .attr("y", rowH / 2)
    .attr("dy", "0.32em")
    .attr("class", "bar-value")
    .text((d) => {
      const base = formatFn(valueFn(d));
      if (percentOf) {
        return `${base} (${formatPercent(valueFn(d) / percentOf, 0)})`;
      }
      return base;
    });

  const tooltip = getTooltip();
  rows
    .append("rect")
    .attr("class", "bar-hit")
    .attr("x", -margin.left)
    .attr("y", 0)
    .attr("width", margin.left + innerW)
    .attr("height", rowH)
    .attr("fill", "transparent")
    .on("mouseenter", function (event, d) {
      d3.select(this.parentNode).select(".bar-fill").classed("bar-hover", true);
      const base = formatFn(valueFn(d));
      const extra = percentOf ? ` (${formatPercent(valueFn(d) / percentOf, 0)})` : "";
      tooltip
        .html(`<strong>${labelFn(d)}</strong><br>${base}${extra}`)
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY - 12 + "px")
        .style("opacity", 1);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", event.clientX + 12 + "px").style("top", event.clientY - 12 + "px");
    })
    .on("mouseleave", function () {
      d3.select(this.parentNode).select(".bar-fill").classed("bar-hover", false);
      tooltip.style("opacity", 0);
    });
}

// Stat row (no chart): opts: { labelFn, valueFn, formatFn, subFn }
export function renderStatRow(container, items, opts) {
  const { labelFn, valueFn, formatFn, subFn } = opts;
  container.innerHTML = "";
  items.forEach((d) => {
    const el = document.createElement("div");
    el.className = "stat-tile";
    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = formatFn(valueFn(d));
    const label = document.createElement("div");
    label.className = "stat-label";
    label.textContent = labelFn(d);
    el.appendChild(value);
    el.appendChild(label);
    if (subFn) {
      const sub = subFn(d);
      if (sub) {
        const subEl = document.createElement("div");
        subEl.className = "stat-sub";
        subEl.textContent = sub;
        el.appendChild(subEl);
      }
    }
    container.appendChild(el);
  });
}

// Categorical palette (CSS variables defined in styles.css for light/dark).
export const CAT_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)"];

// Donut chart. opts: { labelFn, valueFn, formatFn, colors }
export function renderDonut(container, items, opts) {
  const { labelFn, valueFn, formatFn, colors = CAT_COLORS } = opts;
  d3.select(container).selectAll("*").remove();

  const width = container.clientWidth || 320;
  const height = 260;
  const radius = Math.min(width, height) / 2;
  const inner = radius * 0.6;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

  const total = d3.sum(items, valueFn) || 1;
  const pie = d3.pie().sort(null).value(valueFn);
  const arc = d3.arc().innerRadius(inner).outerRadius(radius - 4);
  const arcs = pie(items);
  const tooltip = getTooltip();

  g.selectAll("path")
    .data(arcs)
    .join("path")
    .attr("d", arc)
    .attr("fill", (d, i) => colors[i % colors.length])
    .attr("stroke", "var(--bg-elev)")
    .attr("stroke-width", 2)
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("opacity", 0.85);
      tooltip
        .html(
          `<strong>${labelFn(d.data)}</strong><br>${formatFn(valueFn(d.data))} (${formatPercent(
            valueFn(d.data) / total,
            0
          )})`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY - 12 + "px")
        .style("opacity", 1);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", event.clientX + 12 + "px").style("top", event.clientY - 12 + "px");
    })
    .on("mouseleave", function () {
      d3.select(this).attr("opacity", 1);
      tooltip.style("opacity", 0);
    });

  // Center total
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.1em")
    .attr("class", "donut-center-value")
    .text(formatFn(total));
}

// Legend list (DOM) for donut/area. items: [{label,color}]
export function renderCategoryLegend(container, items) {
  container.innerHTML = "";
  items.forEach((it) => {
    const row = document.createElement("span");
    row.className = "legend-pill";
    row.style.setProperty("--legend-color", it.color);
    const sw = document.createElement("span");
    sw.className = "legend-swatch";
    row.appendChild(sw);
    row.appendChild(document.createTextNode(it.label));
    container.appendChild(row);
  });
}

// Stacked area over months. opts: { series:[{key,label,color}], monthLabels, valueFormat }
export function renderStackedArea(container, data, opts) {
  const { series, monthLabels, valueFormat } = opts;
  d3.select(container).selectAll("*").remove();

  const width = container.clientWidth || 320;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = Math.max(width - margin.left - margin.right, 40);
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const keys = series.map((s) => s.key);
  const stack = d3.stack().keys(keys);
  const layers = stack(data);

  const x = d3.scalePoint().domain(data.map((d) => d.month)).range([0, innerW]);
  const yMax = d3.max(layers[layers.length - 1], (d) => d[1]) || 1;
  const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerH, 0]);

  const monthLabel = (m) => monthLabels[parseInt(m.split("-")[1], 10) - 1];

  g.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickFormat(monthLabel));

  g.append("g")
    .attr("class", "axis axis-y")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => valueFormat(v)));

  const area = d3
    .area()
    .x((d) => x(d.data.month))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]));

  g.selectAll("path.area-layer")
    .data(layers)
    .join("path")
    .attr("class", "area-layer")
    .attr("fill", (d, i) => series[i].color)
    .attr("opacity", 0.85)
    .attr("d", area);

  const tooltip = getTooltip();
  const points = data.map((d) => ({ month: d.month, x: x(d.month) }));
  g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      let nearest = points[0];
      let minDist = Infinity;
      for (const p of points) {
        const dist = Math.abs(p.x - mx);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }
      const d = data.find((dd) => dd.month === nearest.month);
      const lines = series.map((s) => `${s.label}: ${valueFormat(d[s.key])}`).join("<br>");
      const [year, mon] = d.month.split("-");
      tooltip
        .html(`<strong>${monthLabels[parseInt(mon, 10) - 1]} ${year}</strong><br>${lines}`)
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY - 12 + "px")
        .style("opacity", 1);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));
}

// Retention cohort heatmap. cohorts: { offsets:[...], rows:[{cohort, values:[0..1|null]}] }
// opts: { monthLabels }
export function renderHeatmap(container, cohorts, opts) {
  const { monthLabels } = opts;
  d3.select(container).selectAll("*").remove();

  const offsets = cohorts.offsets;
  const rows = cohorts.rows;
  const width = container.clientWidth || 320;
  const margin = { top: 24, right: 8, bottom: 8, left: 70 };
  const cellH = 34;
  const innerW = Math.max(width - margin.left - margin.right, 40);
  const cellW = innerW / offsets.length;
  const height = rows.length * cellH + margin.top + margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tooltip = getTooltip();
  const cohortLabel = (m) => {
    const [year, mon] = m.split("-");
    return monthLabels[parseInt(mon, 10) - 1] + " " + year.slice(2);
  };

  // column headers
  g.selectAll("text.hm-col")
    .data(offsets)
    .join("text")
    .attr("class", "hm-col")
    .attr("x", (d, i) => i * cellW + cellW / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .text((d) => d);

  const rowG = g
    .selectAll("g.hm-row")
    .data(rows)
    .join("g")
    .attr("class", "hm-row")
    .attr("transform", (d, i) => `translate(0,${i * cellH})`);

  rowG
    .append("text")
    .attr("class", "hm-rowlabel")
    .attr("x", -10)
    .attr("y", cellH / 2)
    .attr("dy", "0.32em")
    .attr("text-anchor", "end")
    .text((d) => cohortLabel(d.cohort));

  rowG.each(function (row) {
    const rg = d3.select(this);
    row.values.forEach((v, i) => {
      const cell = rg
        .append("rect")
        .attr("x", i * cellW + 2)
        .attr("y", 3)
        .attr("width", cellW - 4)
        .attr("height", cellH - 6)
        .attr("rx", 4);
      if (v == null) {
        cell.attr("class", "hm-cell hm-empty");
      } else {
        cell
          .attr("class", "hm-cell")
          .attr("fill", "var(--accent)")
          .attr("fill-opacity", 0.15 + v * 0.85)
          .on("mouseenter", function (event) {
            tooltip
              .html(
                `<strong>${cohortLabel(row.cohort)} - ${offsets[i]}</strong><br>${formatPercent(v, 0)}`
              )
              .style("left", event.clientX + 12 + "px")
              .style("top", event.clientY - 12 + "px")
              .style("opacity", 1);
          })
          .on("mousemove", (event) => {
            tooltip.style("left", event.clientX + 12 + "px").style("top", event.clientY - 12 + "px");
          })
          .on("mouseleave", () => tooltip.style("opacity", 0));
        rg.append("text")
          .attr("class", "hm-val")
          .attr("x", i * cellW + cellW / 2)
          .attr("y", cellH / 2)
          .attr("dy", "0.32em")
          .attr("text-anchor", "middle")
          .attr("fill", v > 0.55 ? "#fff" : "var(--text)")
          .text(formatPercent(v, 0));
      }
    });
  });
}

// Sortable + searchable table (DOM). Manages its own sort/search state.
// opts: { columns:[{key,label,format,numeric,align}], searchKeys:[...],
//         searchPlaceholder, defaultSort:{key,dir} }
export function renderTable(container, rows, opts) {
  const { columns, searchKeys = [], searchPlaceholder = "", defaultSort } = opts;
  container.innerHTML = "";

  const state = {
    sortKey: defaultSort ? defaultSort.key : columns[0].key,
    sortDir: defaultSort ? defaultSort.dir : "desc",
    query: ""
  };

  let toolbar = null;
  if (searchKeys.length) {
    toolbar = document.createElement("div");
    toolbar.className = "table-toolbar";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "table-search";
    input.placeholder = searchPlaceholder;
    input.setAttribute("aria-label", searchPlaceholder);
    input.addEventListener("input", () => {
      state.query = input.value.trim().toLowerCase();
      drawBody();
    });
    toolbar.appendChild(input);
    container.appendChild(toolbar);
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.align === "right") th.classList.add("num");
    th.classList.add("sortable");
    th.addEventListener("click", () => {
      if (state.sortKey === col.key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = col.key;
        state.sortDir = col.numeric ? "desc" : "asc";
      }
      drawHead();
      drawBody();
    });
    col._th = th;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);

  function drawHead() {
    columns.forEach((col) => {
      col._th.classList.remove("sort-asc", "sort-desc");
      if (col.key === state.sortKey) {
        col._th.classList.add(state.sortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function currentRows() {
    let out = rows;
    if (state.query && searchKeys.length) {
      out = out.filter((r) =>
        searchKeys.some((k) => String(r[k] == null ? "" : r[k]).toLowerCase().includes(state.query))
      );
    }
    const col = columns.find((c) => c.key === state.sortKey) || columns[0];
    const dir = state.sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va = a[state.sortKey];
      const vb = b[state.sortKey];
      if (col.numeric) return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return out;
  }

  function drawBody() {
    tbody.innerHTML = "";
    const list = currentRows();
    if (list.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = columns.length;
      td.className = "table-empty";
      td.textContent = "-";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    list.forEach((r) => {
      const tr = document.createElement("tr");
      columns.forEach((col) => {
        const td = document.createElement("td");
        if (col.align === "right") td.classList.add("num");
        const val = col.format ? col.format(r[col.key], r) : r[col.key];
        td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  drawHead();
  drawBody();
}

