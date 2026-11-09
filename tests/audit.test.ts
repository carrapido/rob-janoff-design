import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { auditSvg, type AuditReport } from '../skills/rob-janoff-design/scripts/lib/audit.ts';
import { assertClose, assertPointClose } from './helpers/assert-close.ts';

const OPTIONS = { r0: 240, tolerance: 0.48 };
// Half circles centered on (500, 540), the head's center in assets/after.svg.
const HEAD_R0 = 'M260 540 A240 240 0 0 1 740 540';
const FACE_R0_MINUS_R4 = 'M295.02 540 A204.98 204.98 0 0 1 704.98 540';
const HAIR_GAP_R0_PLUS_D7 = 'M243.47 540 A256.53 256.53 0 0 1 756.53 540';

describe('auditSvg', () => {
  it('labels an arc whose radius is a step of the series', () => {
    const [row] = audit(HEAD_R0).rows;

    assert.deepEqual(row.verdict, { kind: 'on-series', label: 'R0' });
    assertClose(row.radius, 240, 1e-9);
    assertPointClose(row.center, { x: 500, y: 540 }, 1e-9);
    assert.deepEqual(row.from, { x: 260, y: 540 });
  });

  it('names a concentric offset by the step it removes or adds', () => {
    const labels = audit(HEAD_R0, FACE_R0_MINUS_R4, HAIR_GAP_R0_PLUS_D7).rows.map((row) => row.verdict);

    assert.deepEqual(labels, [
      { kind: 'on-series', label: 'R0' },
      { kind: 'on-series', label: 'R0-R4' },
      { kind: 'on-series', label: 'R0+D7' },
    ]);
  });

  it('reports an offset that shares no center with a series circle as off series, with the nearest step', () => {
    const faceMovedRight = 'M395.02 540 A204.98 204.98 0 0 1 804.98 540';
    const [, row] = audit(HEAD_R0, faceMovedRight).rows;

    assert.equal(row.verdict.kind, 'off-series');
    assert.ok(row.verdict.kind === 'off-series');
    assert.equal(row.verdict.nearest, 'R0');
    assertClose(row.verdict.difference, -35.02, 1e-9);
  });

  it('flags a curve that is not an arc of a circle', () => {
    const [row] = audit('M0 0 A100 50 0 0 1 200 0').rows;

    assert.deepEqual(row.verdict, { kind: 'not-circular' });
  });

  it('calls a curve ambiguous when it is too flat to tell two steps apart', () => {
    const [row] = audit('M0 0 Q50 2 100 0').rows;

    assert.equal(row.verdict.kind, 'ambiguous');
  });

  it('skips straight lines', () => {
    assert.deepEqual(audit('M0 0 L100 0 L100 100 Z').rows, []);
  });

  it('groups the segments of one circle into one row', () => {
    const fullHead = 'M260 540 A240 240 0 0 1 740 540 A240 240 0 0 1 260 540';
    const rows = audit(fullHead).rows;

    assert.equal(rows.length, 1);
    assert.equal(rows[0].segments, 2);
  });

  it('warns that transform attributes are not applied', () => {
    const transformed = auditSvg(`<svg><g transform="scale(2)"><path d="${HEAD_R0}"/></g></svg>`, OPTIONS);

    assert.equal(transformed.transformsIgnored, true);
    assert.equal(audit(HEAD_R0).transformsIgnored, false);
  });

  it('recognises the constructions the README names in the cat logo', () => {
    const cat = readFileSync(new URL('../assets/after.svg', import.meta.url), 'utf8');
    const labels = auditSvg(cat, OPTIONS).rows.flatMap((row) => (row.verdict.kind === 'on-series' ? [row.verdict.label] : []));

    for (const construction of ['R-1', 'R0', 'R1', 'R2', 'R3', 'R0-R4', 'R0+D7']) {
      assert.ok(labels.includes(construction), `${construction} missing from ${labels.join(', ')}`);
    }
  });
});

function audit(...pathData: string[]): AuditReport {
  const paths = pathData.map((d) => `<path d="${d}"/>`).join('');
  return auditSvg(`<svg xmlns="http://www.w3.org/2000/svg">${paths}</svg>`, OPTIONS);
}
