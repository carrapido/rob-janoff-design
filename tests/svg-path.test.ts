import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Point } from '../skills/rob-janoff-design/scripts/lib/geometry.ts';
import {
  coordinateRounding,
  extractPathData,
  parseContours,
  parsePathData,
  type LineSegment,
} from '../skills/rob-janoff-design/scripts/lib/svg-path.ts';

describe('extractPathData', () => {
  it('returns the d attribute of every path, whatever the quotes', () => {
    const svg = `<svg><rect width="4" height="4"/><path fill="#000" d="M0 0L1 1"/><path d='M2 2L3 3'/></svg>`;

    assert.deepEqual(extractPathData(svg), ['M0 0L1 1', 'M2 2L3 3']);
  });
});

describe('parsePathData', () => {
  it('turns absolute commands into segments', () => {
    assert.deepEqual(parsePathData('M0 0 L10 0 C10 5 5 10 0 10 Q-5 5 0 0'), [
      line(0, 0, 10, 0),
      { kind: 'cubic', from: point(10, 0), control1: point(10, 5), control2: point(5, 10), to: point(0, 10) },
      { kind: 'quadratic', from: point(0, 10), control: point(-5, 5), to: point(0, 0) },
    ]);
  });

  it('resolves relative commands against the current point', () => {
    assert.deepEqual(parsePathData('m10 10 l5 0 h5 v5 c0 5 -5 5 -10 5'), [
      line(10, 10, 15, 10),
      line(15, 10, 20, 10),
      line(20, 10, 20, 15),
      { kind: 'cubic', from: point(20, 15), control1: point(20, 20), control2: point(15, 20), to: point(10, 20) },
    ]);
  });

  it('closes a subpath back to its start and continues from there', () => {
    assert.deepEqual(parsePathData('M5 5 L10 5 Z l0 5'), [line(5, 5, 10, 5), line(10, 5, 5, 5), line(5, 5, 5, 10)]);
  });

  it('repeats the last command for extra coordinates, and turns extra M pairs into lines', () => {
    assert.deepEqual(parsePathData('M0 0 10 0 L10 10 0 10'), [
      line(0, 0, 10, 0),
      line(10, 0, 10, 10),
      line(10, 10, 0, 10),
    ]);
  });

  it('reads numbers written without separators', () => {
    assert.deepEqual(parsePathData('M1.5.5L-1-2 1e1 0'), [line(1.5, 0.5, -1, -2), line(-1, -2, 10, 0)]);
  });

  it('reads arc flags written together with the next number', () => {
    assert.deepEqual(parsePathData('M0 0a10 10 0 0110 10'), [
      {
        kind: 'arc',
        from: point(0, 0),
        to: point(10, 10),
        radiusX: 10,
        radiusY: 10,
        rotation: 0,
        largeArc: false,
        sweep: true,
      },
    ]);
  });

  it('reflects the previous control point for S and T', () => {
    const [, smoothCubic] = parsePathData('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
    const [, smoothQuadratic] = parsePathData('M0 0 Q5 10 10 0 T20 0');

    assert.deepEqual(smoothCubic, {
      kind: 'cubic',
      from: point(10, 0),
      control1: point(10, -10),
      control2: point(20, -10),
      to: point(20, 0),
    });
    assert.deepEqual(smoothQuadratic, { kind: 'quadratic', from: point(10, 0), control: point(15, -10), to: point(20, 0) });
  });

  it('uses the current point as the first control of S when no cubic precedes it', () => {
    const [, smoothCubic] = parsePathData('M0 0 L10 0 S20 10 20 0');

    assert.deepEqual(smoothCubic, {
      kind: 'cubic',
      from: point(10, 0),
      control1: point(10, 0),
      control2: point(20, 10),
      to: point(20, 0),
    });
  });

  it('rejects path data it cannot read, naming the position', () => {
    assert.throws(() => parsePathData('M0 0 X5'), /position 5/);
  });
});

describe('coordinateRounding', () => {
  it('is half of the last decimal place written in the path data', () => {
    assert.equal(coordinateRounding('M1.25 3.5L2 2'), 0.005);
    assert.equal(coordinateRounding('M1 2L3 4'), 0.5);
  });
});

describe('parseContours', () => {
  it('groups the segments of each subpath into one contour', () => {
    assert.deepEqual(parseContours('M0 0 L10 0 L10 10 Z M20 20 L30 20'), [
      [line(0, 0, 10, 0), line(10, 0, 10, 10), line(10, 10, 0, 0)],
      [line(20, 20, 30, 20)],
    ]);
  });

  it('drops a move that draws nothing', () => {
    assert.deepEqual(parseContours('M0 0 M5 5 L10 5'), [[line(5, 5, 10, 5)]]);
  });
});

function point(x: number, y: number): Point {
  return { x, y };
}

function line(fromX: number, fromY: number, toX: number, toY: number): LineSegment {
  return { kind: 'line', from: point(fromX, fromY), to: point(toX, toY) };
}
