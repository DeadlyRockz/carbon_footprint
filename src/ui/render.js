/**
 * View layer — turns the current state into DOM, and owns the small in-result
 * interactions (picking a goal, toggling an action) that re-render parts of it.
 *
 * Every renderer reads from the shared `state` singleton and writes through the
 * injection-safe el() builder, so the controller only has to decide *when* to
 * render, never *how*.
 */

import { state } from './state.js';
import { el, $ } from './dom.js';
import { formatKg, formatTonnes, formatPercent, treesEquivalent } from '../core/format.js';
import { toNonNegativeNumber } from '../core/calculator.js';
import { projectFootprint, autoSelectForTarget, goalStatus } from '../core/planner.js';
import { goalMessage } from '../core/insights.js';
import { BENCHMARKS } from '../data/emissionFactors.js';

/** Spoken effort labels — kept in the DOM (not CSS) so assistive tech reads them. */
const EFFORT_LABEL = Object.freeze({
  low: 'Easy win',
  medium: 'Moderate',
  high: 'Bigger change',
});

export function renderBreakdown(footprint, ranked) {
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

export function renderBenchmark(summary) {
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

export function renderGoalOptions() {
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

  reselectForTarget();
  renderRecommendations();
  renderGauge();
}

/** Re-run the auto-selection for the current target. Shared by goal changes. */
export function reselectForTarget() {
  state.selected = new Set(
    autoSelectForTarget(state.footprint, state.plan.recommendations, state.targetKg),
  );
}

export function renderGauge() {
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
      el('span', {}, [
        el('b', { text: 'Now ' }),
        document.createTextNode(formatTonnes(footprint.total)),
      ]),
      el('span', { class: 'proj' }, [
        el('b', { text: 'Projected ' }),
        document.createTextNode(formatTonnes(projected)),
      ]),
      el('span', {}, [el('b', { text: 'Goal ' }), document.createTextNode(formatTonnes(targetKg))]),
    ]),
  );

  $('goal-message').textContent = goalMessage(status, projected);
}

export function renderRecommendations() {
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
              el('span', {
                class: 'tag',
                'data-effort': rec.effort,
                text: EFFORT_LABEL[rec.effort] ?? '',
              }),
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
