// Judges every curve of an SVG against the golden series.
// The method: references/04-ruler-and-compass.md
import { fitCircle, type CircleFit } from './circle-fit.ts';
import { distance, type Point } from './geometry.ts';
import { seriesSteps } from './golden-series.ts';
import { coordinateRounding, extractPathData, parsePathData } from './svg-path.ts';

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

type MeasuredArc = CircleFit & { from: Point };
type JudgedArc = MeasuredArc & { verdict: Verdict };
type Candidate = { label: string; radius: number };
type Series = { radii: Candidate[]; offsets: Candidate[] };
type SeriesCircle = Candidate & { center: Point };

const TRANSFORM_ATTRIBUTE = /\stransform\s*=/;

export function auditSvg(svg: string, options: AuditOptions): AuditReport {
  const pathData = extractPathData(svg);
  const rounding = coordinateRounding(pathData.join(' '));
  const arcs = pathData.flatMap((data) => measureArcs(data, rounding));
  return {
    rows: groupIntoCircles(judgeArcs(arcs, options), options.tolerance),
    coordinateRounding: rounding,
    transformsIgnored: TRANSFORM_ATTRIBUTE.test(svg),
  };
}

// Lines are ruler work: only curves are measured.
function measureArcs(pathData: string, rounding: number): MeasuredArc[] {
  return parsePathData(pathData).flatMap((segment) => {
    if (segment.kind === 'line') return [];
    const fit = fitCircle(segment, rounding);
    return fit ? [{ ...fit, from: segment.from }] : [];
  });
}

function judgeArcs(arcs: MeasuredArc[], options: AuditOptions): JudgedArc[] {
  const series = seriesCandidates(options);
  const seriesCircles = arcs.flatMap((arc) => asSeriesCircle(arc, series, options.tolerance));
  return arcs.map((arc) => ({ ...arc, verdict: judgeArc(arc, series, seriesCircles, options.tolerance) }));
}

// Radii are steps R(n); an even outline offsets a radius by a step R(n) or a diameter D(n) = 2·R(n).
function seriesCandidates({ r0, tolerance }: AuditOptions): Series {
  const steps = seriesSteps(r0, tolerance);
  const radii = steps.map(({ step, radius }) => ({ label: `R${step}`, radius }));
  const diameters = steps.map(({ step, radius }) => ({ label: `D${step}`, radius: 2 * radius }));
  return { radii, offsets: [...radii, ...diameters] };
}

// A circle that lands on exactly one step can anchor the offsets drawn around its center.
function asSeriesCircle(arc: MeasuredArc, series: Series, tolerance: number): SeriesCircle[] {
  if (!isCircular(arc, tolerance)) return [];
  const steps = within(series.radii, arc.radius, matchWindow(arc, tolerance));
  return steps.length === 1 ? [{ ...steps[0], center: arc.center }] : [];
}

function judgeArc(arc: MeasuredArc, series: Series, seriesCircles: SeriesCircle[], tolerance: number): Verdict {
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
function concentricOffsets(arc: MeasuredArc, series: Series, seriesCircles: SeriesCircle[], tolerance: number): string[] {
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

function isCircular(arc: MeasuredArc, tolerance: number): boolean {
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

function groupIntoCircles(arcs: JudgedArc[], tolerance: number): CircleRow[] {
  const rows: CircleRow[] = [];
  for (const arc of arcs) {
    const row = rows.find((candidate) => isSameCircle(candidate, arc, tolerance));
    if (row) {
      row.segments += 1;
    } else {
      rows.push({ verdict: arc.verdict, radius: arc.radius, center: arc.center, from: arc.from, segments: 1 });
    }
  }
  return rows;
}

function isSameCircle(row: CircleRow, arc: JudgedArc, tolerance: number): boolean {
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
