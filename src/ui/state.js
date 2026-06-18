/**
 * The single source of truth for the current result and interactive plan.
 *
 * It lives in its own module so the controller (app.js) and the renderers
 * (ui/render.js) read and mutate the exact same object — no prop-drilling, no
 * duplicated copies that can drift out of sync.
 */

import { BENCHMARKS } from '../data/emissionFactors.js';

export const state = {
  profile: null,
  footprint: null,
  summary: null,
  plan: null,
  presets: [],
  goalId: 'paris2030',
  targetKg: BENCHMARKS.paris2030,
  selected: new Set(),
};
