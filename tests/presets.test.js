import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS } from '../src/presets.js';
import { createDefaultProfile, calculateFootprint } from '../src/core/calculator.js';
import { recommend } from '../src/core/recommendations.js';

test('every preset is a complete, valid profile that calculates cleanly', () => {
  const requiredKeys = Object.keys(createDefaultProfile());

  for (const [name, preset] of Object.entries(PRESETS)) {
    for (const key of requiredKeys) {
      assert.ok(key in preset, `${name} preset is missing "${key}"`);
    }
    const footprint = calculateFootprint(preset);
    assert.ok(Number.isFinite(footprint.total) && footprint.total > 0, `${name} produces a total`);
  }
});

test('presets express meaningfully different lifestyles', () => {
  const flyer = calculateFootprint(PRESETS.flyer).total;
  const green = calculateFootprint(PRESETS.green).total;
  assert.ok(flyer > green * 2, 'the frequent flyer dwarfs the eco-conscious profile');
});

test('high-impact presets generate actionable recommendations', () => {
  const footprint = calculateFootprint(PRESETS.flyer);
  const plan = recommend(PRESETS.flyer, footprint);
  assert.ok(plan.recommendations.length >= 3);
  assert.ok(plan.totalPotentialSaving > 0);
});
