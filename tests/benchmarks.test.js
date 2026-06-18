import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rateFootprint, benchmark, headline } from '../src/core/benchmarks.js';

test('rateFootprint assigns the correct band', () => {
  assert.equal(rateFootprint(1500).id, 'excellent');
  assert.equal(rateFootprint(2200).id, 'good');
  assert.equal(rateFootprint(4000).id, 'fair');
  assert.equal(rateFootprint(7000).id, 'high');
  assert.equal(rateFootprint(20000).id, 'veryHigh');
});

test('rateFootprint handles boundary and invalid values', () => {
  assert.equal(rateFootprint(2000).id, 'excellent', 'inclusive upper bound');
  assert.equal(rateFootprint(-5).id, 'excellent', 'negatives clamp to 0');
  assert.equal(rateFootprint('NaN').id, 'excellent', 'invalid -> 0');
});

test('benchmark computes comparisons and the gap to target', () => {
  const summary = benchmark(4600, 'world');
  assert.equal(summary.totalTonnes, 4.6);
  assert.equal(summary.comparisons.vsParis2030, 2, '4600 / 2300');
  assert.equal(summary.comparisons.vsGlobalAverage, 0.98, '4600 / 4700');
  assert.equal(summary.gapToParis2030, 2300, 'must cut 2300 to hit target');
});

test('benchmark reports no gap once under the Paris target', () => {
  const summary = benchmark(2000);
  assert.equal(summary.gapToParis2030, 0);
  assert.equal(summary.rating.id, 'excellent');
});

test('regional comparison uses the selected region', () => {
  const summary = benchmark(7350, 'us'); // US avg 14700
  assert.equal(summary.comparisons.vsRegionalAverage, 0.5);
});

test('headline is a non-empty human-readable string', () => {
  const summary = benchmark(8200, 'world');
  const text = headline(summary);
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 20);
  assert.ok(text.includes('8.2 t'));
});
