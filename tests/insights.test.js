import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultProfile,
  calculateFootprint,
  rankCategories,
} from '../src/core/calculator.js';
import { recommend } from '../src/core/recommendations.js';
import { goalStatus } from '../src/core/planner.js';
import { coachingNote, goalMessage, progressMessage } from '../src/core/insights.js';

test('coachingNote names the dominant category and the top action', () => {
  const profile = createDefaultProfile();
  profile.period = 'year';
  profile.transport.carKm = 25000; // makes transport dominate
  const footprint = calculateFootprint(profile);
  const ranked = rankCategories(footprint);
  const plan = recommend(profile, footprint);

  const note = coachingNote(footprint, ranked, plan);
  assert.ok(note.toLowerCase().includes('transport'), 'mentions the biggest lever');
  assert.ok(note.includes(plan.recommendations[0].title), 'mentions the top action');
});

test('coachingNote congratulates an already-green user', () => {
  const profile = createDefaultProfile();
  profile.diet.type = 'vegan';
  profile.shopping.level = 'low';
  profile.waste = { level: 'low', recycles: true };
  const footprint = calculateFootprint(profile);
  const ranked = rankCategories(footprint);
  const plan = recommend(profile, footprint);

  const note = coachingNote(footprint, ranked, plan);
  assert.ok(/sustainable|keep it/i.test(note));
});

test('coachingNote handles an empty footprint gracefully', () => {
  const note = coachingNote({ total: 0 }, [], { recommendations: [] });
  assert.ok(typeof note === 'string' && note.length > 0);
});

test('goalMessage celebrates when the goal is reached', () => {
  const msg = goalMessage(goalStatus(2000, 2300), 2000);
  assert.ok(msg.includes('🎉'));
});

test('goalMessage nudges when still short of the goal', () => {
  const msg = goalMessage(goalStatus(3000, 2300), 3000);
  assert.ok(/still|above|close the gap/i.test(msg));
});

test('progressMessage distinguishes baseline, improvement and regression', () => {
  assert.ok(/baseline/i.test(progressMessage(5000, null)));
  assert.ok(/progress|down/i.test(progressMessage(4000, 5000)));
  assert.ok(/up|reverse/i.test(progressMessage(5200, 5000)));
});

test('progressMessage acknowledges a flat result within the ±1 kg deadband', () => {
  assert.ok(/about the same/i.test(progressMessage(5000, 5000)));
  assert.ok(/about the same/i.test(progressMessage(5000.5, 5000)), 'sub-kg drift counts as steady');
});
