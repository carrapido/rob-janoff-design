import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitCircle } from '../skills/rob-janoff-design/scripts/lib/circle-fit.ts';
import type { Point } from '../skills/rob-janoff-design/scripts/lib/geometry.ts';
import type { ArcSegment, CubicSegment } from '../skills/rob-janoff-design/scripts/lib/svg-path.ts';
import { assertClose, assertPointClose } from './helpers/assert-close.ts';

const ROUNDING = 0.005;
// Control arm of a cubic quarter circle: 4/3 · tan(θ/4) · r with θ = 90°.
const QUARTER_CIRCLE_ARM = (4 / 3) * Math.tan(Math.PI / 8);

describe('fitCircle on arcs', () => {
  it('finds the center the browser picks from the sweep flag', () => {
    const clockwise = fitCircle(arc({ from: point(0, 0), to: point(100, 0), radius: 100, sweep: true }), ROUNDING);
    const counterClockwise = fitCircle(arc({ from: point(0, 0), to: point(100, 0), radius: 100, sweep: false }), ROUNDING);

    assert.ok(clockwise && counterClockwise);
    assertPointClose(clockwise.center, point(50, 86.6), 0.01);
    assertPointClose(counterClockwise.center, point(50, -86.6), 0.01);
    assert.equal(clockwise.radius, 100);
    assert.equal(clockwise.deviation, 0);
    assert.equal(clockwise.uncertainty, 0, 'a declared radius carries no rounding');
  });

  it('grows a radius too small to reach the end point, as the browser does', () => {
    const fit = fitCircle(arc({ from: point(0, 0), to: point(100, 0), radius: 10, sweep: true }), ROUNDING);

    assert.ok(fit);
    assertClose(fit.radius, 50, 1e-9);
    assertPointClose(fit.center, point(50, 0), 1e-9);
  });

  it('measures how far an elliptical arc strays from a circle', () => {
    const fit = fitCircle({ ...arc({ from: point(0, 0), to: point(200, 0), radius: 100, sweep: true }), radiusY: 50 }, ROUNDING);

    assert.ok(fit);
    assert.equal(fit.radius, 75);
    assert.equal(fit.deviation, 25);
  });

  it('treats an arc with a zero radius as a straight line', () => {
    assert.equal(fitCircle(arc({ from: point(0, 0), to: point(100, 0), radius: 0, sweep: true }), ROUNDING), undefined);
  });
});

describe('fitCircle on Béziers', () => {
  it('recovers the circle of a cubic quarter circle', () => {
    const fit = fitCircle(quarterCircle(100), ROUNDING);

    assert.ok(fit);
    assertPointClose(fit.center, point(0, 0), 0.01);
    assertClose(fit.radius, 100, 0.01);
    assert.ok(fit.deviation < 0.05, `deviation ${fit.deviation}`);
  });

  it('recovers the circle of a quadratic whose control point is where the end tangents meet', () => {
    const halfAngle = Math.PI / 6;
    const fromArc = {
      kind: 'quadratic' as const,
      from: point(100 * Math.cos(halfAngle), -100 * Math.sin(halfAngle)),
      control: point(100 / Math.cos(halfAngle), 0),
      to: point(100 * Math.cos(halfAngle), 100 * Math.sin(halfAngle)),
    };
    const fit = fitCircle(fromArc, ROUNDING);

    assert.ok(fit);
    assertPointClose(fit.center, point(0, 0), 1e-9);
    assertClose(fit.radius, 100, 1e-9);
  });

  it('reports a wide deviation for an S-shaped cubic', () => {
    const fit = fitCircle(
      { kind: 'cubic', from: point(0, 0), control1: point(10, 10), control2: point(20, -10), to: point(30, 0) },
      ROUNDING,
    );

    assert.ok(fit);
    assert.ok(fit.deviation > 1, `deviation ${fit.deviation}`);
  });

  it('treats a cubic that bows less than the rounding as a straight line', () => {
    const almostStraight: CubicSegment = {
      kind: 'cubic',
      from: point(0, 0),
      control1: point(10, 0.001),
      control2: point(20, 0.001),
      to: point(30, 0),
    };

    assert.equal(fitCircle(almostStraight, ROUNDING), undefined);
  });

  it('estimates how far rounding can move the radius: r × rounding / sagitta', () => {
    const fit = fitCircle(quarterCircle(100), ROUNDING);
    const sagitta = 100 * (1 - Math.SQRT1_2);

    assert.ok(fit);
    assertClose(fit.uncertainty, (100 * ROUNDING) / sagitta, 1e-4);
  });
});

function point(x: number, y: number): Point {
  return { x, y };
}

function arc(shape: { from: Point; to: Point; radius: number; sweep: boolean }): ArcSegment {
  return {
    kind: 'arc',
    from: shape.from,
    to: shape.to,
    radiusX: shape.radius,
    radiusY: shape.radius,
    rotation: 0,
    largeArc: false,
    sweep: shape.sweep,
  };
}

function quarterCircle(radius: number): CubicSegment {
  const arm = QUARTER_CIRCLE_ARM * radius;
  return {
    kind: 'cubic',
    from: point(radius, 0),
    control1: point(radius, arm),
    control2: point(arm, radius),
    to: point(0, radius),
  };
}
