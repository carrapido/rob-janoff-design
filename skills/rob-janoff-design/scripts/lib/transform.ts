// SVG transforms as affine matrices [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f.
// https://www.w3.org/TR/SVG11/coords.html#TransformAttribute
import { toRadians, type Point } from './geometry.ts';

export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const TRANSFORM_FUNCTION = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
const FUNCTIONS: Record<string, (args: number[]) => Matrix> = {
  matrix: ([a, b, c, d, e, f]) => [a, b, c, d, e, f],
  translate: ([x, y = 0]) => [1, 0, 0, 1, x, y],
  scale: ([x, y = x]) => [x, 0, 0, y, 0, 0],
  rotate: ([degrees, centerX = 0, centerY = 0]) => rotation(degrees, { x: centerX, y: centerY }),
  skewX: ([degrees]) => [1, 0, Math.tan(toRadians(degrees)), 1, 0, 0],
  skewY: ([degrees]) => [1, Math.tan(toRadians(degrees)), 0, 1, 0, 0],
};

// A list of functions applies right to left: "translate(…) scale(…)" scales first.
export function parseTransform(text: string): Matrix {
  return [...text.matchAll(TRANSFORM_FUNCTION)]
    .map(([, name, args]) => FUNCTIONS[name](numbersIn(args)))
    .reduce(multiply, IDENTITY);
}

// The matrix that applies `inner` first, then `outer`.
export function multiply(outer: Matrix, inner: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyMatrix([a, b, c, d, e, f]: Matrix, { x, y }: Point): Point {
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

// The most the matrix stretches any length: its largest singular value.
export function largestScale([a, b, c, d]: Matrix): number {
  const halfSumOfSquares = (a ** 2 + b ** 2 + c ** 2 + d ** 2) / 2;
  const determinant = a * d - b * c;
  return Math.sqrt(halfSumOfSquares + Math.sqrt(Math.max(0, halfSumOfSquares ** 2 - determinant ** 2)));
}

// rotate(a cx cy) is translate(cx cy) rotate(a) translate(-cx -cy).
function rotation(degrees: number, center: Point): Matrix {
  const cos = Math.cos(toRadians(degrees));
  const sin = Math.sin(toRadians(degrees));
  const turn: Matrix = [cos, sin, -sin, cos, 0, 0];
  return multiply(multiply([1, 0, 0, 1, center.x, center.y], turn), [1, 0, 0, 1, -center.x, -center.y]);
}

function numbersIn(text: string): number[] {
  return text.trim().split(/[\s,]+/).filter(Boolean).map(Number);
}
