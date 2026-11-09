// Turns "the on-screen size of a detail is measurement × px ÷ frame width" into numbers.
// The rule: references/04-ruler-and-compass.md, section 4.
import { flattenContour } from './contours.ts';
import { closestPointOnSegment, cross, distance, midpoint, subtract, type Point } from './geometry.ts';
import { extractPathData, parseContours } from './svg-path.ts';

export type Detail =
  | { kind: 'gap'; contours: [number, number]; units: number; at: Point }
  | { kind: 'size'; contour: number; units: number; at: Point }
  | { kind: 'stroke-width'; units: number };

export type ScaleReport = { frame: number; details: Detail[]; overlaps: number };

type Gap = { distance: number; at: Point };
type ContourPair = Gap & { first: number; second: number };

// One step per pixel at 256 px keeps the flattened curves within a hundredth of a pixel of the real ones.
const STEPS_PER_FRAME = 256;
const VIEW_BOX = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/;
const STROKE_WIDTH = /stroke-width\s*[:=]\s*["']?\s*([\d.]+)/g;

export function measureScale(svg: string): ScaleReport {
  const frame = frameSize(svg);
  const contours = extractPathData(svg)
    .flatMap((pathData) => parseContours(pathData))
    .map((segments) => flattenContour(segments, frame / STEPS_PER_FRAME));
  const pairs = contourPairs(contours);
  const separate = pairs.filter((pair) => pair.distance > 0);
  const details = [...narrowestGaps(contours.length, separate), ...contours.map(contourSize), ...strokeWidths(svg)];
  return { frame, details: details.sort(bySize), overlaps: pairs.length - separate.length };
}

export function toPixels(units: number, sizeInPixels: number, frame: number): number {
  return (units * sizeInPixels) / frame;
}

export function hiddenAt(report: ScaleReport, sizeInPixels: number): Detail[] {
  return report.details.filter((detail) => toPixels(detail.units, sizeInPixels, report.frame) < 1);
}

function frameSize(svg: string): number {
  const viewBox = VIEW_BOX.exec(svg)?.[1];
  const [width, height] = viewBox
    ? viewBox.trim().split(/[\s,]+/).slice(2).map(Number)
    : [svgSizeAttribute(svg, 'width'), svgSizeAttribute(svg, 'height')];
  const frame = Math.max(width, height);
  if (Number.isNaN(frame) || frame <= 0) {
    throw new Error('The SVG needs a viewBox (or a width and height) to know its frame.');
  }
  return frame;
}

// A plain number or a px length; a percentage says nothing about the frame.
function svgSizeAttribute(svg: string, name: string): number {
  const match = new RegExp(String.raw`<svg\b[^>]*?\s${name}\s*=\s*["']([\d.]+)(?:px)?["']`).exec(svg);
  return Number(match?.[1]);
}

function contourPairs(contours: Point[][]): ContourPair[] {
  return contours.flatMap((first, firstIndex) =>
    contours
      .slice(firstIndex + 1)
      .map((second, offset) => ({ first: firstIndex, second: firstIndex + 1 + offset, ...polylineGap(first, second) })),
  );
}

// Each contour's narrowest gap to another contour, each pair listed once.
function narrowestGaps(contourCount: number, separate: ContourPair[]): Detail[] {
  const narrowest = Array.from({ length: contourCount }, (_, index) => narrowestPairOf(index, separate));
  const unique = new Set(narrowest.filter((pair) => pair !== undefined));
  return [...unique].map((pair) => ({
    kind: 'gap',
    contours: [pair.first + 1, pair.second + 1],
    units: pair.distance,
    at: pair.at,
  }));
}

function narrowestPairOf(contour: number, pairs: ContourPair[]): ContourPair | undefined {
  const own = pairs.filter((pair) => pair.first === contour || pair.second === contour);
  if (own.length === 0) return undefined;
  return own.reduce((narrowest, pair) => (pair.distance < narrowest.distance ? pair : narrowest));
}

function contourSize(points: Point[], index: number): Detail {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const low = { x: Math.min(...xs), y: Math.min(...ys) };
  const high = { x: Math.max(...xs), y: Math.max(...ys) };
  return { kind: 'size', contour: index + 1, units: Math.min(high.x - low.x, high.y - low.y), at: midpoint(low, high) };
}

function bySize(a: Detail, b: Detail): number {
  return a.units - b.units;
}

function strokeWidths(svg: string): Detail[] {
  const widths = new Set([...svg.matchAll(STROKE_WIDTH)].map((match) => Number(match[1])));
  return [...widths].map((units) => ({ kind: 'stroke-width', units }));
}

// Closest approach between two polylines; 0 when they cross or touch.
function polylineGap(first: Point[], second: Point[]): Gap {
  let narrowest: Gap = { distance: Infinity, at: first[0] };
  for (let i = 1; i < first.length; i += 1) {
    for (let j = 1; j < second.length; j += 1) {
      const gap = segmentGap(first[i - 1], first[i], second[j - 1], second[j]);
      if (gap.distance < narrowest.distance) narrowest = gap;
    }
  }
  return narrowest;
}

function segmentGap(a1: Point, a2: Point, b1: Point, b2: Point): Gap {
  if (segmentsCross(a1, a2, b1, b2)) return { distance: 0, at: a1 };
  return [gapToSegment(a1, b1, b2), gapToSegment(a2, b1, b2), gapToSegment(b1, a1, a2), gapToSegment(b2, a1, a2)].reduce(
    (narrowest, gap) => (gap.distance < narrowest.distance ? gap : narrowest),
  );
}

// Each segment's ends lie on opposite sides of the other segment.
function segmentsCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  return sideOf(a1, b1, b2) * sideOf(a2, b1, b2) < 0 && sideOf(b1, a1, a2) * sideOf(b2, a1, a2) < 0;
}

// 1 or -1 for the two sides of the line from `from` to `to`, 0 on it.
function sideOf(point: Point, from: Point, to: Point): number {
  return Math.sign(cross(subtract(to, from), subtract(point, from)));
}

function gapToSegment(point: Point, from: Point, to: Point): Gap {
  const closest = closestPointOnSegment(point, from, to);
  return { distance: distance(point, closest), at: midpoint(point, closest) };
}
