import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { seriesRadius } from '../skills/rob-janoff-design/scripts/lib/golden-series.ts';
import { hiddenAt, measureScale, toPixels, type Detail } from '../skills/rob-janoff-design/scripts/lib/scale.ts';
import { assertClose } from './helpers/assert-close.ts';

const RING = 'M-100 0 A100 100 0 0 1 100 0 A100 100 0 0 1 -100 0 Z M-90 0 A90 90 0 0 1 90 0 A90 90 0 0 1 -90 0 Z';

describe('measureScale frame', () => {
  it('is the larger side of the viewBox', () => {
    assert.equal(measureScale('<svg viewBox="150 190 700 350"><path d="M0 0 L1 1"/></svg>').frame, 700);
  });

  it('falls back to the width and height attributes', () => {
    assert.equal(measureScale('<svg width="64px" height="32"><path d="M0 0 L1 1"/></svg>').frame, 64);
  });

  it('cannot be measured without a viewBox or a size', () => {
    assert.throws(() => measureScale('<svg><path d="M0 0 L1 1"/></svg>'), /viewBox/);
  });
});

describe('toPixels', () => {
  it('is measurement × px ÷ frame, as in the ruler-and-compass reference', () => {
    assertClose(toPixels(10, 48, 700), 0.69, 0.005);
    assertClose(toPixels(2 * seriesRadius(240, 7), 48, 700), 1.13, 0.005);
  });
});

describe('measureScale details', () => {
  it('measures the gap between two shapes, and where it is', () => {
    const [gap] = gapsOf(squares(0, 14));

    assert.deepEqual(gap.contours, [1, 2]);
    assertClose(gap.units, 4, 1e-9);
    assertClose(gap.at.x, 12, 1e-9);
  });

  it('measures the band of a ring as a gap between its two contours', () => {
    const [band] = gapsOf(`<svg viewBox="-110 -110 220 220"><path d="${RING}"/></svg>`);

    assertClose(band.units, 10, 0.05);
  });

  it('counts shapes that cross as an overlap, not a gap', () => {
    const report = measureScale(svg100(`<path d="${square(0, 0)} ${square(5, 5)}"/>`));

    assert.deepEqual(gapsOf(report), []);
    assert.equal(report.overlaps, 1);
  });

  it("lists each contour's narrowest gap once", () => {
    const gaps = gapsOf(squares(0, 14, 32));

    assert.deepEqual(
      gaps.map((gap) => [gap.contours, Math.round(gap.units)]),
      [
        [[1, 2], 4],
        [[2, 3], 8],
      ],
    );
  });

  it('measures each contour by the smaller side of its bounding box', () => {
    const sizes = measureScale(svg100('<path d="M0 0 h30 v6 h-30 Z"/>')).details.filter((detail) => detail.kind === 'size');

    assert.deepEqual(
      sizes.map((size) => [size.contour, size.units]),
      [[1, 6]],
    );
  });

  it('collects every distinct stroke width, from attributes and styles', () => {
    const strokes = measureScale(
      svg100(
        '<path d="M0 0 L10 0" stroke-width="2"/><path d="M0 5 L10 5" style="fill:none; stroke-width: 3"/><path d="M0 9 L10 9" stroke-width="2"/>',
      ),
    ).details.filter((detail) => detail.kind === 'stroke-width');

    assert.deepEqual(
      strokes.map((stroke) => stroke.units),
      [2, 3],
    );
  });

  it('sorts the details from the smallest', () => {
    const units = measureScale(squares(0, 14, 32)).details.map((detail) => detail.units);

    assert.deepEqual(units, [...units].sort((a, b) => a - b));
  });

  it('measures the D7 gap between the ear and the head in the cat logo', () => {
    const cat = readFileSync(new URL('../skills/rob-janoff-design/examples/cat/after.svg', import.meta.url), 'utf8');
    const report = measureScale(cat);
    const earGap = gapsOf(report).find((gap) => gap.contours.includes(3));

    assert.equal(report.frame, 700);
    assert.ok(earGap);
    assert.deepEqual(earGap.contours, [1, 3]);
    assertClose(earGap.units, 2 * seriesRadius(240, 7), 0.5);
  });
});

describe('hiddenAt', () => {
  it('lists the details that measure under 1 px at a size', () => {
    const report = measureScale(squares(0, 14));

    assert.deepEqual(hiddenAt(report, 48), [], 'the 4-unit gap is 1.92 px at 48 px');
    assert.deepEqual(
      hiddenAt(report, 16).map((detail) => detail.kind),
      ['gap'],
      'and 0.64 px at 16 px',
    );
  });
});

type Gap = Extract<Detail, { kind: 'gap' }>;

function gapsOf(svgOrReport: string | ReturnType<typeof measureScale>): Gap[] {
  const report = typeof svgOrReport === 'string' ? measureScale(svgOrReport) : svgOrReport;
  return report.details.filter((detail): detail is Gap => detail.kind === 'gap');
}

// Ten-unit squares along the x axis, one contour each, in a 100-unit frame.
function squares(...lefts: number[]): string {
  return svg100(`<path d="${lefts.map((left) => square(left, 0)).join(' ')}"/>`);
}

function square(left: number, top: number): string {
  return `M${left} ${top} h10 v10 h-10 Z`;
}

function svg100(content: string): string {
  return `<svg viewBox="0 0 100 100">${content}</svg>`;
}
