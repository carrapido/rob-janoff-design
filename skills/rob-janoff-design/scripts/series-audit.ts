// Checks that every curve of an SVG logo is an arc of the golden series R(n) = R0 / φⁿ.
// Exit codes: 0 every measurable curve is on the series, 1 a circle is off the series or not
// a circle, 2 the file could not be audited.
import { readFileSync } from 'node:fs';
import { auditSvg, isProblem, type AuditOptions, type AuditReport, type CircleRow, type Verdict } from './lib/audit.ts';
import {
  EXIT_PASS,
  EXIT_PROBLEMS,
  formatNumber,
  formatPoint,
  readCommandLine,
  runCommand,
  seriesOptions,
  TRANSFORM_WARNING,
  UsageError,
} from './lib/cli.ts';

type Request = { file: string; options: AuditOptions };

const USAGE = 'Usage: node series-audit.ts <logo.svg> --r0 <R0> [--tolerance <units>]';
const SECTIONS: { kind: Verdict['kind']; title: string }[] = [
  { kind: 'off-series', title: 'OFF SERIES' },
  { kind: 'not-circular', title: 'NOT CIRCULAR' },
  { kind: 'ambiguous', title: 'AMBIGUOUS (too flat to tell the candidates apart)' },
  { kind: 'on-series', title: 'ON SERIES' },
];

runCommand(USAGE, () => main(process.argv.slice(2)));

function main(args: string[]): number {
  const { file, options } = parseRequest(args);
  const report = auditSvg(readFileSync(file, 'utf8'), options);
  console.log(formatReport(file, options, report));
  return report.rows.some(hasProblem) ? EXIT_PROBLEMS : EXIT_PASS;
}

function parseRequest(args: string[]): Request {
  const { values, positionals } = readCommandLine(args, { r0: { type: 'string' }, tolerance: { type: 'string' } });
  if (positionals.length !== 1) throw new UsageError('Give one SVG file.');
  return { file: positionals[0], options: seriesOptions(values.r0, values.tolerance) };
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
    lines.push(TRANSFORM_WARNING);
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
  const problems = rows.filter(hasProblem).length;
  if (problems === 0) return 'PASS: every measurable curve is an arc of the series';
  return `FAIL: ${problems} ${problems === 1 ? 'circle is' : 'circles are'} off the series or not a circle`;
}

function hasProblem(row: CircleRow): boolean {
  return isProblem(row.verdict);
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
}
