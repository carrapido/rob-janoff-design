export type Point = { x: number; y: number };

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function closestPointOnSegment(point: Point, from: Point, to: Point): Point {
  const direction = subtract(to, from);
  const lengthSquared = dot(direction, direction);
  if (lengthSquared === 0) return from;

  const along = Math.min(1, Math.max(0, dot(subtract(point, from), direction) / lengthSquared));
  return { x: from.x + direction.x * along, y: from.y + direction.y * along };
}
