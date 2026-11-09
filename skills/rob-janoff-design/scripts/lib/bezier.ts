import type { Point } from './geometry.ts';
import type { CubicSegment, QuadraticSegment } from './svg-path.ts';

export type BezierSegment = CubicSegment | QuadraticSegment;

export function controlPolygon(curve: BezierSegment): Point[] {
  return curve.kind === 'cubic'
    ? [curve.from, curve.control1, curve.control2, curve.to]
    : [curve.from, curve.control, curve.to];
}

export function pointOnBezier(curve: BezierSegment, time: number): Point {
  return deCasteljau(controlPolygon(curve), time);
}

// Interpolates between neighbouring control points until one point is left.
function deCasteljau(points: Point[], time: number): Point {
  if (points.length === 1) return points[0];
  const nextLevel = points.slice(1).map((next, index) => interpolate(points[index], next, time));
  return deCasteljau(nextLevel, time);
}

function interpolate(a: Point, b: Point, time: number): Point {
  return { x: a.x + (b.x - a.x) * time, y: a.y + (b.y - a.y) * time };
}
