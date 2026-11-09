import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/rob-janoff-design/scripts/series-fit.ts', import.meta.url));
const WORK_DIR = mkdtempSync(join(tmpdir(), 'series-fit-'));
// Snapping it to R1 moves its middle 0.20 units.
const OFF_SERIES_ARC = svg('M0 0 A153.6 153.6 0 0 1 80 0');
const S_CURVE = svg('M0 0 C30 -40 50 40 80 0');

describe('series-fit command', () => {
  it('exits 0 and prints the replacement command when every curve fits a series arc', () => {
    const result = run(OFF_SERIES_ARC, '--r0', '240');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /R1/);
    assert.match(result.stdout, /A148\.33 148\.33 0 0 1 80 0/);
    assert.match(result.stdout, /PASS/);
  });

  it('exits 1 when a curve needs a decision', () => {
    const result = run(S_CURVE, '--r0', '240');

    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAIL/);
  });

  it('with --since, fits only what changed from the last copy', () => {
    const result = run(S_CURVE, '--r0', '240', '--since', writeSvg(S_CURVE));

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /FAIL/);
  });

  it('uses R0 / 500 as the default tolerance, and --tolerance overrides it', () => {
    assert.equal(run(OFF_SERIES_ARC, '--r0', '240').status, 0, 'within the default 0.48');
    assert.equal(run(OFF_SERIES_ARC, '--r0', '240', '--tolerance', '0.1').status, 1);
  });

  it('exits 2 with the usage when --r0 is missing', () => {
    const result = run(OFF_SERIES_ARC);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });

  it('exits 2 when the last copy cannot be read', () => {
    const result = run(OFF_SERIES_ARC, '--r0', '240', '--since', join(WORK_DIR, 'missing.svg'));

    assert.equal(result.status, 2);
    assert.match(result.stderr, /missing\.svg/);
  });
});

function run(svgText: string, ...options: string[]) {
  return spawnSync(process.execPath, [SCRIPT, writeSvg(svgText), ...options], { encoding: 'utf8' });
}

function svg(pathData: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -50 100 100"><path d="${pathData}"/></svg>`;
}

function writeSvg(svgText: string): string {
  const file = join(WORK_DIR, `logo-${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(file, svgText);
  return file;
}
