import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultProfile,
  calculateFootprint,
  toNonNegativeNumber,
  annualize,
  rankCategories,
} from '../src/core/calculator.js';

test('toNonNegativeNumber sanitizes untrusted input', () => {
  assert.equal(toNonNegativeNumber('5.5'), 5.5);
  assert.equal(toNonNegativeNumber(''), 0);
  assert.equal(toNonNegativeNumber('not a number'), 0);
  assert.equal(toNonNegativeNumber(-10), 0, 'negatives clamp to 0');
  assert.equal(toNonNegativeNumber(undefined, 1), 1, 'uses fallback');
  assert.equal(toNonNegativeNumber(Infinity), 0, 'rejects non-finite');
});

test('annualize scales by the chosen period', () => {
  assert.equal(annualize(100, 'month'), 1200);
  assert.equal(annualize(10, 'week'), 520);
  assert.equal(annualize(1, 'day'), 365);
  assert.equal(annualize(500, 'year'), 500);
  assert.equal(annualize(100, 'nonsense'), 100, 'unknown period falls back to yearly');
});

test('a default profile sums diet + shopping + waste only', () => {
  const result = calculateFootprint(createDefaultProfile());
  // average diet 5.6*365 + shopping 1500 + waste 320
  assert.equal(result.categories.diet, 2044);
  assert.equal(result.categories.shopping, 1500);
  assert.equal(result.categories.waste, 320);
  assert.equal(result.categories.transport, 0);
  assert.equal(result.total, 3864);
});

test('car emissions scale by distance, fuel and period', () => {
  const profile = createDefaultProfile();
  profile.transport.carKm = 100; // per month
  const result = calculateFootprint(profile);
  // 100 km/month -> 1200 km/yr * 0.192 petrol
  assert.equal(result.categories.transport, 230.4);
});

test('car occupancy divides per-person emissions', () => {
  const single = createDefaultProfile();
  single.transport.carKm = 1000;
  single.period = 'year';

  const shared = structuredClone(single);
  shared.transport.carOccupancy = 2;

  const a = calculateFootprint(single).categories.transport;
  const b = calculateFootprint(shared).categories.transport;
  assert.equal(b, a / 2);
});

test('flights are counted annually, not scaled by period', () => {
  const monthly = createDefaultProfile();
  monthly.period = 'month';
  monthly.transport.flightsLongPerYear = 1;

  const yearly = structuredClone(monthly);
  yearly.period = 'year';

  const m = calculateFootprint(monthly).categories.transport;
  const y = calculateFootprint(yearly).categories.transport;
  assert.equal(m, y, 'flight emissions are identical regardless of input period');
  assert.equal(y, 1350, '1 long-haul return: 9000 km * 0.15');
});

test('home energy is split across the household', () => {
  const profile = createDefaultProfile();
  profile.period = 'month';
  profile.home.electricityKwh = 100; // 1200 kWh/yr
  profile.home.gridRegion = 'world'; // 0.475
  profile.home.householdSize = 2;
  const result = calculateFootprint(profile);
  // 1200 * 0.475 / 2 = 285
  assert.equal(result.categories.home, 285);
});

test('recycling reduces waste emissions', () => {
  const profile = createDefaultProfile();
  profile.waste.recycles = true;
  const result = calculateFootprint(profile);
  // 320 * (1 - 0.45) = 176
  assert.equal(result.categories.waste, 176);
});

test('rankCategories orders by contribution and shares sum to ~1', () => {
  const profile = createDefaultProfile();
  profile.transport.carKm = 2000;
  const footprint = calculateFootprint(profile);
  const ranked = rankCategories(footprint);

  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].value >= ranked[i].value, 'descending order');
  }
  const shareSum = ranked.reduce((sum, c) => sum + c.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9, 'shares add up to 1');
});

test('malformed profiles never throw and never produce NaN', () => {
  const result = calculateFootprint({ transport: { carKm: 'oops' }, home: null });
  assert.ok(Number.isFinite(result.total));
  assert.ok(result.total >= 0);
});
