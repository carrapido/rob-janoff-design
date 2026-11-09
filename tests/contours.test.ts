import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flattenContour } from '../skills/rob-janoff-design/scripts/lib/contours.ts';
import { distance, type Point } from '../skills/rob-janoff-design/scripts/lib/geometry.ts';
import { parsePathData } from '../skills/rob-janoff-design/scripts/lib/svg-path.ts';
import { assertClose } from './helpers/assert-close.ts';

const ORIGIN = point(0, 0);

describe('flattenContour', () => {
  it('keeps the vertices of a polygon exactly, however long its sides', () => {
    const points = flattenContour(parsePathData('M0 0 L10 0 L10 10 L0 10 Z'), 1);

    assert.deepEqual(points, [point(0, 0), point(10, 0), point(10, 10), point(0, 10), point(0, 0)]);
  });

  it('closes an open subpath back to its start, as a fill does', () => {
    const points = flattenContour(parsePathData('M0 0 L10 0 L10 10'), 1);

    assert.deepEqual(points, [point(0, 0), point(10, 0), point(10, 10), point(0, 0)]);
  });

  it('samples an arc on its circle, with no step longer than the spacing', () => {
    const circle = parsePathData('M-100 0 A100 100 0 0 1 100 0 A100 100 0 0 1 -100 0 Z');
    const points = flattenContour(circle, 5);

    for (const sample of points) assertClose(distance(sample, ORIGIN), 100, 1e-9);
    assertLongestStepAtMost(points, 5);
  });

  it('samples an elliptical arc on its ellipse', () => {
    const points = flattenContour(parsePathData('M0 0 A100 50 0 0 1 200 0'), 5);

    for (const { x, y } of points) assertClose(((x - 100) / 100) ** 2 + (y / 50) ** 2, 1, 1e-9);
  });

  it('samples a Bézier on the curve, with no step longer than the spacing', () => {
    const arm = (4 / 3) * Math.tan(Math.PI / 8) * 100;
    const points = flattenContour(parsePathData(`M100 0 C100 ${arm} ${arm} 100 0 100`), 1);

    for (const sample of points.slice(0, -1)) assertClose(distance(sample, ORIGIN), 100, 0.03);
    assertLongestStepAtMost(points.slice(0, -1), 1);
  });
});

function assertLongestStepAtMost(points: Point[], spacing: number): void {
  const longest = Math.max(...points.slice(1).map((next, index) => distance(points[index], next)));
  assert.ok(longest <= spacing + 1e-9, `longest step ${longest}`);
}

function point(x: number, y: number): Point {
  return { x, y };
}
