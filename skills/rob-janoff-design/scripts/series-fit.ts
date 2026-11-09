// Fits the curves a client changed by hand, or that series-audit lists off the series, back onto
// the golden series R(n) = R0 / φⁿ, keeping each curve's end points.
// Exit codes: 0 every curve fits a series arc within the tolerance, 1 one or more need a decision,
// 2 a file could not be read.
import { readFileSync } from 'node:fs';
import type { AuditOptions } from './lib/audit.ts';
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
import { fitSvg, type CurveFit, type FitReport } from './lib/fit.ts';

type Request = { file: string; since: string | undefined; options: AuditOptions };

const USAGE = 'Usage: node series-fit.ts <edited.svg> --r0 <R0> [--since <last-copy.svg>] [--tolerance <units>]';

runCommand(USAGE, () => main(process.argv.slice(2)));

function main(args: string[]): number {
  const { file, since, options } = parseRequest(args);
  const lastCopy = since === undefined ? undefined : readFileSync(since, 'utf8');
  const report = fitSvg(readFileSync(file, 'utf8'), { ...options, lastCopy });
  console.log(formatReport(file, since, options, report));
  return report.curves.every((curve) => curve.fits) ? EXIT_PASS : EXIT_PROBLEMS;
}

function parseRequest(args: string[]): Request {
  const { values, positionals } = readCommandLine(args, {
    r0: { type: 'string' },
    tolerance: { type: 'string' },
    since: { type: 'string' },
  });
  if (positionals.length !== 1) throw new UsageError('Give one SVG file: the edited one.');
  return { file: positionals[0], since: values.since, options: seriesOptions(values.r0, values.tolerance) };
}

function formatReport(file: string, since: string | undefined, options: AuditOptions, report: FitReport): string {
  return [
    ...header(file, since, options, report),
    ...formatSection('NEEDS A DECISION: split the curve into two arcs, or ask the client what it is', needingDecision(report)),
    ...formatSection('FITS', report.curves.filter((curve) => curve.fits)),
    '',
    conclusion(report),
  ].join('\n');
}

function header(file: string, since: string | undefined, options: AuditOptions, report: FitReport): string[] {
  const scope = since === undefined ? 'curves series-audit lists off the series' : `curves changed since ${since}`;
  const lines = [
    `series-fit ${file}`,
    `R0 ${options.r0} · tolerance ${formatNumber(options.tolerance)} · ${scope} · each keeps its end points`,
  ];
  if (report.transformsIgnored) {
    lines.push(TRANSFORM_WARNING);
  }
  return lines;
}

function formatSection(title: string, curves: CurveFit[]): string[] {
  if (curves.length === 0) return [];
  return ['', `${title} (${curves.length})`, ...curves.flatMap(formatCurve)];
}

function formatCurve(curve: CurveFit): string[] {
  const { best, runnerUp, tangentTurn } = curve;
  const runnerUpNote = runnerUp ? ` · runner-up ${runnerUp.label} RMS ${formatNumber(runnerUp.rms)}` : '';
  return [
    `  from ${formatPoint(curve.from)} to ${formatPoint(curve.to)} · client r ${formatNumber(curve.clientRadius)}`,
    `    ${best.label} ${formatNumber(best.radius)} · RMS ${formatNumber(best.rms)} · largest ${formatNumber(best.largestError)} at ${formatPoint(best.largestErrorAt)}` +
      ` · tangent turns ${formatNumber(tangentTurn.start)}° / ${formatNumber(tangentTurn.end)}°${runnerUpNote}`,
    `    ${curve.command}`,
  ];
}

function conclusion(report: FitReport): string {
  if (report.curves.length === 0) return 'PASS: nothing to fit';
  const decisions = needingDecision(report).length;
  if (decisions === 0) return 'PASS: every curve fits a series arc within the tolerance';
  return `FAIL: ${decisions} ${decisions === 1 ? 'curve needs' : 'curves need'} a decision`;
}

function needingDecision(report: FitReport): CurveFit[] {
  return report.curves.filter((curve) => !curve.fits);
}
