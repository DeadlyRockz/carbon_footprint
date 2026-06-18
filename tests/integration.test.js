import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS } from '../src/presets.js';
import { calculateFootprint, rankCategories } from '../src/core/calculator.js';
import { benchmark, headline } from '../src/core/benchmarks.js';
import { recommend } from '../src/core/recommendations.js';
import {
  projectFootprint,
  autoSelectForTarget,
  goalStatus,
  goalPresets,
} from '../src/core/planner.js';
import { coachingNote, goalMessage } from '../src/core/insights.js';
import { BENCHMARKS } from '../src/data/emissionFactors.js';

/**
 * Drives the exact engine pipeline the UI runs for every preset, asserting the
 * end-to-end invariants the interface depends on. This catches integration
 * breakage between modules without needing a browser.
 */
for (const [name, profile] of Object.entries(PRESETS)) {
  test(`full UI pipeline is consistent for the "${name}" profile`, () => {
    const footprint = calculateFootprint(profile);
    const summary = benchmark(footprint.total, profile.home.gridRegion);
    const plan = recommend(profile, footprint);
    const ranked = rankCategories(footprint);

    // Headline + coaching are non-empty strings the UI can render.
    assert.ok(headline(summary).length > 10);
    assert.ok(coachingNote(footprint, ranked, plan).length > 10);

    // Default goal = 2030 target; auto-selected plan is a valid subset.
    const presets = goalPresets(footprint.total, BENCHMARKS);
    const target = presets.find((p) => p.id === 'paris2030').targetKg;
    const selected = autoSelectForTarget(footprint, plan.recommendations, target);
    const ids = new Set(plan.recommendations.map((r) => r.id));
    assert.ok(selected.every((id) => ids.has(id)), 'selection ⊆ recommendations');

    // Projection invariants hold for the selected plan.
    const projection = projectFootprint(footprint, plan.recommendations, selected);
    assert.ok(projection.projectedTotal >= 0);
    assert.ok(projection.projectedTotal <= footprint.total);

    // Gauge math: every value maps to a 0–100% position.
    const scaleMax = Math.max(footprint.total, target) || 1;
    for (const v of [footprint.total, projection.projectedTotal, target]) {
      const pct = (v / scaleMax) * 100;
      assert.ok(pct >= 0 && pct <= 100, 'gauge percentage in range');
    }

    // Goal message is a coherent status string.
    const status = goalStatus(projection.projectedTotal, target);
    assert.ok(goalMessage(status, projection.projectedTotal).length > 10);
  });
}

test('switching goals re-plans toward a stricter target', () => {
  const profile = PRESETS.flyer;
  const footprint = calculateFootprint(profile);
  const plan = recommend(profile, footprint);

  const looseSel = autoSelectForTarget(footprint, plan.recommendations, footprint.total * 0.9);
  const strictSel = autoSelectForTarget(footprint, plan.recommendations, footprint.total * 0.5);

  assert.ok(
    strictSel.length >= looseSel.length,
    'a tougher goal selects at least as many actions',
  );
});
