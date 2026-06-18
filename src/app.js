/**
 * UI controller — wires the form to the pure calculation / recommendation /
 * planner engines and renders an interactive, goal-driven action plan.
 *
 * Security: every piece of dynamic content is inserted via textContent or typed
 * DOM properties, never innerHTML. All data is the user's own and stays
 * on-device, so the injection surface is effectively nil.
 */

import {
  createDefaultProfile,
  calculateFootprint,
  rankCategories,
  toNonNegativeNumber,
} from './core/calculator.js';
import { benchmark, headline } from './core/benchmarks.js';
import { recommend } from './core/recommendations.js';
import { projectFootprint, autoSelectForTarget, goalStatus, goalPresets } from './core/planner.js';
import { coachingNote, goalMessage, progressMessage } from './core/insights.js';
import { formatKg, formatTonnes, formatPercent, treesEquivalent, isoDate } from './core/format.js';
import { lineChartSVG } from './chart.js';
import { BENCHMARKS } from './data/emissionFactors.js';
import {
  saveProfile,
  loadProfile,
  addHistoryEntry,
  loadHistory,
  clearHistory,
} from './core/storage.js';
import { PRESETS } from './presets.js';

/** Tiny element builder to keep rendering declarative and injection-safe. */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') throw new Error('innerHTML is intentionally not supported');
    else if (key.startsWith('data-') || key === 'role' || key === 'for') node.setAttribute(key, value);
    else if (key === 'aria') {
      for (const [a, v] of Object.entries(value)) node.setAttribute(`aria-${a}`, v);
    } else node[key] = value;
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
}

const $ = (id) => document.getElementById(id);

/** Single source of truth for the current result + interactive plan. */
const state = {
  profile: null,
  footprint: null,
  summary: null,
  plan: null,
  presets: [],
  goalId: 'paris2030',
  targetKg: BENCHMARKS.paris2030,
  selected: new Set(),
};

/* ------------------------------------------------------------------ */
/* Form <-> profile                                                    */
/* ------------------------------------------------------------------ */

function readProfile(form) {
  const data = new FormData(form);
  const get = (name) => data.get(name);
  return {
    period: get('period') || 'month',
    transport: {
      carKm: toNonNegativeNumber(get('carKm')),
      carFuel: get('carFuel') || 'petrol',
      carOccupancy: Math.max(1, toNonNegativeNumber(get('carOccupancy'), 1)),
      busKm: toNonNegativeNumber(get('busKm')),
      trainKm: toNonNegativeNumber(get('trainKm')),
      flightsShortPerYear: toNonNegativeNumber(get('flightsShortPerYear')),
      flightsLongPerYear: toNonNegativeNumber(get('flightsLongPerYear')),
    },
    home: {
      electricityKwh: toNonNegativeNumber(get('electricityKwh')),
      gridRegion: get('gridRegion') || 'world',
      naturalGasKwh: toNonNegativeNumber(get('naturalGasKwh')),
      householdSize: Math.max(1, toNonNegativeNumber(get('householdSize'), 1)),
    },
    diet: { type: get('dietType') || 'average' },
    shopping: { level: get('shoppingLevel') || 'average' },
    waste: { level: get('wasteLevel') || 'average', recycles: get('recycles') === 'on' },
  };
}

function applyProfile(form, profile) {
  const p = { ...createDefaultProfile(), ...profile };
  const set = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  };
  set('period', p.period);
  set('carKm', p.transport.carKm);
  set('carFuel', p.transport.carFuel);
  set('carOccupancy', p.transport.carOccupancy);
  set('busKm', p.transport.busKm);
  set('trainKm', p.transport.trainKm);
  set('flightsShortPerYear', p.transport.flightsShortPerYear);
  set('flightsLongPerYear', p.transport.flightsLongPerYear);
  set('electricityKwh', p.home.electricityKwh);
  set('gridRegion', p.home.gridRegion);
  set('naturalGasKwh', p.home.naturalGasKwh);
  set('householdSize', p.home.householdSize);
  set('dietType', p.diet.type);
  set('shoppingLevel', p.shopping.level);
  set('wasteLevel', p.waste.level);
  const recycles = form.elements.namedItem('recycles');
  if (recycles) recycles.checked = Boolean(p.waste.recycles);
}

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
  results.focus?.();
}

function renderBreakdown(footprint, ranked) {
  const list = $('breakdown');
  list.replaceChildren();
  const max = ranked[0]?.value || 1;

  for (const cat of ranked) {
    const pct = max ? Math.round((cat.value / max) * 100) : 0;
    list.append(
      el('li', { class: 'bar-row' }, [
        el('div', { class: 'bar-label' }, [
          el('span', { text: cat.label }),
          el('span', {
            class: 'bar-value',
            text: `${formatKg(cat.value)} · ${formatPercent(cat.share)}`,
          }),
        ]),
        el(
          'div',
          {
            class: 'bar-track',
            role: 'img',
            aria: { label: `${cat.label}: ${formatPercent(cat.share)} of your footprint` },
          },
          el('div', { class: 'bar-fill', style: `width:${pct}%` }),
        ),
      ]),
    );
  }
}

function renderBenchmark(summary) {
  const box = $('benchmark');
  box.replaceChildren();
  box.append(
    el('p', { text: 'How you compare:', style: 'margin:0;font-weight:600;' }),
    el('dl', {}, [
      el('dt', { text: 'vs. 2030 climate target (2.3 t)' }),
      el('dd', { text: `${summary.comparisons.vsParis2030}×` }),
      el('dt', { text: 'vs. global average (4.7 t)' }),
      el('dd', { text: `${summary.comparisons.vsGlobalAverage}×` }),
      el('dt', { text: 'Trees needed to absorb it for a year' }),
      el('dd', { text: treesEquivalent(summary.totalKg).toLocaleString('en-US') }),
    ]),
  );
}

/* ------------------------------------------------------------------ */
/* Goal picker + gauge (the interactive "what-if")                     */
/* ------------------------------------------------------------------ */

function renderGoalOptions() {
  const wrap = $('goal-options');
  wrap.replaceChildren();

  const options = [
    ...state.presets.map((p) => ({ ...p })),
    { id: 'custom', label: 'Custom', detail: 'Set your own target', targetKg: null },
  ];

  for (const opt of options) {
    const input = el('input', {
      type: 'radio',
      name: 'goal',
      value: opt.id,
      class: 'goal-radio',
      checked: opt.id === state.goalId,
    });
    input.addEventListener('change', () => onGoalChange(opt.id));
    wrap.append(
      el('label', { class: 'goal-option' }, [
        input,
        el('span', { class: 'goal-text' }, [
          el('span', { class: 'goal-name', text: opt.label }),
          el('span', { class: 'goal-detail', text: opt.detail }),
        ]),
      ]),
    );
  }
}

function onGoalChange(goalId) {
  state.goalId = goalId;
  const customWrap = $('custom-goal-wrap');

  if (goalId === 'custom') {
    customWrap.hidden = false;
    const input = $('custom-goal');
    if (!input.value) input.value = (state.targetKg / 1000).toFixed(1);
    state.targetKg = Math.max(0, toNonNegativeNumber(input.value) * 1000);
    input.focus();
  } else {
    customWrap.hidden = true;
    const preset = state.presets.find((p) => p.id === goalId);
    state.targetKg = preset ? preset.targetKg : BENCHMARKS.paris2030;
  }

  state.selected = new Set(
    autoSelectForTarget(state.footprint, state.plan.recommendations, state.targetKg),
  );
  renderRecommendations();
  renderGauge();
}

function renderGauge() {
  const { footprint, plan, selected, targetKg } = state;
  const projection = projectFootprint(footprint, plan.recommendations, selected);
  const projected = projection.projectedTotal;
  const status = goalStatus(projected, targetKg);

  const scaleMax = Math.max(footprint.total, targetKg) || 1;
  const pct = (v) => Math.max(0, Math.min(100, (v / scaleMax) * 100));

  const gauge = $('gauge');
  gauge.replaceChildren();
  gauge.append(
    el(
      'div',
      {
        class: 'gauge-track',
        role: 'img',
        aria: {
          label: `Now ${formatTonnes(footprint.total)}, projected ${formatTonnes(
            projected,
          )}, goal ${formatTonnes(targetKg)}.`,
        },
      },
      [
        el('div', { class: 'gauge-current', style: `width:${pct(footprint.total)}%` }),
        el('div', {
          class: `gauge-projected ${status.reached ? 'is-reached' : ''}`,
          style: `width:${pct(projected)}%`,
        }),
        el('div', { class: 'gauge-target', style: `left:${pct(targetKg)}%`, title: 'Goal' }),
      ],
    ),
    el('div', { class: 'gauge-legend' }, [
      el('span', {}, [el('b', { text: 'Now ' }), document.createTextNode(formatTonnes(footprint.total))]),
      el('span', { class: 'proj' }, [
        el('b', { text: 'Projected ' }),
        document.createTextNode(formatTonnes(projected)),
      ]),
      el('span', {}, [el('b', { text: 'Goal ' }), document.createTextNode(formatTonnes(targetKg))]),
    ]),
  );

  $('goal-message').textContent = goalMessage(status, projected);
}

function renderRecommendations() {
  const list = $('recommendations');
  list.replaceChildren();

  if (!state.plan.recommendations.length) {
    list.append(
      el('li', { class: 'rec rec--empty' }, [
        el('p', {
          class: 'rec-detail',
          text: 'No high-impact action is left to suggest — your footprint is already low across the board. 🌍',
        }),
      ]),
    );
    return;
  }

  for (const rec of state.plan.recommendations) {
    const on = state.selected.has(rec.id);
    const checkbox = el('input', {
      type: 'checkbox',
      id: `rec-${rec.id}`,
      class: 'rec-check',
      'data-id': rec.id,
      checked: on,
    });
    checkbox.addEventListener('change', (e) => onToggleAction(rec.id, e.target.checked));

    list.append(
      el('li', { class: `rec ${on ? 'rec--on' : ''}`, id: `li-${rec.id}` }, [
        el('div', { class: 'rec-row' }, [
          checkbox,
          el('div', { class: 'rec-body' }, [
            el('div', { class: 'rec-head' }, [
              el('label', { class: 'rec-title', for: `rec-${rec.id}`, text: rec.title }),
              el('span', { class: 'rec-saving', text: `−${formatKg(rec.savingKg)}/yr` }),
            ]),
            el('p', { class: 'rec-detail', text: rec.detail }),
            el('div', { class: 'rec-meta' }, [
              el('span', { class: 'tag', text: rec.categoryLabel }),
              el('span', { class: 'tag', 'data-effort': rec.effort, text: '' }),
            ]),
          ]),
        ]),
      ]),
    );
  }
}

function onToggleAction(id, checked) {
  if (checked) state.selected.add(id);
  else state.selected.delete(id);
  $(`li-${id}`)?.classList.toggle('rec--on', checked);
  renderGauge();
}

/* ------------------------------------------------------------------ */
/* Tracker: history, trend chart, export                               */
/* ------------------------------------------------------------------ */

function renderHistory(history) {
  const section = $('tracker');
  const list = $('history');
  const trend = $('trend');
  list.replaceChildren();
  trend.replaceChildren();

  if (!history.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  // Trend chart (needs at least one point; a line needs two).
  const tonnes = history.map((h) => h.total / 1000);
  trend.append(lineChartSVG(tonnes, { height: 130 }));

  $('progress-msg').textContent = progressMessage(
    history.at(-1).total,
    history.length > 1 ? history.at(-2).total : null,
  );

  history
    .slice()
    .reverse()
    .forEach((entry, idx, reversed) => {
      const prev = reversed[idx + 1];
      let delta;
      if (prev) {
        const diff = entry.total - prev.total;
        const down = diff <= 0;
        delta = el('span', {
          class: `h-delta ${down ? 'down' : 'up'}`,
          text: `${down ? '▼' : '▲'} ${formatKg(Math.abs(diff))}`,
        });
      } else {
        delta = el('span', { class: 'h-delta', text: 'baseline' });
      }
      list.append(
        el('li', {}, [
          el('span', { class: 'h-date', text: entry.date }),
          el('span', { class: 'h-total', text: formatTonnes(entry.total) }),
          delta,
        ]),
      );
    });
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
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  $('custom-goal').addEventListener('input', (e) => {
    if (state.goalId !== 'custom') return;
    state.targetKg = Math.max(0, toNonNegativeNumber(e.target.value) * 1000);
    state.selected = new Set(
      autoSelectForTarget(state.footprint, state.plan.recommendations, state.targetKg),
    );
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
    $('tracker').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
