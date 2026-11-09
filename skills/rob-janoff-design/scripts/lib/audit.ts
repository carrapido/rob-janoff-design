// Judges every curve of an SVG against the golden series.
// The method: references/04-ruler-and-compass.md
import { fitCircle, type CircleFit } from './circle-fit.ts';
import { distance, type Point } from './geometry.ts';
import { seriesSteps } from './golden-series.ts';
import { coordinateRounding, extractPathData, hasTransforms, parsePathData, type CurveSegment, type Segment } from './svg-path.ts';

export type AuditOptions = { r0: number; tolerance: number };

export type Verdict =
  | { kind: 'on-series'; label: string }
  | { kind: 'off-series'; nearest: string; difference: number }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'not-circular' };

export type CircleRow = {
  verdict: Verdict;
  radius: number;
  center: Point;
  from: Point;
  segments: number;
};

export type AuditReport = {
  rows: CircleRow[];
  coordinateRounding: number;
  transformsIgnored: boolean;
};

export type MeasuredCurve = CircleFit & { segment: CurveSegment };
export type JudgedCurve = MeasuredCurve & { verdict: Verdict };
export type Candidate = { label: string; radius: number };
type Series = { radii: Candidate[]; offsets: Candidate[] };
type SeriesCircle = Candidate & { center: Point };

export function auditSvg(svg: string, options: AuditOptions): AuditReport {
  return {
    rows: groupIntoCircles(judgeCurves(svg, options), options.tolerance),
    coordinateRounding: svgRounding(svg),
    transformsIgnored: hasTransforms(svg),
  };
}

export function isProblem(verdict: Verdict): boolean {
  return verdict.kind === 'off-series' || verdict.kind === 'not-circular';
}

export function judgeCurves(svg: string, options: AuditOptions): JudgedCurve[] {
  const curves = measureCurves(svg);
  const series = seriesCandidates(options);
  const seriesCircles = curves.flatMap((curve) => asSeriesCircle(curve, series, options.tolerance));
  return curves.map((curve) => ({ ...curve, verdict: judgeArc(curve, series, seriesCircles, options.tolerance) }));
}

// Lines are ruler work: only curves are measured.
export function measureCurves(svg: string): MeasuredCurve[] {
  const rounding = svgRounding(svg);
  return extractPathData(svg)
    .flatMap((pathData) => parsePathData(pathData))
    .flatMap((segment) => measureCurve(segment, rounding));
}

function svgRounding(svg: string): number {
  return coordinateRounding(extractPathData(svg).join(' '));
}

function measureCurve(segment: Segment, rounding: number): MeasuredCurve[] {
  if (segment.kind === 'line') return [];
  const fit = fitCircle(segment, rounding);
  return fit ? [{ ...fit, segment }] : [];
}

// Radii are steps R(n); an even outline offsets a radius by a step R(n) or a diameter D(n) = 2·R(n).
export function seriesCandidates({ r0, tolerance }: AuditOptions): Series {
  const steps = seriesSteps(r0, tolerance);
  const radii = steps.map(({ step, radius }) => ({ label: `R${step}`, radius }));
  const diameters = steps.map(({ step, radius }) => ({ label: `D${step}`, radius: 2 * radius }));
  return { radii, offsets: [...radii, ...diameters] };
}

// A circle that lands on exactly one step can anchor the offsets drawn around its center.
function asSeriesCircle(arc: MeasuredCurve, series: Series, tolerance: number): SeriesCircle[] {
  if (!isCircular(arc, tolerance)) return [];
  const steps = within(series.radii, arc.radius, matchWindow(arc, tolerance));
  return steps.length === 1 ? [{ ...steps[0], center: arc.center }] : [];
}

function judgeArc(arc: MeasuredCurve, series: Series, seriesCircles: SeriesCircle[], tolerance: number): Verdict {
  if (!isCircular(arc, tolerance)) return { kind: 'not-circular' };

  const steps = within(series.radii, arc.radius, matchWindow(arc, tolerance)).map(({ label }) => label);
  const labels = steps.length > 0 ? steps : concentricOffsets(arc, series, seriesCircles, tolerance);
  return verdictFor(labels, arc.radius, series);
}

function verdictFor(labels: string[], radius: number, series: Series): Verdict {
  if (labels.length === 1) return { kind: 'on-series', label: labels[0] };
  if (labels.length > 1) return { kind: 'ambiguous', candidates: labels };

  const nearest = nearestCandidate(series.radii, radius);
  return { kind: 'off-series', nearest: nearest.label, difference: radius - nearest.radius };
}

// The face R0-R4 shares its center with the head R0; a radius off the series with no such
// partner was set by eye.
function concentricOffsets(arc: MeasuredCurve, series: Series, seriesCircles: SeriesCircle[], tolerance: number): string[] {
  const window = matchWindow(arc, tolerance);
  const labels = seriesCircles
    .filter((circle) => distance(circle.center, arc.center) <= window)
    .flatMap((circle) => offsetLabels(circle, arc.radius, series.offsets, window));
  return [...new Set(labels)];
}

function offsetLabels(circle: SeriesCircle, radius: number, offsets: Candidate[], window: number): string[] {
  const offset = radius - circle.radius;
  const sign = offset < 0 ? '-' : '+';
  return within(offsets, Math.abs(offset), window).map(({ label }) => `${circle.label}${sign}${label}`);
}

function isCircular(arc: MeasuredCurve, tolerance: number): boolean {
  return arc.deviation <= matchWindow(arc, tolerance);
}

// How far a measured value may sit from a candidate and still match it.
function matchWindow(arc: CircleFit, tolerance: number): number {
  return tolerance + arc.uncertainty;
}

function within(candidates: Candidate[], radius: number, window: number): Candidate[] {
  return candidates.filter((candidate) => Math.abs(candidate.radius - radius) <= window);
}

function nearestCandidate(candidates: Candidate[], radius: number): Candidate {
  return candidates.reduce((nearest, candidate) =>
    Math.abs(candidate.radius - radius) < Math.abs(nearest.radius - radius) ? candidate : nearest,
  );
}

function groupIntoCircles(arcs: JudgedCurve[], tolerance: number): CircleRow[] {
  const rows: CircleRow[] = [];
  for (const arc of arcs) {
    const row = rows.find((candidate) => isSameCircle(candidate, arc, tolerance));
    if (row) {
      row.segments += 1;
    } else {
      rows.push({ verdict: arc.verdict, radius: arc.radius, center: arc.center, from: arc.segment.from, segments: 1 });
    }
  }
  return rows;
}

function isSameCircle(row: CircleRow, arc: JudgedCurve, tolerance: number): boolean {
  const window = matchWindow(arc, tolerance);
  return (
    verdictName(row.verdict) === verdictName(arc.verdict) &&
    distance(row.center, arc.center) <= window &&
    Math.abs(row.radius - arc.radius) <= window
  );
}

function verdictName(verdict: Verdict): string {
  return verdict.kind === 'on-series' ? verdict.label : verdict.kind;
}
