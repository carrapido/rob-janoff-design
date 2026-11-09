// What the commands share: exit codes, argument errors and number formatting.
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import type { Point } from './geometry.ts';

export const EXIT_PASS = 0;
export const EXIT_PROBLEMS = 1;
const EXIT_ERROR = 2;

export class UsageError extends Error {}

// Exit code 2 means the file could not be checked; a usage error also prints the usage.
export function runCommand(usage: string, command: () => number): void {
  try {
    process.exitCode = command();
  } catch (error) {
    console.error(error instanceof UsageError ? `${error.message}\n${usage}` : String(error));
    process.exitCode = EXIT_ERROR;
  }
}

// https://nodejs.org/docs/latest-v24.x/api/util.html#utilparseargsconfig
export function readCommandLine<Options extends ParseArgsOptionsConfig>(args: string[], options: Options) {
  try {
    return parseArgs({ args, options, allowPositionals: true });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

export function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function formatPoint({ x, y }: Point): string {
  return `(${formatNumber(x)}, ${formatNumber(y)})`;
}

export function formatNumber(value: number): string {
  return value.toFixed(2);
}
