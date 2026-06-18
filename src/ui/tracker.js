/**
 * Progress tracker view — renders the saved-history list and its SVG trend
 * chart. It is a self-contained feature (its own section, its own data source)
 * kept separate from the results view so each stays small and focused.
 */

import { el, $ } from './dom.js';
import { formatKg, formatTonnes } from '../core/format.js';
import { progressMessage } from '../core/insights.js';
import { lineChartSVG } from './chart.js';

/**
 * Render the tracker section from a list of saved snapshots. Hides the whole
 * section when there is nothing to show.
 *
 * @param {Array<{ date: string, total: number }>} history newest-last snapshots
 */
export function renderHistory(history) {
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
