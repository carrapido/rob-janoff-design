import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { arcParameters } from '../skills/rob-janoff-design/scripts/lib/elliptical-arc.ts';
import { fitSvg, type CurveFit, type FitReport } from '../skills/rob-janoff-design/scripts/lib/fit.ts';
import { seriesRadius } from '../skills/rob-janoff-design/scripts/lib/golden-series.ts';
import { parsePathData } from '../skills/rob-janoff-design/scripts/lib/svg-path.ts';
import { assertClose, assertPointClose } from './helpers/assert-close.ts';

const OPTIONS = { r0: 240, tolerance: 0.48 };
const R1 = seriesRadius(240, 1);
// Every arc below runs from (0, 0) to (80, 0), a chord of 80, and bows up toward negative y.
const R1_ARC = 'M0 0 A148.33 148.33 0 0 1 80 0';
// The same R1 arc as an editor exports it: a cubic with 4/3 · tan(θ/4) · r arms, two decimals.
const R1_ARC_AS_CUBIC = 'M0 0 C26.17 -7.33 53.83 -7.33 80 0';
const OFF_SERIES_ARC = 'M0 0 A153.6 153.6 0 0 1 80 0';
const S_CURVE = 'M0 0 C30 -40 50 40 80 0';

describe('fitSvg: which curves', () => {
  it('fits only the curves the audit lists as off series or not circular, never lines', () => {
    const { curves } = fitSvg(svg(`${R1_ARC} L80 100`, 'M200 0 A153.6 153.6 0 0 1 280 0'), OPTIONS);

    assert.deepEqual(curves.map((curve) => curve.from), [{ x: 200, y: 0 }]);
  });

  it('with a last copy, fits only the curves that changed', () => {
    const lastCopy = svg(R1_ARC, 'M200 0 A148.33 148.33 0 0 1 280 0');
    // r 200 bows 1.46 units less than R1: a visible change, unlike r 153.6, which stays within 0.20.
    const edited = svg(R1_ARC, 'M200 0 A200 200 0 0 1 280 0');

    assert.deepEqual(fitSince(edited, lastCopy).curves.map((curve) => curve.from), [{ x: 200, y: 0 }]);
  });

  it('does not count an editor rewrite as a change: reversed, relative or as a cubic', () => {
    for (const rewrite of ['M80 0 A148.33 148.33 0 0 0 0 0', 'm0 0 a148.33 148.33 0 0 1 80 0', R1_ARC_AS_CUBIC]) {
      assert.deepEqual(fitSince(svg(rewrite), svg(R1_ARC)).curves, [], rewrite);
    }
  });

  it('with a last copy, lists a changed curve even when it lands on the series', () => {
    const [curve] = fitSince(svg('M0 0 A240 240 0 0 1 80 0'), svg(R1_ARC)).curves;

    assert.equal(curve.best.label, 'R0');
    assertClose(curve.best.largestError, 0, 1e-9);
    assert.equal(curve.fits, true);
  });
});

describe('fitSvg: the fit', () => {
  it('snaps an off-series arc to the step that moves it least, through the same end points', () => {
    const curve = onlyCurve(OFF_SERIES_ARC);

    assert.equal(curve.best.label, 'R1');
    assertClose(curve.best.radius, R1, 1e-9);
    assertPointClose(curve.best.center, { x: 40, y: Math.sqrt(R1 ** 2 - 40 ** 2) }, 1e-6);
    assert.deepEqual([curve.from, curve.to], [{ x: 0, y: 0 }, { x: 80, y: 0 }]);
    assertClose(curve.clientRadius, 153.6, 1e-9);
  });

  it('measures the error: RMS, the largest error and where it sits', () => {
    const { best, fits } = onlyCurve(OFF_SERIES_ARC);

    // Both arcs bow most at the middle: 5.30 units for r 153.6 and 5.50 for R1.
    assertClose(best.largestError, 0.2, 0.01);
    assertClose(best.largestErrorAt.x, 40, 0.5);
    assert.ok(best.rms > 0 && best.rms < best.largestError);
    assert.equal(fits, true);
  });

  it('names the runner-up step', () => {
    const { best, runnerUp } = onlyCurve(OFF_SERIES_ARC);

    assert.ok(runnerUp);
    assert.equal(runnerUp.label, 'R0');
    assert.ok(runnerUp.rms > best.rms);
  });

  it('reports how many degrees the tangent turns at each end', () => {
    const { tangentTurn } = onlyCurve(OFF_SERIES_ARC);

    // An arc leaves its chord at asin(half chord / r): 15.10° for r 153.6 and 15.65° for R1.
    assertClose(tangentTurn.start, 0.55, 0.005);
    assertClose(tangentTurn.end, 0.55, 0.005);
  });

  it('writes the replacement command, which draws the winning arc', () => {
    const curve = onlyCurve(OFF_SERIES_ARC);
    const [drawn] = parsePathData(`M0 0 ${curve.command}`);

    assert.equal(curve.command, 'A148.33 148.33 0 0 1 80 0');
    assert.ok(drawn.kind === 'arc');
    const parameters = arcParameters(drawn);
    assert.ok(parameters);
    assertPointClose(parameters.center, curve.best.center, 0.01);
  });

  it("draws the large arc when the client's curve bows farther than the radius", () => {
    const curve = onlyCurve('M0 0 A50 50 0 1 1 80 0');

    assert.equal(curve.best.label, 'R3');
    assert.equal(curve.command, 'A56.66 56.66 0 1 1 80 0');
  });

  it('skips steps shorter than half the chord, which cannot reach both ends', () => {
    // R4 (35.02) is the nearest radius, but an arc through both ends needs at least 40.
    assert.equal(onlyCurve('M0 0 A40.5 40.5 0 0 1 80 0').best.label, 'R3');
  });

  it('needs a decision when no series arc stays within the tolerance', () => {
    const { best, fits } = onlyCurve(S_CURVE);

    assert.equal(fits, false);
    assert.ok(best.largestError > OPTIONS.tolerance);
  });
});

describe('fitSvg: the file', () => {
  it('warns that transform attributes are not applied', () => {
    const transformed = `<svg><g transform="scale(2)"><path d="${OFF_SERIES_ARC}"/></g></svg>`;

    assert.equal(fitSvg(transformed, OPTIONS).transformsIgnored, true);
    assert.equal(fitSvg(svg(OFF_SERIES_ARC), OPTIONS).transformsIgnored, false);
  });

  it('fits the four off-series curves of the cat to R1 and R-1', () => {
    const cat = readFileSync(new URL('../assets/after.svg', import.meta.url), 'utf8');
    const { curves } = fitSvg(cat, OPTIONS);

    assert.deepEqual(curves.map((curve) => curve.best.label), ['R1', 'R-1', 'R-1', 'R1']);
    assert.ok(curves.every((curve) => curve.fits));
  });
});

function onlyCurve(pathData: string): CurveFit {
  const { curves } = fitSvg(svg(pathData), OPTIONS);
  assert.equal(curves.length, 1);
  return curves[0];
}

function fitSince(edited: string, lastCopy: string): FitReport {
  return fitSvg(edited, { ...OPTIONS, lastCopy });
}

function svg(...pathData: string[]): string {
  const paths = pathData.map((d) => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}
