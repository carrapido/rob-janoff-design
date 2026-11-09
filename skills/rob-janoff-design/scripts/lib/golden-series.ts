// The golden series R(n) = R0 / φⁿ: every radius of a logo built with ruler and compass.
// See references/04-ruler-and-compass.md, section 1.

export type SeriesStep = { step: number; radius: number };

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
// R-1 is the largest arc of the cat logo; two more steps leave room for wider frames.
const LARGEST_STEP = -3;

export function seriesSteps(r0: number, smallest: number): SeriesStep[] {
  const steps: SeriesStep[] = [];
  for (let step = LARGEST_STEP; seriesRadius(r0, step) >= smallest; step += 1) {
    steps.push({ step, radius: seriesRadius(r0, step) });
  }
  return steps;
}

export function seriesRadius(r0: number, step: number): number {
  return r0 / GOLDEN_RATIO ** step;
}
