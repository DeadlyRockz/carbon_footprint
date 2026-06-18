/**
 * Small, pure formatting helpers shared by the UI and tests. Centralising these
 * keeps number presentation consistent everywhere and easy to verify.
 */

/** Format a kg CO2e value with thousands separators, e.g. "8,210 kg". */
export function formatKg(kg) {
  const n = Math.round(Number(kg) || 0);
  return `${n.toLocaleString('en-US')} kg`;
}

/** Format kg CO2e as tonnes with one decimal, e.g. "8.2 t". */
export function formatTonnes(kg) {
  const t = (Number(kg) || 0) / 1000;
  return `${t.toFixed(1)} t`;
}

/** Format a 0–1 share as a whole-number percentage, e.g. "37%". */
export function formatPercent(share) {
  return `${Math.round((Number(share) || 0) * 100)}%`;
}

/** Equivalence helper: trees needed for a year to absorb a kg CO2e amount. */
export function treesEquivalent(kg) {
  // A mature tree absorbs very roughly 21 kg CO2 per year.
  return Math.max(0, Math.round((Number(kg) || 0) / 21));
}

/** A short ISO date (YYYY-MM-DD) for a Date, defaulting to now. */
export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
