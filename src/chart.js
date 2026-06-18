/**
 * Tiny dependency-free SVG line chart for the progress tracker.
 *
 * The geometry math is split out as a pure function so it can be unit-tested
 * without a DOM. The rendering function builds an accessible <svg> (role="img"
 * plus a descriptive label) and is only called in the browser.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Map a series of values into pixel coordinates inside a padded box.
 *
 * @returns {{ points: Array<{x:number,y:number,v:number}>, min:number, max:number }}
 */
export function chartGeometry(values, { width = 320, height = 120, pad = 10 } = {}) {
  const nums = (values ?? []).map((v) => Number(v) || 0);
  if (nums.length === 0) return { points: [], min: 0, max: 0 };

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = nums.map((v, i) => {
    const x = nums.length === 1 ? width / 2 : pad + (i / (nums.length - 1)) * innerW;
    const y = pad + (1 - (v - min) / span) * innerH;
    return { x: round(x), y: round(y), v };
  });

  return { points, min, max };
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Build an accessible SVG line chart element for a list of tonne values.
 *
 * @param {number[]} values   series in tonnes CO2e
 * @param {object}   [opts]
 * @returns {SVGSVGElement}
 */
export function lineChartSVG(values, opts = {}) {
  const width = opts.width ?? 320;
  const height = opts.height ?? 120;
  const { points } = chartGeometry(values, { width, height, pad: 12 });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height,
    role: 'img',
    'aria-label': describeSeries(values),
    class: 'trend-svg',
    preserveAspectRatio: 'none',
  });

  if (points.length === 0) return svg;

  // Soft area under the line.
  if (points.length > 1) {
    const areaD =
      `M ${points[0].x} ${height - 12} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points.at(-1).x} ${height - 12} Z`;
    svg.append(svgEl('path', { d: areaD, class: 'trend-area' }));
  }

  // The line itself.
  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  svg.append(svgEl('path', { d: lineD, class: 'trend-line', fill: 'none' }));

  // Data points (last one emphasised).
  points.forEach((p, i) => {
    svg.append(
      svgEl('circle', {
        cx: p.x,
        cy: p.y,
        r: i === points.length - 1 ? 4 : 2.5,
        class: i === points.length - 1 ? 'trend-dot trend-dot--last' : 'trend-dot',
      }),
    );
  });

  return svg;
}

function describeSeries(values) {
  const nums = (values ?? []).map((v) => Number(v) || 0);
  if (!nums.length) return 'No data yet';
  const latest = nums.at(-1).toFixed(1);
  const first = nums[0].toFixed(1);
  return `Footprint trend over ${nums.length} snapshots, from ${first} to ${latest} tonnes CO2e per year.`;
}

function round(n) {
  return Math.round(n * 100) / 100;
}
