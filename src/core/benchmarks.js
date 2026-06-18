/**
 * Benchmarking: turns a raw annual footprint into context a person can act on.
 *
 * A number like "8,200 kg" means little on its own. This module compares it to
 * climate targets and regional averages so the user understands where they
 * stand and how far they are from a sustainable level.
 */

import { BENCHMARKS } from '../data/emissionFactors.js';
import { roundTo as round } from './math.js';

/**
 * Rating bands keyed off the per-capita climate targets. Ordered best-to-worst;
 * the first band whose ceiling the total falls under wins.
 */
const RATING_BANDS = [
  { id: 'excellent', label: 'Excellent', max: BENCHMARKS.sustainable },
  { id: 'good', label: 'Good', max: BENCHMARKS.paris2030 },
  { id: 'fair', label: 'Fair', max: BENCHMARKS.globalAverage },
  { id: 'high', label: 'High', max: BENCHMARKS.globalAverage * 1.75 },
  { id: 'veryHigh', label: 'Very high', max: Infinity },
];

/** Map a total to a qualitative rating band. */
export function rateFootprint(totalKg) {
  const total = Math.max(0, Number(totalKg) || 0);
  return RATING_BANDS.find((band) => total <= band.max) ?? RATING_BANDS.at(-1);
}

function ratio(value, reference) {
  if (!reference) return 0;
  return value / reference;
}

/**
 * Produce a full benchmark summary for a footprint total.
 *
 * @param {number} totalKg annual footprint in kg CO2e
 * @param {string} [region] grid region used as the "people like me" comparison
 */
export function benchmark(totalKg, region = 'world') {
  const total = Math.max(0, Number(totalKg) || 0);
  const regionalAverage = BENCHMARKS.regional[region] ?? BENCHMARKS.globalAverage;
  const rating = rateFootprint(total);

  return {
    totalKg: total,
    totalTonnes: round(total / 1000, 2),
    rating,
    targets: {
      paris2030: BENCHMARKS.paris2030,
      sustainable: BENCHMARKS.sustainable,
    },
    comparisons: {
      vsParis2030: round(ratio(total, BENCHMARKS.paris2030), 2),
      vsGlobalAverage: round(ratio(total, BENCHMARKS.globalAverage), 2),
      vsRegionalAverage: round(ratio(total, regionalAverage), 2),
    },
    /** How much the user must still cut (kg/yr) to hit the Paris 2030 budget. */
    gapToParis2030: round(Math.max(0, total - BENCHMARKS.paris2030)),
    regionalAverage,
  };
}

/**
 * Build a plain-language headline for the result. Kept separate from rendering
 * so it can be reused (UI, share text, tests) and verified deterministically.
 */
export function headline(summary) {
  const { vsGlobalAverage } = summary.comparisons;
  const tonnes = summary.totalTonnes;

  if (summary.rating.id === 'excellent') {
    return `Your estimated footprint is ${tonnes} t CO₂e a year — already within a sustainable range. Keep it up.`;
  }
  if (summary.gapToParis2030 === 0) {
    return `At ${tonnes} t CO₂e a year you're on track for the 2030 climate target. A little more gets you to a fully sustainable level.`;
  }

  const direction = vsGlobalAverage >= 1 ? 'above' : 'below';
  const pct = Math.round(Math.abs(vsGlobalAverage - 1) * 100);
  return `Your estimated footprint is ${tonnes} t CO₂e a year — about ${pct}% ${direction} the global average. To meet the 2030 target you'd cut roughly ${summary.gapToParis2030.toLocaleString()} kg.`;
}
