/**
 * Goal planner & "what-if" projection engine.
 *
 * This is what turns a static list of tips into an interactive assistant. Given
 * the user's footprint, the recommended actions, and a goal, it can:
 *   - project the footprint that results from any *subset* of chosen actions,
 *   - automatically pick the smallest set of actions that reaches a target, and
 *   - report how far a plan is from the goal.
 *
 * Savings are capped per category (you can't save more transport emissions than
 * you produce), so projections stay physically meaningful no matter what the
 * user toggles. All functions are pure for easy testing.
 */

import { roundTo as round } from './math.js';

/**
 * Project the footprint that results from applying a chosen set of actions.
 *
 * @param {object} footprint        output of calculateFootprint()
 * @param {Array}  recommendations  actions from recommend()
 * @param {Iterable<string>} selectedIds ids of the actions to apply
 * @returns {{ projectedTotal: number, totalSaving: number, savingByCategory: Record<string, number> }}
 */
export function projectFootprint(footprint, recommendations, selectedIds) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

  const rawByCategory = {};
  for (const rec of recommendations) {
    if (!selected.has(rec.id)) continue;
    rawByCategory[rec.category] = (rawByCategory[rec.category] ?? 0) + rec.savingKg;
  }

  const savingByCategory = {};
  let totalSaving = 0;
  for (const [category, saved] of Object.entries(rawByCategory)) {
    const capped = Math.min(saved, footprint.categories[category] ?? 0);
    savingByCategory[category] = round(capped);
    totalSaving += capped;
  }

  totalSaving = round(totalSaving);
  return {
    projectedTotal: round(Math.max(0, footprint.total - totalSaving)),
    totalSaving,
    savingByCategory,
  };
}

/**
 * Greedily choose the fewest, highest-impact actions needed to reach a target.
 * Because savings are capped per category, we re-evaluate the real projection
 * after each pick rather than trusting the raw sum.
 *
 * @returns {string[]} ids of the selected actions (in priority order)
 */
export function autoSelectForTarget(footprint, recommendations, targetKg) {
  if (footprint.total <= targetKg) return [];

  const byImpact = [...recommendations].sort((a, b) => b.savingKg - a.savingKg);
  const selected = [];

  for (const rec of byImpact) {
    selected.push(rec.id);
    if (projectFootprint(footprint, recommendations, selected).projectedTotal <= targetKg) {
      break;
    }
  }
  return selected;
}

/**
 * Describe how a projected total compares with a target.
 *
 * @returns {{ reached: boolean, gap: number, overshoot: number, targetKg: number }}
 */
export function goalStatus(projectedTotal, targetKg) {
  const projected = Math.max(0, Number(projectedTotal) || 0);
  const target = Math.max(0, Number(targetKg) || 0);
  return {
    reached: projected <= target,
    gap: round(Math.max(0, projected - target)),
    overshoot: round(Math.max(0, target - projected)),
    targetKg: target,
  };
}

/**
 * Build the selectable goal presets for a given footprint. "Halve it" is
 * relative to the user, the others are absolute climate reference points.
 */
export function goalPresets(footprintTotal, benchmarks) {
  return [
    {
      id: 'paris2030',
      label: '2030 climate target',
      detail: '≈ 2.3 t · the 1.5 °C-aligned per-person budget',
      targetKg: benchmarks.paris2030,
    },
    {
      id: 'halve',
      label: 'Halve my footprint',
      detail: 'A bold, motivating personal cut',
      targetKg: round(footprintTotal / 2),
    },
    {
      id: 'sustainable',
      label: 'Fully sustainable',
      detail: '≈ 2.0 t · long-term net-zero-compatible level',
      targetKg: benchmarks.sustainable,
    },
  ];
}
