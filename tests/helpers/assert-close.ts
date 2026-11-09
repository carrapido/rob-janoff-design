import assert from 'node:assert/strict';
import type { Point } from '../../skills/rob-janoff-design/scripts/lib/geometry.ts';

export function assertClose(actual: number, expected: number, tolerance: number): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

export function assertPointClose(actual: Point, expected: Point, tolerance: number): void {
  assertClose(actual.x, expected.x, tolerance);
  assertClose(actual.y, expected.y, tolerance);
}
