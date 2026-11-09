import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decodePng } from './helpers/png.ts';

const SCRIPT = fileURLToPath(new URL('../skills/rob-janoff-design/scripts/render-png.ts', import.meta.url));
const SQUARE = '<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60"/></svg>';

describe('render-png command', () => {
  it('writes the 256, 48 and 16 px renders and the sheet, and exits 0', () => {
    const { file, outDir } = writeLogo(SQUARE);
    const result = run(file, '--out', outDir);

    assert.equal(result.status, 0, result.stderr);
    for (const [suffix, width] of [['256', 256], ['48', 48], ['16', 16]] as const) {
      assert.equal(decodePng(readFileSync(join(outDir, `logo-${suffix}.png`))).width, width);
    }
    assert.ok(existsSync(join(outDir, 'logo-sheet.png')));
    assert.match(result.stdout, /logo-sheet\.png/);
  });

  it('writes next to the SVG when --out is not given', () => {
    const { file, dir } = writeLogo(SQUARE);

    assert.equal(run(file).status, 0);
    assert.ok(existsSync(join(dir, 'logo-16.png')));
  });

  it('still writes the files, but exits 1 and lists what it did not draw', () => {
    const { file, outDir } = writeLogo('<svg viewBox="0 0 100 100"><path d="M0 0 L100 100" stroke="#000"/></svg>');
    const result = run(file, '--out', outDir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /stroke/);
    assert.ok(existsSync(join(outDir, 'logo-sheet.png')));
  });

  it('exits 2 when the SVG has no viewBox or size', () => {
    const { file } = writeLogo('<svg><rect width="10" height="10"/></svg>');
    const result = run(file);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /viewBox/);
  });

  it('exits 2 with the usage when the file is missing', () => {
    const result = run();

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });
});

function run(...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function writeLogo(svg: string): { file: string; dir: string; outDir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'render-png-'));
  const file = join(dir, 'logo.svg');
  writeFileSync(file, svg);
  return { file, dir, outDir: mkdtempSync(join(tmpdir(), 'render-png-out-')) };
}
