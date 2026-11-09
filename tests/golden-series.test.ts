import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seriesRadius, seriesSteps } from '../skills/rob-janoff-design/scripts/lib/golden-series.ts';
import { assertClose } from './helpers/assert-close.ts';

describe('seriesRadius', () => {
  it('divides R0 by φ once per step, as in the README table for R0 = 240', () => {
    assertClose(seriesRadius(240, -1), 388.3, 0.05);
    assert.equal(seriesRadius(240, 0), 240);
    assertClose(seriesRadius(240, 1), 148.3, 0.05);
    assertClose(seriesRadius(240, 4), 35, 0.05);
    assertClose(seriesRadius(240, 7), 8.3, 0.05);
  });

  it('makes each radius the sum of the next two', () => {
    assertClose(seriesRadius(240, 2), seriesRadius(240, 3) + seriesRadius(240, 4), 1e-9);
  });
});

describe('seriesSteps', () => {
  it('runs from R-3 down to the last radius still larger than the smallest one asked for', () => {
    const steps = seriesSteps(240, 0.48);

    assert.equal(steps[0].step, -3);
    assert.equal(steps.at(-1)?.step, 12, 'R12 is 0.75 and R13 is 0.46');
    assertClose(steps[3].radius, 240, 1e-9);
  });
});
