import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/rob-janoff-design/scripts/series-audit.ts', import.meta.url));
const WORK_DIR = mkdtempSync(join(tmpdir(), 'series-audit-'));

describe('series-audit command', () => {
  it('exits 0 and prints PASS when every circle is on the series', () => {
    const result = run(logoWithRadius(240), '--r0', '240');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  });

  it('exits 1 and lists the circle when one is off the series', () => {
    const result = run(logoWithRadius(200), '--r0', '240');

    assert.equal(result.status, 1);
    assert.match(result.stdout, /OFF SERIES/);
    assert.match(result.stdout, /200\.00/);
  });

  it('uses R0 / 500 as the default tolerance, and --tolerance overrides it', () => {
    const slightlyOff = logoWithRadius(240.4);

    assert.equal(run(slightlyOff, '--r0', '240').status, 0, 'within the default 0.48');
    assert.equal(run(slightlyOff, '--r0', '240', '--tolerance', '0.1').status, 1);
  });

  it('exits 2 with the usage when --r0 is missing', () => {
    const result = run(logoWithRadius(240));

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });

  it('warns that transform attributes are not applied', () => {
    const file = writeSvg(`<svg><g transform="scale(2)"><path d="M260 540 A240 240 0 0 1 740 540"/></g></svg>`);
    const result = spawnSync(process.execPath, [SCRIPT, file, '--r0', '240'], { encoding: 'utf8' });

    assert.match(result.stdout, /transform/);
  });
});

function run(svg: string, ...options: string[]) {
  return spawnSync(process.execPath, [SCRIPT, writeSvg(svg), ...options], { encoding: 'utf8' });
}

function logoWithRadius(radius: number): string {
  return `<svg><path d="M${500 - radius} 540 A${radius} ${radius} 0 0 1 ${500 + radius} 540"/></svg>`;
}

function writeSvg(svg: string): string {
  const file = join(WORK_DIR, `logo-${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(file, svg);
  return file;
}
