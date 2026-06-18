/**
 * Insight generator — the assistant's "voice".
 *
 * Produces short, natural-language coaching that adapts to the user's specific
 * result: what dominates their footprint, the single most worthwhile next step,
 * and an encouraging, honest framing. It's fully rule-based and deterministic
 * (no external model), which keeps the app private, offline-capable, dependency
 * free, and unit-testable.
 */

import { formatKg, formatTonnes, formatPercent } from './format.js';
import { BENCHMARKS } from '../data/emissionFactors.js';

/**
 * A one-to-two sentence coaching note for the headline of the action plan.
 *
 * @param {object} footprint  output of calculateFootprint()
 * @param {Array}  ranked     output of rankCategories(footprint)
 * @param {object} plan       output of recommend()
 * @returns {string}
 */
export function coachingNote(footprint, ranked, plan) {
  if (!footprint || footprint.total <= 0) {
    return 'Enter your details above and I’ll build a plan tailored to you.';
  }

  const top = ranked[0];
  const lead = top
    ? `Your biggest lever is ${top.label.toLowerCase()} — ${formatPercent(top.share)} of your footprint.`
    : '';

  // Already in a sustainable range, or nothing impactful left to suggest.
  if (footprint.total <= BENCHMARKS.sustainable || !plan.recommendations.length) {
    return `${lead} You’re already living within a sustainable range — well done. The most valuable thing now is to keep it steady and help others do the same.`.trim();
  }

  const best = plan.recommendations[0];
  return `${lead} Start with “${best.title}” — on its own it could save about ${formatKg(
    best.savingKg,
  )} a year. Work down the list and you’d reach roughly ${formatTonnes(
    plan.projectedTotal,
  )} a year.`.trim();
}

/**
 * A live status line for the goal gauge, reflecting the currently selected
 * actions. Kept pure so the UI can announce it via an aria-live region.
 *
 * @param {object} status  output of goalStatus()
 * @param {number} projectedTotal current projected footprint (kg/yr)
 */
export function goalMessage(status, projectedTotal) {
  if (status.reached) {
    const spare = status.overshoot;
    const tail = spare > 50 ? ` — with ${formatKg(spare)}/yr to spare` : '';
    return `🎉 This plan reaches your goal of ${formatTonnes(status.targetKg)}${tail}. Projected: ${formatTonnes(
      projectedTotal,
    )}/yr.`;
  }
  return `Projected ${formatTonnes(projectedTotal)}/yr — still ${formatKg(
    status.gap,
  )} above your ${formatTonnes(status.targetKg)} goal. Select more actions to close the gap.`;
}

/**
 * A motivational milestone for the tracker, based on the change since the
 * user's previous saved snapshot.
 *
 * @param {number} latestTotal current saved total (kg/yr)
 * @param {number|null} previousTotal prior saved total, or null if first entry
 */
export function progressMessage(latestTotal, previousTotal) {
  if (previousTotal == null) {
    return 'First snapshot saved — this is your baseline. Come back after making a change to watch it drop.';
  }
  const diff = previousTotal - latestTotal;
  if (diff > 1) {
    return `Down ${formatKg(diff)} since last time — that’s real progress. Keep going! 🌍`;
  }
  if (diff < -1) {
    return `Up ${formatKg(-diff)} since last time. No worries — pick one action from your plan to reverse it.`;
  }
  return 'About the same as last time. A single new habit from your plan will move the needle.';
}
