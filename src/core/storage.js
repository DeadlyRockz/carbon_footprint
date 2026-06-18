/**
 * Persistence layer — a thin, defensive wrapper over localStorage.
 *
 * Everything stays on the user's own device: no accounts, no servers, no
 * network calls. That's a deliberate privacy/security choice for sensitive
 * lifestyle data. The wrapper degrades gracefully when storage is unavailable
 * (private mode, disabled cookies, or a non-browser environment), so the app
 * never crashes just because it can't save.
 */

const PROFILE_KEY = 'ecotrack:profile';
const HISTORY_KEY = 'ecotrack:history';
const MAX_HISTORY = 60; // keep tracking lightweight and bounded

/** Resolve a Storage implementation, or null if none is usable. */
function getStore() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Touch the API to surface SecurityError in restricted contexts.
    const probe = '__ecotrack_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  const store = getStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  const store = getStore();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded or serialization failure — fail quietly, never throw.
    return false;
  }
}

/** Returns true when persistence is actually available in this environment. */
export function isStorageAvailable() {
  return getStore() !== null;
}

export function saveProfile(profile) {
  return writeJson(PROFILE_KEY, profile);
}

export function loadProfile() {
  return readJson(PROFILE_KEY, null);
}

/**
 * Append a footprint snapshot to the on-device history and return the trimmed
 * list. Each entry is a compact summary so the log stays small over time.
 */
export function addHistoryEntry(entry) {
  const history = loadHistory();
  const record = {
    date: entry.date,
    total: entry.total,
    categories: entry.categories ?? {},
  };
  const next = [...history, record].slice(-MAX_HISTORY);
  writeJson(HISTORY_KEY, next);
  return next;
}

export function loadHistory() {
  const history = readJson(HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export function clearHistory() {
  writeJson(HISTORY_KEY, []);
  return [];
}
