// Fits the curves a client changed by hand, or that the audit lists off the series, back onto
// the golden series, keeping each curve's end points so it stays joined to its neighbours.
// The method: references/04-ruler-and-compass.md, section 3.
import { isProblem, judgeCurves, measureCurves, seriesCandidates, type AuditOptions, type Candidate, type MeasuredCurve } from './audit.ts';
import { controlPolygon, leavingDirection } from './bezier.ts';
import { flattenSegment } from './contours.ts';
import { arcParameters, directionOnArc } from './elliptical-arc.ts';
import { closestPointOnSegment, cross, distance, dot, subtract, type Point } from './geometry.ts';
import { extractPathData, hasTransforms, parsePathData, type ArcSegment, type CurveSegment } from './svg-path.ts';

export type FitOptions = AuditOptions & { lastCopy?: string };

export type ArcFit = {
  label: string;
  radius: number;
  center: Point;
  rms: number;
  largestError: number;
  largestErrorAt: Point;
};

export type CurveFit = {
  from: Point;
  to: Point;
  clientRadius: number;
  best: ArcFit;
  runnerUp: ArcFit | undefined;
  // Degrees between the client's curve and the winning arc where they leave and reach the end points.
  tangentTurn: { start: number; end: number };
  command: string;
  fits: boolean;
};

export type FitReport = { curves: CurveFit[]; transformsIgnored: boolean };

type ArcCandidate = ArcFit & { arc: ArcSegment };
type Bow = { sagitta: number; sweep: boolean };

export function fitSvg(svg: string, options: FitOptions): FitReport {
  const { lastCopy } = options;
  return {
    curves: curvesToFit(svg, options).map((curve) => fitCurve(curve, options)),
    transformsIgnored: hasTransforms(svg) || (lastCopy !== undefined && hasTransforms(lastCopy)),
  };
}

function curvesToFit(svg: string, options: FitOptions): MeasuredCurve[] {
  if (options.lastCopy === undefined) return judgeCurves(svg, options).filter((curve) => isProblem(curve.verdict));
  return changedSince(measureCurves(svg), options.lastCopy, options.tolerance);
}

// An editor may rewrite a curve without changing it: reversed, relative, as a cubic or rounded.
function changedSince(curves: MeasuredCurve[], lastCopy: string, tolerance: number): MeasuredCurve[] {
  const previous = extractPathData(lastCopy)
    .flatMap((pathData) => parsePathData(pathData))
    .map((segment) => flattenSegment(segment, tolerance));
  return curves.filter((curve) => !previous.some((polyline) => isSameShape(curve.segment, polyline, tolerance)));
}

function isSameShape(curve: CurveSegment, polyline: Point[], tolerance: number): boolean {
  return (
    sharesEndPoints(curve, polyline, tolerance) &&
    flattenSegment(curve, tolerance).every((sample) => distanceToPolyline(sample, polyline) <= tolerance)
  );
}

function sharesEndPoints({ from, to }: CurveSegment, polyline: Point[], tolerance: number): boolean {
  const first = polyline[0];
  const last = polyline[polyline.length - 1];
  const isNear = (a: Point, b: Point) => distance(a, b) <= tolerance;
  return (isNear(from, first) && isNear(to, last)) || (isNear(from, last) && isNear(to, first));
}

function distanceToPolyline(point: Point, polyline: Point[]): number {
  return Math.min(
    ...polyline.slice(1).map((next, index) => distance(point, closestPointOnSegment(point, polyline[index], next))),
  );
}

function fitCurve({ segment, radius }: MeasuredCurve, options: AuditOptions): CurveFit {
  const samples = flattenSegment(segment, options.tolerance);
  const [best, runnerUp] = candidateArcs(segment, samples, options).toSorted((a, b) => a.rms - b.rms);
  if (best === undefined) {
    throw new Error('A curve is longer than the diameter of the largest series step, so no series arc reaches both ends.');
  }

  return {
    from: segment.from,
    to: segment.to,
    clientRadius: radius,
    best,
    runnerUp,
    tangentTurn: tangentTurn(segment, best.arc),
    command: arcCommand(best.arc),
    fits: best.largestError <= options.tolerance,
  };
}

// Every step that can reach both end points, drawn through them and bowing like the client's curve.
function candidateArcs(curve: CurveSegment, samples: Point[], options: AuditOptions): ArcCandidate[] {
  const halfChord = distance(curve.from, curve.to) / 2;
  const bow = bowOf(curve, samples);
  return seriesCandidates(options)
    .radii.filter((step) => step.radius >= halfChord)
    .flatMap((step) => measureCandidate(arcThrough(curve, step.radius, bow), step, samples));
}

// How far, and to which side, the client's curve bows from its chord.
function bowOf({ from, to }: CurveSegment, samples: Point[]): Bow {
  const chord = subtract(to, from);
  const offsets = samples.map((sample) => cross(chord, subtract(sample, from)) / distance(from, to));
  const apex = offsets.reduce((farthest, offset) => (Math.abs(offset) > Math.abs(farthest) ? offset : farthest));
  // In SVG's y-down frame, a curve that bows to the left of its travel turns clockwise: sweep flag 1.
  return { sagitta: Math.abs(apex), sweep: apex < 0 };
}

// The large arc when the client's curve bows farther from its chord than the radius, so both bow about as far.
function arcThrough({ from, to }: CurveSegment, radius: number, bow: Bow): ArcSegment {
  return { kind: 'arc', from, to, radiusX: radius, radiusY: radius, rotation: 0, largeArc: bow.sagitta > radius, sweep: bow.sweep };
}

function measureCandidate(arc: ArcSegment, step: Candidate, samples: Point[]): ArcCandidate[] {
  const parameters = arcParameters(arc);
  if (!parameters) return [];

  const { center } = parameters;
  const errors = samples.map((sample) => Math.abs(distance(sample, center) - step.radius));
  const largest = errors.indexOf(Math.max(...errors));
  return [
    {
      label: step.label,
      radius: step.radius,
      center,
      rms: Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length),
      largestError: errors[largest],
      largestErrorAt: samples[largest],
      arc,
    },
  ];
}

function tangentTurn(curve: CurveSegment, arc: ArcSegment): CurveFit['tangentTurn'] {
  const [curveStart, curveEnd] = endDirections(curve);
  const [arcStart, arcEnd] = endDirections(arc);
  return { start: degreesBetween(curveStart, arcStart), end: degreesBetween(curveEnd, arcEnd) };
}

// The direction of travel where a curve leaves its start point and where it reaches its end point.
function endDirections(curve: CurveSegment): [Point, Point] {
  if (curve.kind !== 'arc') {
    const polygon = controlPolygon(curve);
    const backFromEnd = leavingDirection(polygon.toReversed());
    return [leavingDirection(polygon), { x: -backFromEnd.x, y: -backFromEnd.y }];
  }

  const parameters = arcParameters(curve);
  // An arc with no parameters is drawn as a straight line.
  if (!parameters) return [subtract(curve.to, curve.from), subtract(curve.to, curve.from)];
  const { startAngle, sweepAngle } = parameters;
  return [directionOnArc(parameters, startAngle), directionOnArc(parameters, startAngle + sweepAngle)];
}

function degreesBetween(a: Point, b: Point): number {
  return (Math.atan2(Math.abs(cross(a, b)), dot(a, b)) * 180) / Math.PI;
}

// Pasted after the curve's start point. Two decimals keep the radius within 0.005 of its step;
// the end point keeps the client's digits, so the neighbour still joins it exactly.
function arcCommand({ radiusX, largeArc, sweep, to }: ArcSegment): string {
  const radius = Number(radiusX.toFixed(2));
  return `A${radius} ${radius} 0 ${Number(largeArc)} ${Number(sweep)} ${to.x} ${to.y}`;
}
