import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chartGeometry } from '../src/chart.js';

test('empty series yields no points', () => {
  const geo = chartGeometry([]);
  assert.deepEqual(geo.points, []);
});

test('a single point is centered horizontally', () => {
  const geo = chartGeometry([5], { width: 300, height: 100, pad: 10 });
  assert.equal(geo.points.length, 1);
  assert.equal(geo.points[0].x, 150);
});

test('points span the padded width and map values to height', () => {
  const geo = chartGeometry([10, 20, 30], { width: 320, height: 120, pad: 10 });
  assert.equal(geo.points[0].x, 10, 'first point at left padding');
  assert.equal(geo.points.at(-1).x, 310, 'last point at right padding');
  // Highest value sits at the top (smallest y); lowest at the bottom.
  assert.ok(geo.points[2].y < geo.points[0].y);
  assert.equal(geo.min, 10);
  assert.equal(geo.max, 30);
});

test('a flat series does not divide by zero', () => {
  const geo = chartGeometry([7, 7, 7], { width: 100, height: 100, pad: 10 });
  assert.ok(geo.points.every((p) => Number.isFinite(p.y)));
});

test('non-numeric values are coerced to 0', () => {
  const geo = chartGeometry([null, 'x', 4]);
  assert.ok(geo.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(geo.min, 0);
});
