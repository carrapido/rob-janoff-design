// Turns a contour into a closed polyline that stays on its curves, for measuring distances.
import { controlPolygon, pointOnBezier, type BezierSegment } from './bezier.ts';
import { arcParameters, pointOnArc } from './elliptical-arc.ts';
import { distance, type Point } from './geometry.ts';
import type { ArcSegment, Segment } from './svg-path.ts';

export function flattenContour(segments: Segment[], spacing: number): Point[] {
  const points = [segments[0].from, ...segments.flatMap((segment) => pointsAfterStart(segment, spacing))];
  return isClosed(points) ? points : [...points, points[0]];
}

// Lines are exact; curves are sampled. Each list ends exactly at the segment's end point.
function pointsAfterStart(segment: Segment, spacing: number): Point[] {
  if (segment.kind === 'line') return [segment.to];
  if (segment.kind === 'arc') return sampleArc(segment, spacing);
  return sampleBezier(segment, spacing);
}

// A Bézier never moves faster than its degree times its longest control leg,
// so this many steps keeps every step within the spacing.
function sampleBezier(curve: BezierSegment, spacing: number): Point[] {
  const polygon = controlPolygon(curve);
  const degree = polygon.length - 1;
  const steps = stepCount(degree * longestLeg(polygon), spacing);
  return [...innerTimes(steps).map((time) => pointOnBezier(curve, time)), curve.to];
}

function sampleArc(arc: ArcSegment, spacing: number): Point[] {
  const parameters = arcParameters(arc);
  if (!parameters) return [arc.to];

  const { radii, startAngle, sweepAngle } = parameters;
  const steps = stepCount(Math.max(radii.x, radii.y) * Math.abs(sweepAngle), spacing);
  return [...innerTimes(steps).map((time) => pointOnArc(parameters, startAngle + sweepAngle * time)), arc.to];
}

function stepCount(length: number, spacing: number): number {
  return Math.max(1, Math.ceil(length / spacing));
}

// The times strictly between 0 and 1 that split a curve into `steps` equal steps.
function innerTimes(steps: number): number[] {
  return Array.from({ length: steps - 1 }, (_, index) => (index + 1) / steps);
}

function longestLeg(polygon: Point[]): number {
  return Math.max(...polygon.slice(1).map((next, index) => distance(polygon[index], next)));
}

function isClosed(points: Point[]): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  return first.x === last.x && first.y === last.y;
}
