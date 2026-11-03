// Data layer, abstracted as if calling a backend API: one function per endpoint.
// Today each function reads Firebase RTDB live via onValue; switching to a real API
// later only needs changes inside this file.
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

function normalizeList(val) {
  if (Array.isArray(val)) return val.filter((v) => v != null);
  if (val && typeof val === "object") return Object.values(val);
  return [];
}

function subscribe(path, onData, onError) {
  const nodeRef = ref(db, path);
  return onValue(
    nodeRef,
    (snapshot) => onData(normalizeList(snapshot.val())),
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function onKpis(onData, onError) {
  return subscribe("kpis", onData, onError);
}

export function onMonthly(onData, onError) {
  return subscribe("monthly", onData, onError);
}

export function onCatalog(onData, onError) {
  return subscribe("catalog", onData, onError);
}

export function onBreakdowns(onData, onError) {
  return subscribe("breakdowns", onData, onError);
}
