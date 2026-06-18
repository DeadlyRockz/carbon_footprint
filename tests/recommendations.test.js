import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultProfile, calculateFootprint } from '../src/core/calculator.js';
import { recommend } from '../src/core/recommendations.js';

function planFor(profile) {
  const footprint = calculateFootprint(profile);
  return { footprint, plan: recommend(profile, footprint) };
}

test('a heavy petrol driver is told to address transport first', () => {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 20000;
  profile.transport.carFuel = 'petrol';

  const { plan } = planFor(profile);
  assert.ok(plan.recommendations.length > 0);
  assert.equal(plan.recommendations[0].category, 'transport');
  assert.ok(plan.recommendations[0].savingKg > 0);
});

test('recommendations are sorted by impact-per-effort, descending', () => {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 18000;
  profile.diet.type = 'meatHeavy';
  profile.home.electricityKwh = 6000;

  const { plan } = planFor(profile);
  for (let i = 1; i < plan.recommendations.length; i += 1) {
    assert.ok(
      plan.recommendations[i - 1].impactScore >= plan.recommendations[i].impactScore,
      'each recommendation scores <= the one before it',
    );
  }
});

test('context drives which actions appear: EV owner gets no "switch to EV"', () => {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 20000;
  profile.transport.carFuel = 'electric';

  const { plan } = planFor(profile);
  assert.ok(!plan.recommendations.some((r) => r.id === 'switch-ev'));
});

test('a meat-heavy diet yields a quantified diet-shift action', () => {
  const profile = createDefaultProfile();
  profile.diet.type = 'meatHeavy';

  const { plan } = planFor(profile);
  const diet = plan.recommendations.find((r) => r.id === 'diet-shift');
  assert.ok(diet, 'diet-shift should be recommended');
  // meatHeavy (7.2) -> lowMeat (4.7) over a year
  assert.equal(diet.savingKg, Math.round((7.2 - 4.7) * 365 * 10) / 10);
});

test('a vegan is never told to shift their diet', () => {
  const profile = createDefaultProfile();
  profile.diet.type = 'vegan';

  const { plan } = planFor(profile);
  assert.ok(!plan.recommendations.some((r) => r.id === 'diet-shift'));
});

test('a non-recycler is prompted to recycle; a recycler is not', () => {
  const base = createDefaultProfile();
  base.waste.level = 'high';

  const nonRecycler = planFor({ ...base, waste: { level: 'high', recycles: false } });
  assert.ok(nonRecycler.plan.recommendations.some((r) => r.id === 'recycle-compost'));

  const recycler = planFor({ ...base, waste: { level: 'high', recycles: true } });
  assert.ok(!recycler.plan.recommendations.some((r) => r.id === 'recycle-compost'));
});

test('projected total is bounded: never negative, never above current', () => {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 50000; // extreme, would over-saturate transport
  profile.transport.flightsLongPerYear = 8;
  profile.diet.type = 'meatHeavy';

  const { footprint, plan } = planFor(profile);
  assert.ok(plan.projectedTotal >= 0, 'cannot go negative');
  assert.ok(plan.projectedTotal <= footprint.total, 'cannot exceed current');
  assert.equal(
    plan.totalPotentialSaving,
    Math.round((footprint.total - plan.projectedTotal) * 10) / 10,
  );
});

test('an already-green profile produces few or no actions', () => {
  const profile = createDefaultProfile();
  profile.diet.type = 'vegan';
  profile.shopping.level = 'low';
  profile.waste = { level: 'low', recycles: true };
  profile.home.gridRegion = 'renewable';

  const { plan } = planFor(profile);
  assert.ok(plan.recommendations.length <= 2);
});

test('the limit option caps the number of recommendations', () => {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 25000;
  profile.transport.flightsShortPerYear = 6;
  profile.transport.flightsLongPerYear = 3;
  profile.diet.type = 'meatHeavy';
  profile.home.electricityKwh = 8000;
  profile.home.naturalGasKwh = 12000;
  profile.shopping.level = 'high';

  const footprint = calculateFootprint(profile);
  const plan = recommend(profile, footprint, { limit: 3 });
  assert.equal(plan.recommendations.length, 3);
});
