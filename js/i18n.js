// i18n layer: loads translations.json, keeps the current language, exposes t()/setLang().
// The language is also reflected in the URL (?lang=es|en) so a link can be shared or
// bookmarked in a given language; this works as a plain query string, no server routing
// needed, so it is safe on GitHub Pages.
const STORAGE_KEY = "rf_lang";
const PARAM_KEY = "lang";
const FALLBACK_LANG = "es";

let translations = {};
let lang = FALLBACK_LANG;
const listeners = [];

function readUrlLang() {
  try {
    return new URLSearchParams(window.location.search).get(PARAM_KEY);
  } catch (e) {
    return null;
  }
}

function writeUrlLang(newLang) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_KEY, newLang);
    window.history.replaceState(null, "", url);
  } catch (e) {
    // ignore (e.g. restricted contexts without History API access)
  }
}

export async function initI18n() {
  const res = await fetch("i18n/translations.json");
  translations = await res.json();

  const fromUrl = readUrlLang();
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    saved = null;
  }

  if (fromUrl && translations[fromUrl]) {
    lang = fromUrl;
  } else if (saved && translations[saved]) {
    lang = saved;
  } else {
    lang = FALLBACK_LANG;
  }

  document.documentElement.setAttribute("lang", lang);
  writeUrlLang(lang);
}

export function t(key) {
  const dict = translations[lang] || {};
  return dict[key] !== undefined ? dict[key] : key;
}

export function getLang() {
  return lang;
}

export function otherLangName() {
  const other = lang === "es" ? "en" : "es";
  const dict = translations[other] || {};
  return dict["lang.name"] !== undefined ? dict["lang.name"] : other;
}

export function setLang(newLang) {
  if (!translations[newLang] || newLang === lang) return;
  lang = newLang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    // ignore storage errors (private mode, quota, etc.)
  }
  document.documentElement.setAttribute("lang", lang);
  writeUrlLang(lang);
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn) {
  listeners.push(fn);
}
