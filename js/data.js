// Data layer, abstracted as if calling a backend API: one function per endpoint.
// Reads a single static JSON file (reelforge.json) once and caches it. Switching to a
// real API later only needs changes inside this file: swap the fetch for HTTP calls and
// keep the same function signatures (each returns a Promise of the node's data).

const DATA_URL = "reelforge.json";
let cache = null;
let inflight = null;

async function load() {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((json) => {
        cache = json;
        return cache;
      })
      .catch((err) => {
        inflight = null; // allow a later retry
        throw err;
      });
  }
  return inflight;
}

function normalizeList(val) {
  if (Array.isArray(val)) return val.filter((v) => v != null);
  if (val && typeof val === "object") return Object.values(val);
  return [];
}

async function getList(key) {
  const data = await load();
  return normalizeList(data[key]);
}

async function getNode(key) {
  const data = await load();
  return data[key] != null ? data[key] : null;
}

export function getKpis() {
  return getList("kpis");
}

export function getMonthly() {
  return getList("monthly");
}

export function getCatalog() {
  return getList("catalog");
}

export function getBreakdowns() {
  return getList("breakdowns");
}

export function getCreators() {
  return getList("creators");
}

export function getGeography() {
  return getList("geography");
}

export function getDevices() {
  return getList("devices");
}

export function getCohorts() {
  return getNode("cohorts");
}

export function getResponsibleMonthly() {
  return getList("rg_monthly");
}
