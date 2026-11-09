// Measures the circle a curve segment draws, and how far the measurement can be trusted.
import { distance, type Point } from './geometry.ts';
import type { ArcSegment, CubicSegment, CurveSegment, QuadraticSegment } from './svg-path.ts';

export type CircleFit = {
  center: Point;
  radius: number;
  // Largest gap between the curve and that circle: 0 for a true circular arc.
  deviation: number;
  // How far rounding in the file can move the measured radius.
  uncertainty: number;
};

type BezierSegment = CubicSegment | QuadraticSegment;

// The Bézier is sampled at its middle and its two quarter points.
const SAMPLE_TIMES = [0.25, 0.5, 0.75];

export function fitCircle(curve: CurveSegment, rounding: number): CircleFit | undefined {
  return curve.kind === 'arc' ? fitArc(curve) : fitBezier(curve, rounding);
}

// Endpoint-to-center conversion: https://www.w3.org/TR/SVG2/implnote.html#ArcConversionEndpointToCenter
function fitArc(arc: ArcSegment): CircleFit | undefined {
  if (isDrawnAsLine(arc)) return undefined;

  const halfChord = rotate(
    { x: (arc.from.x - arc.to.x) / 2, y: (arc.from.y - arc.to.y) / 2 },
    -toRadians(arc.rotation),
  );
  const radii = correctedRadii(arc, halfChord);
  return {
    center: arcCenter(arc, halfChord, radii),
    radius: (radii.x + radii.y) / 2,
    deviation: Math.abs(radii.x - radii.y) / 2,
    uncertainty: 0,
  };
}

// The spec draws a straight line for a zero radius and nothing for an arc that ends where it starts.
// https://www.w3.org/TR/SVG2/paths.html#ArcOutOfRangeParameters
function isDrawnAsLine(arc: ArcSegment): boolean {
  const endsWhereItStarts = arc.from.x === arc.to.x && arc.from.y === arc.to.y;
  return arc.radiusX === 0 || arc.radiusY === 0 || endsWhereItStarts;
}

// Radii too small to reach the end point grow until they do, as the browser draws them.
// https://www.w3.org/TR/SVG2/implnote.html#ArcCorrectionOutOfRangeRadii
function correctedRadii(arc: ArcSegment, halfChord: Point): Point {
  const radiusX = Math.abs(arc.radiusX);
  const radiusY = Math.abs(arc.radiusY);
  const reach = halfChord.x ** 2 / radiusX ** 2 + halfChord.y ** 2 / radiusY ** 2;
  const scale = reach > 1 ? Math.sqrt(reach) : 1;
  return { x: radiusX * scale, y: radiusY * scale };
}

function arcCenter(arc: ArcSegment, halfChord: Point, radii: Point): Point {
  const xSquared = radii.x ** 2 * halfChord.y ** 2;
  const ySquared = radii.y ** 2 * halfChord.x ** 2;
  // Rounding pushes the numerator slightly below zero when the radii were just grown to fit.
  const numerator = Math.max(0, radii.x ** 2 * radii.y ** 2 - xSquared - ySquared);
  const sign = arc.largeArc === arc.sweep ? -1 : 1;
  const factor = sign * Math.sqrt(numerator / (xSquared + ySquared));
  const centerInArcAxes = {
    x: (factor * radii.x * halfChord.y) / radii.y,
    y: (-factor * radii.y * halfChord.x) / radii.x,
  };
  const offset = rotate(centerInArcAxes, toRadians(arc.rotation));
  return { x: offset.x + (arc.from.x + arc.to.x) / 2, y: offset.y + (arc.from.y + arc.to.y) / 2 };
}

function fitBezier(curve: BezierSegment, rounding: number): CircleFit | undefined {
  // A loop that ends where it starts has no chord to measure the bow from.
  if (distance(curve.from, curve.to) === 0) return undefined;

  const polygon = controlPolygon(curve);
  const samples = SAMPLE_TIMES.map((time) => deCasteljau(polygon, time));
  const apex = farthestFromChord(samples, curve);
  const sagitta = distanceToChord(apex, curve);
  // A curve that bows less than the file's rounding is a straight line as far as the file can tell.
  if (sagitta <= rounding) return undefined;

  // Ends that leave in parallel (an S-curve) never cross; their circle only needs to show the deviation.
  const center = endNormalsCrossing(polygon) ?? circumcenter(curve.from, apex, curve.to);
  const radius = (distance(center, curve.from) + distance(center, curve.to)) / 2;
  return {
    center,
    radius,
    deviation: Math.max(...[curve.from, curve.to, ...samples].map((point) => Math.abs(distance(point, center) - radius))),
    // Rounding moves the sagitta s by up to `rounding`, and the radius of a curve that bows s moves by about r × δs / s.
    uncertainty: (radius * rounding) / sagitta,
  };
}

function controlPolygon(curve: BezierSegment): Point[] {
  return curve.kind === 'cubic'
    ? [curve.from, curve.control1, curve.control2, curve.to]
    : [curve.from, curve.control, curve.to];
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

function farthestFromChord(samples: Point[], chord: BezierSegment): Point {
  return samples.reduce((farthest, sample) =>
    distanceToChord(sample, chord) > distanceToChord(farthest, chord) ? sample : farthest,
  );
}

function distanceToChord(point: Point, { from, to }: BezierSegment): number {
  return Math.abs(cross(subtract(to, from), subtract(point, from))) / distance(from, to);
}

// An arc drawn as a Bézier leaves each end along the circle's tangent, so its center is where
// the two end normals cross. This is exact for the cubic with 4/3·tan(θ/4)·r arms and for a
// quadratic whose control point is where the end tangents meet; the circle through the middle
// point is not, because a quadratic bows slightly past its circle.
function endNormalsCrossing(polygon: Point[]): Point | undefined {
  const start = polygon[0];
  const end = polygon[polygon.length - 1];
  const startNormal = perpendicular(leavingDirection(polygon));
  const endNormal = perpendicular(leavingDirection(polygon.toReversed()));
  const denominator = cross(startNormal, endNormal);
  if (denominator === 0) return undefined;

  const along = cross(subtract(end, start), endNormal) / denominator;
  return { x: start.x + startNormal.x * along, y: start.y + startNormal.y * along };
}

// The first control point that differs from the end gives the curve's direction there.
function leavingDirection([end, ...rest]: Point[]): Point {
  const next = rest.find((point) => distance(point, end) > 0) ?? end;
  return subtract(next, end);
}

function perpendicular({ x, y }: Point): Point {
  return { x: -y, y: x };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

// Computed relative to `a` so the squared terms stay small.
function circumcenter(a: Point, b: Point, c: Point): Point {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const abSquared = ab.x ** 2 + ab.y ** 2;
  const acSquared = ac.x ** 2 + ac.y ** 2;
  const determinant = 2 * cross(ab, ac);
  return {
    x: a.x + (ac.y * abSquared - ab.y * acSquared) / determinant,
    y: a.y + (ab.x * acSquared - ac.x * abSquared) / determinant,
  };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function rotate(point: Point, angle: number): Point {
  return {
    x: Math.cos(angle) * point.x - Math.sin(angle) * point.y,
    y: Math.sin(angle) * point.x + Math.cos(angle) * point.y,
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
