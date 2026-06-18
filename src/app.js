/**
 * Controller — wires the form and buttons to the pure calculation / recommendation
 * / planner engines, drives the renderers in ui/render.js, and owns persistence
 * and PWA plumbing. It deliberately holds no rendering or DOM-building logic of
 * its own: the toolkit lives in ui/dom.js, the views in ui/render.js, and the
 * form mapping in ui/form.js, leaving this file as a thin orchestrator.
 *
 * Security: all dynamic content is inserted through the injection-safe helpers
 * in ui/dom.js, and every byte of data stays on the user's own device.
 */

import { calculateFootprint, rankCategories, toNonNegativeNumber } from './core/calculator.js';
import { benchmark, headline } from './core/benchmarks.js';
import { recommend } from './core/recommendations.js';
import { autoSelectForTarget, goalPresets } from './core/planner.js';
import { coachingNote } from './core/insights.js';
import { formatTonnes, isoDate } from './core/format.js';
import { BENCHMARKS } from './data/emissionFactors.js';
import {
  saveProfile,
  loadProfile,
  addHistoryEntry,
  loadHistory,
  clearHistory,
} from './core/storage.js';
import { PRESETS } from './presets.js';

import { state } from './ui/state.js';
import { el, $, scrollIntoViewSafe } from './ui/dom.js';
import { readProfile, applyProfile } from './ui/form.js';
import {
  renderBreakdown,
  renderBenchmark,
  renderGoalOptions,
  renderGauge,
  renderRecommendations,
  reselectForTarget,
} from './ui/render.js';
import { renderHistory } from './ui/tracker.js';

/* ------------------------------------------------------------------ */
/* Compute + render                                                    */
/* ------------------------------------------------------------------ */

function computeAndRender(profile) {
  const footprint = calculateFootprint(profile);
  const summary = benchmark(footprint.total, profile.home.gridRegion);
  const plan = recommend(profile, footprint);
  const ranked = rankCategories(footprint);

  state.profile = profile;
  state.footprint = footprint;
  state.summary = summary;
  state.plan = plan;
  state.presets = goalPresets(footprint.total, BENCHMARKS);
  state.goalId = 'paris2030';
  state.targetKg = BENCHMARKS.paris2030;
  state.selected = new Set(autoSelectForTarget(footprint, plan.recommendations, state.targetKg));
  $('custom-goal-wrap').hidden = true; // reset any prior custom-goal state

  $('total-tonnes').textContent = formatTonnes(footprint.total);
  const badge = $('rating-badge');
  badge.textContent = summary.rating.label;
  badge.setAttribute('data-rating', summary.rating.id);
  $('headline').textContent = headline(summary);
  $('coaching').textContent = coachingNote(footprint, ranked, plan);

  renderBreakdown(footprint, ranked);
  renderBenchmark(summary);
  renderGoalOptions();
  renderRecommendations();
  renderGauge();

  const results = $('results');
  results.hidden = false;

  // Announce the headline result to assistive tech as soon as it's ready.
  $('sr-status').textContent = `Your estimated footprint is ${formatTonnes(
    footprint.total,
  )} CO₂e per year — rating: ${summary.rating.label}. ${headline(summary)}`;

  results.focus?.();
}

function exportData() {
  const payload = {
    app: 'EcoTrack',
    exportedAt: new Date().toISOString(),
    profile: loadProfile(),
    history: loadHistory(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `ecotrack-${isoDate()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function init() {
  const form = $('footprint-form');

  const saved = loadProfile();
  if (saved) applyProfile(form, saved);
  renderHistory(loadHistory());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = readProfile(form);
    saveProfile(profile);
    computeAndRender(profile);
  });

  form.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      $('results').hidden = true;
      state.footprint = null;
    });
  });

  // Quick-start presets fill the form and immediately show a result.
  for (const chip of document.querySelectorAll('[data-preset]')) {
    chip.addEventListener('click', () => {
      const preset = PRESETS[chip.dataset.preset];
      if (!preset) return;
      applyProfile(form, preset);
      saveProfile(preset);
      computeAndRender(preset);
      scrollIntoViewSafe($('results'));
    });
  }

  $('custom-goal').addEventListener('input', (e) => {
    if (state.goalId !== 'custom') return;
    state.targetKg = Math.max(0, toNonNegativeNumber(e.target.value) * 1000);
    reselectForTarget();
    renderRecommendations();
    renderGauge();
  });

  $('save-entry').addEventListener('click', () => {
    if (!state.footprint) return;
    const history = addHistoryEntry({
      date: isoDate(),
      total: state.footprint.total,
      categories: state.footprint.categories,
    });
    renderHistory(history);
    scrollIntoViewSafe($('tracker'));
  });

  $('clear-history').addEventListener('click', () => renderHistory(clearHistory()));
  $('export-data').addEventListener('click', exportData);

  setupInstallPrompt();
  registerServiceWorker();
}

function setupInstallPrompt() {
  const installBtn = $('install');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Service workers require a secure/localhost http origin; this no-ops on file://.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
