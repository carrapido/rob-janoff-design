// Checks that every curve of an SVG logo is an arc of the golden series R(n) = R0 / φⁿ.
// Exit codes: 0 every measurable curve is on the series, 1 a circle is off the series or not
// a circle, 2 the file could not be audited.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { auditSvg, type AuditOptions, type AuditReport, type CircleRow, type Verdict } from './lib/audit.ts';
import type { Point } from './lib/geometry.ts';

type Request = { file: string; options: AuditOptions };

const USAGE = 'Usage: node series-audit.ts <logo.svg> --r0 <R0> [--tolerance <units>]';
// 0.48 units on the cat's 240-unit head: wider than two-decimal rounding, far narrower than a radius set by eye.
const DEFAULT_TOLERANCE_RATIO = 1 / 500;
const EXIT_PASS = 0;
const EXIT_PROBLEMS = 1;
const EXIT_ERROR = 2;
const SECTIONS: { kind: Verdict['kind']; title: string }[] = [
  { kind: 'off-series', title: 'OFF SERIES' },
  { kind: 'not-circular', title: 'NOT CIRCULAR' },
  { kind: 'ambiguous', title: 'AMBIGUOUS (too flat to tell the candidates apart)' },
  { kind: 'on-series', title: 'ON SERIES' },
];

class UsageError extends Error {}

main(process.argv.slice(2));

function main(args: string[]): void {
  try {
    const { file, options } = parseRequest(args);
    const report = auditSvg(readFileSync(file, 'utf8'), options);
    console.log(formatReport(file, options, report));
    process.exitCode = report.rows.some(isProblem) ? EXIT_PROBLEMS : EXIT_PASS;
  } catch (error) {
    console.error(error instanceof UsageError ? `${error.message}\n${USAGE}` : String(error));
    process.exitCode = EXIT_ERROR;
  }
}

function parseRequest(args: string[]): Request {
  const { values, positionals } = readArguments(args);
  const r0 = Number(values.r0);
  if (positionals.length !== 1 || !isPositive(r0)) {
    throw new UsageError('Give one SVG file and a positive --r0.');
  }

  const tolerance = values.tolerance === undefined ? r0 * DEFAULT_TOLERANCE_RATIO : Number(values.tolerance);
  if (!isPositive(tolerance)) throw new UsageError('--tolerance must be a positive number.');
  return { file: positionals[0], options: { r0, tolerance } };
}

// https://nodejs.org/docs/latest-v24.x/api/util.html#utilparseargsconfig
function readArguments(args: string[]) {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      options: { r0: { type: 'string' }, tolerance: { type: 'string' } },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function formatReport(file: string, options: AuditOptions, report: AuditReport): string {
  return [
    ...header(file, options, report),
    ...SECTIONS.flatMap((section) => formatSection(section.title, rowsOfKind(report.rows, section.kind))),
    '',
    conclusion(report.rows),
  ].join('\n');
}

function header(file: string, options: AuditOptions, report: AuditReport): string[] {
  const lines = [
    `series-audit ${file}`,
    `R0 ${options.r0} · tolerance ${formatNumber(options.tolerance)} · coordinates rounded to ${report.coordinateRounding}`,
  ];
  if (report.transformsIgnored) {
    lines.push('warning: transform attributes are not applied, so radii inside scaled groups are wrong');
  }
  return lines;
}

function rowsOfKind(rows: CircleRow[], kind: Verdict['kind']): CircleRow[] {
  return rows.filter((row) => row.verdict.kind === kind);
}

function formatSection(title: string, rows: CircleRow[]): string[] {
  if (rows.length === 0) return [];
  return ['', `${title} (${rows.length})`, ...rows.map(formatRow)];
}

function formatRow(row: CircleRow): string {
  const radius = formatNumber(row.radius).padStart(8);
  const verdict = describe(row.verdict).padEnd(20);
  const segments = row.segments === 1 ? '1 segment ' : `${row.segments} segments`;
  return `  ${radius}  ${verdict}  center ${formatPoint(row.center)}  ${segments}  from ${formatPoint(row.from)}`;
}

function describe(verdict: Verdict): string {
  switch (verdict.kind) {
    case 'on-series':
      return verdict.label;
    case 'off-series':
      return `nearest ${verdict.nearest} ${formatSigned(verdict.difference)}`;
    case 'ambiguous':
      return `fits ${verdict.candidates.join(' or ')}`;
    case 'not-circular':
      return 'not a circle';
  }
}

function conclusion(rows: CircleRow[]): string {
  const problems = rows.filter(isProblem).length;
  if (problems === 0) return 'PASS: every measurable curve is an arc of the series';
  return `FAIL: ${problems} ${problems === 1 ? 'circle is' : 'circles are'} off the series or not a circle`;
}

function isProblem(row: CircleRow): boolean {
  return row.verdict.kind === 'off-series' || row.verdict.kind === 'not-circular';
}

function formatPoint({ x, y }: Point): string {
  return `(${formatNumber(x)}, ${formatNumber(y)})`;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}
