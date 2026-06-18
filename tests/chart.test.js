import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chartGeometry, describeSeries, lineChartSVG } from '../src/ui/chart.js';

/** Minimal stand-in for the SVG DOM so lineChartSVG can run headless in Node. */
function installFakeDom() {
  const make = (name) => ({
    name,
    attrs: {},
    children: [],
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    append(...kids) {
      this.children.push(...kids);
    },
  });
  globalThis.document = { createElementNS: (_ns, name) => make(name) };
}

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

test('describeSeries gives screen readers a meaningful summary', () => {
  assert.equal(describeSeries([]), 'No data yet');
  const text = describeSeries([3.2, 4.8, 2.1]);
  assert.match(text, /3 snapshots/);
  assert.match(text, /from 3\.2 to 2\.1/);
});

test('lineChartSVG builds an accessible <svg> with a labelled trend', () => {
  installFakeDom();
  const svg = lineChartSVG([2, 3, 1], { width: 320, height: 120 });
  assert.equal(svg.name, 'svg');
  assert.equal(svg.attrs.role, 'img');
  assert.match(svg.attrs['aria-label'], /trend/i);
  // area + line + one circle per point.
  assert.equal(svg.children.filter((c) => c.name === 'circle').length, 3);
  assert.ok(svg.children.some((c) => c.name === 'path' && c.attrs.class === 'trend-line'));
});

test('lineChartSVG renders an empty, still-labelled chart for no data', () => {
  installFakeDom();
  const svg = lineChartSVG([]);
  assert.equal(svg.children.length, 0, 'no geometry to draw');
  assert.equal(svg.attrs['aria-label'], 'No data yet');
});
