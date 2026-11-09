import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/rob-janoff-design/scripts/scale-report.ts', import.meta.url));
const WORK_DIR = mkdtempSync(join(tmpdir(), 'scale-report-'));

describe('scale-report command', () => {
  it('exits 0 and prints PASS when every detail measures at least 1 px at 48 px', () => {
    const result = run(twoSquaresWithGap(4));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  });

  it('exits 1 and names the detail when one measures under 1 px at 48 px', () => {
    const result = run(twoSquaresWithGap(1));

    assert.equal(result.status, 1);
    assert.match(result.stdout, /gap/);
    assert.match(result.stdout, /FAIL/);
  });

  it('checks another size with --target', () => {
    assert.equal(run(twoSquaresWithGap(4), '--target', '16').status, 1, 'the 4-unit gap is 0.64 px at 16 px');
  });

  it('exits 2 with the usage when the file is missing', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });

  it('exits 2 when the file has no viewBox or size', () => {
    const result = run('<svg><path d="M0 0 L1 1"/></svg>');

    assert.equal(result.status, 2);
    assert.match(result.stderr, /viewBox/);
  });
});

function run(svg: string, ...options: string[]) {
  return spawnSync(process.execPath, [SCRIPT, writeSvg(svg), ...options], { encoding: 'utf8' });
}

function twoSquaresWithGap(gap: number): string {
  const right = 10 + gap;
  return `<svg viewBox="0 0 100 100"><path d="M0 0 h10 v10 h-10 Z M${right} 0 h10 v10 h-10 Z"/></svg>`;
}

function writeSvg(svg: string): string {
  const file = join(WORK_DIR, `logo-${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(file, svg);
  return file;
}
