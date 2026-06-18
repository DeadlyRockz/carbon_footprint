import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultProfile, calculateFootprint } from '../src/core/calculator.js';
import { recommend } from '../src/core/recommendations.js';
import {
  projectFootprint,
  autoSelectForTarget,
  goalStatus,
  goalPresets,
} from '../src/core/planner.js';
import { BENCHMARKS } from '../src/data/emissionFactors.js';

function setup() {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 18000;
  profile.transport.flightsLongPerYear = 2;
  profile.diet.type = 'meatHeavy';
  profile.home.electricityKwh = 5000;
  const footprint = calculateFootprint(profile);
  const plan = recommend(profile, footprint);
  return { profile, footprint, plan };
}

test('projecting with no actions returns the original footprint', () => {
  const { footprint, plan } = setup();
  const result = projectFootprint(footprint, plan.recommendations, []);
  assert.equal(result.projectedTotal, footprint.total);
  assert.equal(result.totalSaving, 0);
});

test('projecting with all actions matches recommend()', () => {
  const { footprint, plan } = setup();
  const ids = plan.recommendations.map((r) => r.id);
  const result = projectFootprint(footprint, plan.recommendations, ids);
  assert.equal(result.projectedTotal, plan.projectedTotal);
  assert.equal(result.totalSaving, plan.totalPotentialSaving);
});

test('selecting more actions never increases the projected total', () => {
  const { footprint, plan } = setup();
  const ids = plan.recommendations.map((r) => r.id);
  let prev = footprint.total;
  for (let i = 1; i <= ids.length; i += 1) {
    const projected = projectFootprint(
      footprint,
      plan.recommendations,
      ids.slice(0, i),
    ).projectedTotal;
    assert.ok(projected <= prev, 'monotonically non-increasing');
    assert.ok(projected >= 0, 'never negative');
    prev = projected;
  }
});

test('savings are capped per category', () => {
  const { footprint, plan } = setup();
  const ids = plan.recommendations.map((r) => r.id);
  const { savingByCategory } = projectFootprint(footprint, plan.recommendations, ids);
  for (const [category, saved] of Object.entries(savingByCategory)) {
    assert.ok(saved <= footprint.categories[category] + 1e-9, `${category} not over-saved`);
  }
});

test('autoSelectForTarget reaches the target when achievable', () => {
  const { footprint, plan } = setup();
  const target = footprint.total * 0.7;
  const selected = autoSelectForTarget(footprint, plan.recommendations, target);
  const projected = projectFootprint(footprint, plan.recommendations, selected).projectedTotal;
  assert.ok(projected <= target, 'plan meets the target');
});

test('autoSelectForTarget returns nothing when already under target', () => {
  const { footprint, plan } = setup();
  const selected = autoSelectForTarget(footprint, plan.recommendations, footprint.total + 1000);
  assert.deepEqual(selected, []);
});

test('autoSelectForTarget is greedy: picks highest-impact first', () => {
  const { footprint, plan } = setup();
  const target = footprint.total - plan.recommendations[0].savingKg / 2;
  const selected = autoSelectForTarget(footprint, plan.recommendations, target);
  const topId = [...plan.recommendations].sort((a, b) => b.savingKg - a.savingKg)[0].id;
  assert.equal(selected[0], topId);
});

test('goalStatus reports reached / gap correctly', () => {
  assert.deepEqual(goalStatus(2000, 2300), {
    reached: true,
    gap: 0,
    overshoot: 300,
    targetKg: 2300,
  });
  const miss = goalStatus(3000, 2300);
  assert.equal(miss.reached, false);
  assert.equal(miss.gap, 700);
});

test('goalPresets includes a user-relative "halve" target', () => {
  const presets = goalPresets(8000, BENCHMARKS);
  const halve = presets.find((p) => p.id === 'halve');
  assert.equal(halve.targetKg, 4000);
  assert.ok(presets.some((p) => p.id === 'paris2030'));
});
