// Measures the circle a curve segment draws, and how far the measurement can be trusted.
import { controlPolygon, leavingDirection, pointOnBezier, type BezierSegment } from './bezier.ts';
import { arcParameters } from './elliptical-arc.ts';
import { cross, distance, subtract, type Point } from './geometry.ts';
import type { ArcSegment, CurveSegment } from './svg-path.ts';

export type CircleFit = {
  center: Point;
  radius: number;
  // Largest gap between the curve and that circle: 0 for a true circular arc.
  deviation: number;
  // How far rounding in the file can move the measured radius.
  uncertainty: number;
};

// The Bézier is sampled at its middle and its two quarter points.
const SAMPLE_TIMES = [0.25, 0.5, 0.75];

export function fitCircle(curve: CurveSegment, rounding: number): CircleFit | undefined {
  return curve.kind === 'arc' ? fitArc(curve) : fitBezier(curve, rounding);
}

function fitArc(arc: ArcSegment): CircleFit | undefined {
  const parameters = arcParameters(arc);
  if (!parameters) return undefined;

  const { center, radii } = parameters;
  return {
    center,
    radius: (radii.x + radii.y) / 2,
    deviation: Math.abs(radii.x - radii.y) / 2,
    uncertainty: 0,
  };
}

function fitBezier(curve: BezierSegment, rounding: number): CircleFit | undefined {
  // A loop that ends where it starts has no chord to measure the bow from.
  if (distance(curve.from, curve.to) === 0) return undefined;

  const samples = SAMPLE_TIMES.map((time) => pointOnBezier(curve, time));
  const apex = farthestFromChord(samples, curve);
  const sagitta = distanceToChord(apex, curve);
  // A curve that bows less than the file's rounding is a straight line as far as the file can tell.
  if (sagitta <= rounding) return undefined;

  // Ends that leave in parallel (an S-curve) never cross; their circle only needs to show the deviation.
  const center = endNormalsCrossing(controlPolygon(curve)) ?? circumcenter(curve.from, apex, curve.to);
  const radius = (distance(center, curve.from) + distance(center, curve.to)) / 2;
  return {
    center,
    radius,
    deviation: Math.max(...[curve.from, curve.to, ...samples].map((point) => Math.abs(distance(point, center) - radius))),
    // Rounding moves the sagitta s by up to `rounding`, and the radius of a curve that bows s moves by about r × δs / s.
    uncertainty: (radius * rounding) / sagitta,
  };
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

function perpendicular({ x, y }: Point): Point {
  return { x: -y, y: x };
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
