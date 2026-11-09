// Reports the on-screen size of every detail of an SVG logo: measurement × px ÷ frame.
// Exit codes: 0 every detail measures at least 1 px at the target size, 1 one does not,
// 2 the file could not be measured.
import { readFileSync } from 'node:fs';
import {
  EXIT_PASS,
  EXIT_PROBLEMS,
  formatNumber,
  formatPoint,
  isPositive,
  readCommandLine,
  runCommand,
  UsageError,
} from './lib/cli.ts';
import { hiddenAt, measureScale, toPixels, type Detail, type ScaleReport } from './lib/scale.ts';

type Request = { file: string; target: number };

const USAGE = 'Usage: node scale-report.ts <logo.svg> [--target <px>]';
// The README's cat keeps its D7 gap visible at 48 px; at 16 px small details are expected to go.
const DEFAULT_TARGET = 48;
const REPORT_SIZES = [256, 48, 16];
const LABEL_WIDTH = 40;
const CELL_WIDTH = 9;

runCommand(USAGE, () => main(process.argv.slice(2)));

function main(args: string[]): number {
  const { file, target } = parseRequest(args);
  const report = measureScale(readFileSync(file, 'utf8'));
  console.log(formatReport(file, target, report));
  return hiddenAt(report, target).length > 0 ? EXIT_PROBLEMS : EXIT_PASS;
}

function parseRequest(args: string[]): Request {
  const { values, positionals } = readCommandLine(args, { target: { type: 'string' } });
  if (positionals.length !== 1) throw new UsageError('Give one SVG file.');

  const target = values.target === undefined ? DEFAULT_TARGET : Number(values.target);
  if (!isPositive(target)) throw new UsageError('--target must be a positive number of pixels.');
  return { file: positionals[0], target };
}

function formatReport(file: string, target: number, report: ScaleReport): string {
  return [
    `scale-report ${file}`,
    `frame ${report.frame} units · every detail must measure at least 1 px at ${target} px`,
    '',
    tableHeader(),
    ...report.details.map((detail) => formatDetail(detail, report.frame)),
    '',
    ...overlapNote(report.overlaps),
    conclusion(hiddenAt(report, target).length, target),
  ].join('\n');
}

function tableHeader(): string {
  const sizes = REPORT_SIZES.map((size) => `${`${size} px`.padStart(CELL_WIDTH - 2)}  `).join('');
  return `  ${'detail'.padEnd(LABEL_WIDTH)}${'units'.padStart(CELL_WIDTH)}${sizes}`;
}

function formatDetail(detail: Detail, frame: number): string {
  const pixels = REPORT_SIZES.map((size) => formatPixels(toPixels(detail.units, size, frame))).join('');
  return `  ${describe(detail).padEnd(LABEL_WIDTH)}${formatNumber(detail.units).padStart(CELL_WIDTH)}${pixels}`;
}

function describe(detail: Detail): string {
  switch (detail.kind) {
    case 'gap':
      return `gap ${detail.contours.join('–')} at ${formatPoint(detail.at)}`;
    case 'size':
      return `size of contour ${detail.contour} at ${formatPoint(detail.at)}`;
    case 'stroke-width':
      return 'stroke-width';
  }
}

// A mark after the number keeps the columns aligned whether or not the detail disappears.
function formatPixels(pixels: number): string {
  return `${formatNumber(pixels).padStart(CELL_WIDTH - 2)}${pixels < 1 ? ' ✗' : '  '}`;
}

function overlapNote(overlaps: number): string[] {
  if (overlaps === 0) return [];
  return [`overlaps: ${overlaps} contour pair(s) touch or cross, so they are not gaps`];
}

function conclusion(hidden: number, target: number): string {
  if (hidden === 0) return `PASS: every detail measures at least 1 px at ${target} px`;
  return `FAIL: ${hidden} ${hidden === 1 ? 'detail measures' : 'details measure'} under 1 px at ${target} px`;
}
