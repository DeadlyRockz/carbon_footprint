import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatKg, formatTonnes, formatPercent, treesEquivalent } from '../src/core/format.js';
import {
  isStorageAvailable,
  saveProfile,
  loadProfile,
  loadHistory,
  addHistoryEntry,
} from '../src/core/storage.js';

test('format helpers present numbers cleanly', () => {
  assert.equal(formatKg(8210.6), '8,211 kg');
  assert.equal(formatTonnes(8200), '8.2 t');
  assert.equal(formatPercent(0.366), '37%');
  assert.equal(treesEquivalent(210), 10);
});

test('format helpers tolerate junk input', () => {
  assert.equal(formatKg('nope'), '0 kg');
  assert.equal(formatTonnes(undefined), '0.0 t');
  assert.equal(formatPercent(null), '0%');
});

test('storage degrades gracefully without a browser', () => {
  // In Node there is no localStorage, so the layer must no-op safely.
  assert.equal(isStorageAvailable(), false);
  assert.equal(saveProfile({ a: 1 }), false);
  assert.equal(loadProfile(), null);
  assert.deepEqual(loadHistory(), []);

  const result = addHistoryEntry({ date: '2026-01-01', total: 1000, categories: {} });
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1, 'returns the would-be history even when it cannot persist');
});
