/**
 * Shared numeric helpers.
 *
 * Centralising rounding here removes the near-identical private `round()` that
 * used to be copy-pasted into the calculator, planner, recommendation, chart,
 * and benchmark modules — one definition, one behaviour, one place to change.
 */

/**
 * Round a value to `dp` decimal places.
 *
 * Always returns a finite number: non-numeric or non-finite input rounds to 0,
 * which keeps every downstream calculation stable even when fed junk.
 *
 * @param {number} value the number to round
 * @param {number} [dp=1] decimal places to keep
 * @returns {number}
 */
export function roundTo(value, dp = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** dp;
  return Math.round(n * factor) / factor;
}
