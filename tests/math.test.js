import { test } from 'node:test';
import assert from 'node:assert/strict';

import { roundTo } from '../src/core/math.js';

test('roundTo rounds to the requested precision', () => {
  assert.equal(roundTo(1.2345), 1.2); // defaults to 1 decimal place
  assert.equal(roundTo(1.234, 2), 1.23);
  assert.equal(roundTo(1.236, 2), 1.24);
  assert.equal(roundTo(2.5, 0), 3);
  assert.equal(roundTo(1000), 1000);
});

test('roundTo coerces junk into a finite 0', () => {
  assert.equal(roundTo('nope'), 0);
  assert.equal(roundTo(undefined), 0);
  assert.equal(roundTo(NaN), 0);
  assert.equal(roundTo(Infinity), 0);
  assert.equal(roundTo('3.14', 1), 3.1);
});
