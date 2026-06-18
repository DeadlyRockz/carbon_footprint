import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Exercises the storage happy path. helpers.test.js covers the no-storage
 * fallback (Node has no localStorage); here we install an in-memory storage
 * BEFORE importing the module so the persist + trim logic is actually run.
 *
 * Node's test runner isolates each test file in its own process, so this global
 * never leaks into the no-storage assertions in helpers.test.js.
 */
class MemoryStorage {
  #map = new Map();
  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }
  setItem(key, value) {
    this.#map.set(key, String(value));
  }
  removeItem(key) {
    this.#map.delete(key);
  }
}

globalThis.localStorage = new MemoryStorage();

const { isStorageAvailable, saveProfile, loadProfile, addHistoryEntry, loadHistory, clearHistory } =
  await import('../src/core/storage.js');

test('detects available storage and round-trips a profile', () => {
  assert.equal(isStorageAvailable(), true);
  assert.equal(loadProfile(), null, 'nothing saved yet');
  assert.equal(saveProfile({ diet: { type: 'vegan' } }), true);
  assert.deepEqual(loadProfile(), { diet: { type: 'vegan' } });
});

test('history appends, persists, and is bounded to MAX_HISTORY', () => {
  clearHistory();
  let history = [];
  for (let i = 0; i < 65; i += 1) {
    history = addHistoryEntry({ date: `2026-01-${i}`, total: i * 100, categories: {} });
  }
  assert.equal(history.length, 60, 'trimmed to the most recent 60 snapshots');
  assert.equal(loadHistory().length, 60, 'the trimmed list is what gets persisted');
  assert.equal(history.at(-1).total, 6400, 'keeps the newest entry');
  assert.deepEqual(clearHistory(), []);
  assert.deepEqual(loadHistory(), []);
});

test('loadHistory recovers from corrupt stored data', () => {
  localStorage.setItem('ecotrack:history', '{not valid json');
  assert.deepEqual(loadHistory(), [], 'falls back to an empty array, never throws');
});

test('storage that throws on probe is treated as unavailable', () => {
  const original = globalThis.localStorage;
  // Simulates a SecurityError (e.g. cookies disabled / strict private mode):
  // even the probe write throws, so the layer must report itself unusable.
  globalThis.localStorage = {
    getItem: () => null,
    removeItem: () => {},
    setItem() {
      throw new Error('SecurityError');
    },
  };
  assert.equal(isStorageAvailable(), false);
  assert.equal(saveProfile({ a: 1 }), false, 'save fails quietly, never throws');
  assert.deepEqual(loadHistory(), [], 'reads fall back too');
  globalThis.localStorage = original;
});

test('a write that exceeds quota fails quietly without throwing', () => {
  const original = globalThis.localStorage;
  const probeKey = '__ecotrack_probe__';
  // The probe succeeds (so storage looks available), but persisting real data
  // throws — exercising writeJson's defensive catch.
  globalThis.localStorage = {
    getItem: () => null,
    removeItem: () => {},
    setItem(key) {
      if (key === probeKey) return;
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(isStorageAvailable(), true, 'probe write is accepted');
  assert.equal(saveProfile({ big: 'data' }), false, 'the real write fails gracefully');
  // addHistoryEntry still returns the would-be list even when it cannot persist.
  const result = addHistoryEntry({ date: '2026-01-01', total: 1000, categories: {} });
  assert.equal(result.length, 1);
  globalThis.localStorage = original;
});
