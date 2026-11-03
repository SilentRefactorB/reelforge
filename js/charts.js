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

// Stat row (no chart): opts: { labelFn, valueFn, formatFn }
export function renderStatRow(container, items, opts) {
  const { labelFn, valueFn, formatFn } = opts;
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
    container.appendChild(el);
  });
}
