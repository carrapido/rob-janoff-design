// Endpoint-to-center conversion of an SVG arc, so it can be measured and sampled.
// https://www.w3.org/TR/SVG2/implnote.html#ArcConversionEndpointToCenter
import { add, cross, dot, midpoint, type Point } from './geometry.ts';
import type { ArcSegment } from './svg-path.ts';

export type ArcParameters = {
  center: Point;
  // After growing radii too small to reach the end point.
  radii: Point;
  // In radians; sweepAngle is negative when the sweep flag is 0.
  rotation: number;
  startAngle: number;
  sweepAngle: number;
};

export function arcParameters(arc: ArcSegment): ArcParameters | undefined {
  if (isDrawnAsLine(arc)) return undefined;

  const rotation = toRadians(arc.rotation);
  const halfChord = rotate({ x: (arc.from.x - arc.to.x) / 2, y: (arc.from.y - arc.to.y) / 2 }, -rotation);
  const radii = correctedRadii(arc, halfChord);
  const centerOnAxes = centerOnArcAxes(arc, halfChord, radii);
  const startVector = { x: (halfChord.x - centerOnAxes.x) / radii.x, y: (halfChord.y - centerOnAxes.y) / radii.y };
  const endVector = { x: (-halfChord.x - centerOnAxes.x) / radii.x, y: (-halfChord.y - centerOnAxes.y) / radii.y };
  return {
    center: add(rotate(centerOnAxes, rotation), midpoint(arc.from, arc.to)),
    radii,
    rotation,
    startAngle: Math.atan2(startVector.y, startVector.x),
    sweepAngle: sweepBetween(startVector, endVector, arc.sweep),
  };
}

export function pointOnArc(arc: ArcParameters, angle: number): Point {
  const onAxes = { x: arc.radii.x * Math.cos(angle), y: arc.radii.y * Math.sin(angle) };
  return add(rotate(onAxes, arc.rotation), arc.center);
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

function centerOnArcAxes(arc: ArcSegment, halfChord: Point, radii: Point): Point {
  const xSquared = radii.x ** 2 * halfChord.y ** 2;
  const ySquared = radii.y ** 2 * halfChord.x ** 2;
  // Rounding pushes the numerator slightly below zero when the radii were just grown to fit.
  const numerator = Math.max(0, radii.x ** 2 * radii.y ** 2 - xSquared - ySquared);
  const sign = arc.largeArc === arc.sweep ? -1 : 1;
  const factor = sign * Math.sqrt(numerator / (xSquared + ySquared));
  return {
    x: (factor * radii.x * halfChord.y) / radii.y,
    y: (-factor * radii.y * halfChord.x) / radii.x,
  };
}

// The signed angle from start to end, turned the way the sweep flag says.
function sweepBetween(start: Point, end: Point, sweep: boolean): number {
  const angle = Math.atan2(cross(start, end), dot(start, end));
  if (!sweep && angle > 0) return angle - 2 * Math.PI;
  if (sweep && angle < 0) return angle + 2 * Math.PI;
  return angle;
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
