// Reads SVG path data into absolute segments.
// Grammar: https://www.w3.org/TR/SVG2/paths.html#PathDataBNF
import type { Point } from './geometry.ts';

export type LineSegment = { kind: 'line'; from: Point; to: Point };
export type CubicSegment = { kind: 'cubic'; from: Point; control1: Point; control2: Point; to: Point };
export type QuadraticSegment = { kind: 'quadratic'; from: Point; control: Point; to: Point };
export type ArcSegment = {
  kind: 'arc';
  from: Point;
  to: Point;
  radiusX: number;
  radiusY: number;
  rotation: number;
  largeArc: boolean;
  sweep: boolean;
};
export type CurveSegment = CubicSegment | QuadraticSegment | ArcSegment;
export type Segment = LineSegment | CurveSegment;

type Command = { letter: string; args: number[] };
type Pen = { at: Point; subpathStart: Point; previous: Segment | undefined };

const PATH_DATA_ATTRIBUTE = /<path\b[^>]*?\sd\s*=\s*(["'])([\s\S]*?)\1/g;
const DECIMAL_PLACES = /\.(\d+)/g;
const ARGUMENT_COUNT: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
// In A, the large-arc and sweep flags are single characters that may touch the next number: "a10 10 0 0110 10".
const ARC_FLAG_INDEXES = new Set([3, 4]);
const ORIGIN: Point = { x: 0, y: 0 };

export function extractPathData(svg: string): string[] {
  return [...svg.matchAll(PATH_DATA_ATTRIBUTE)].map((match) => match[2]);
}

export function parsePathData(pathData: string): Segment[] {
  return parseContours(pathData).flat();
}

// One contour per subpath: a subpath ends at the next M or right after Z.
export function parseContours(pathData: string): Segment[][] {
  return toContours(readCommands(pathData)).filter((contour) => contour.length > 0);
}

export function coordinateRounding(pathData: string): number {
  const decimals = [...pathData.matchAll(DECIMAL_PLACES)].map((match) => match[1].length);
  return 0.5 / 10 ** Math.max(0, ...decimals);
}

function readCommands(pathData: string): Command[] {
  const scanner = new PathScanner(pathData);
  const commands: Command[] = [];
  while (scanner.hasMore()) {
    commands.push(...readArgumentGroups(scanner, scanner.readLetter()));
  }
  return commands;
}

function readArgumentGroups(scanner: PathScanner, letter: string): Command[] {
  const count = ARGUMENT_COUNT[letter.toUpperCase()];
  if (count === 0) return [{ letter, args: [] }];

  const groups = [{ letter, args: readArguments(scanner, letter, count) }];
  while (scanner.startsNumber()) {
    groups.push({ letter: implicitFollower(letter), args: readArguments(scanner, letter, count) });
  }
  return groups;
}

function readArguments(scanner: PathScanner, letter: string, count: number): number[] {
  const isArc = letter.toUpperCase() === 'A';
  return Array.from({ length: count }, (_, index) =>
    isArc && ARC_FLAG_INDEXES.has(index) ? scanner.readFlag() : scanner.readNumber(),
  );
}

// Extra coordinate pairs after a move are lines: "M0 0 10 0" draws to (10, 0).
function implicitFollower(letter: string): string {
  if (letter === 'M') return 'L';
  if (letter === 'm') return 'l';
  return letter;
}

function toContours(commands: Command[]): Segment[][] {
  const contours: Segment[][] = [[]];
  let pen: Pen = { at: ORIGIN, subpathStart: ORIGIN, previous: undefined };
  for (const command of commands) {
    const absolute = toAbsolute(command, pen.at);
    if (absolute.letter === 'M') {
      const start = pointAt(absolute.args, 0);
      pen = { at: start, subpathStart: start, previous: undefined };
      contours.push([]);
    } else {
      const segment = segmentFor(absolute, pen);
      contours[contours.length - 1].push(segment);
      pen = { ...pen, at: segment.to, previous: segment };
      if (absolute.letter === 'Z') contours.push([]);
    }
  }
  return contours;
}

function toAbsolute({ letter, args }: Command, at: Point): Command {
  const upper = letter.toUpperCase();
  if (letter === upper) return { letter, args };
  return { letter: upper, args: args.map((value, index) => value + relativeOffset(upper, index, at)) };
}

function relativeOffset(letter: string, index: number, at: Point): number {
  if (letter === 'H') return at.x;
  if (letter === 'V') return at.y;
  if (letter === 'A') return arcEndOffset(index, at);
  return index % 2 === 0 ? at.x : at.y;
}

// Only the end point of an arc is relative; its radii, rotation and flags are not.
function arcEndOffset(index: number, at: Point): number {
  if (index === 5) return at.x;
  if (index === 6) return at.y;
  return 0;
}

function segmentFor({ letter, args }: Command, pen: Pen): Segment {
  const from = pen.at;
  switch (letter) {
    case 'L':
      return { kind: 'line', from, to: pointAt(args, 0) };
    case 'H':
      return { kind: 'line', from, to: { x: args[0], y: from.y } };
    case 'V':
      return { kind: 'line', from, to: { x: from.x, y: args[0] } };
    case 'C':
      return { kind: 'cubic', from, control1: pointAt(args, 0), control2: pointAt(args, 2), to: pointAt(args, 4) };
    case 'S':
      return { kind: 'cubic', from, control1: smoothCubicControl(pen), control2: pointAt(args, 0), to: pointAt(args, 2) };
    case 'Q':
      return { kind: 'quadratic', from, control: pointAt(args, 0), to: pointAt(args, 2) };
    case 'T':
      return { kind: 'quadratic', from, control: smoothQuadraticControl(pen), to: pointAt(args, 0) };
    case 'A':
      return arcSegment(from, args);
    case 'Z':
      return { kind: 'line', from, to: pen.subpathStart };
    default:
      throw new Error(`Unknown path command ${letter}`);
  }
}

function arcSegment(from: Point, args: number[]): ArcSegment {
  const [radiusX, radiusY, rotation, largeArc, sweep] = args;
  return {
    kind: 'arc',
    from,
    to: pointAt(args, 5),
    radiusX,
    radiusY,
    rotation,
    largeArc: largeArc === 1,
    sweep: sweep === 1,
  };
}

// S and T mirror the previous curve's last control point through the current point.
// Without a previous curve of the same kind, the control point is the current point.
function smoothCubicControl(pen: Pen): Point {
  return pen.previous?.kind === 'cubic' ? mirror(pen.previous.control2, pen.at) : pen.at;
}

function smoothQuadraticControl(pen: Pen): Point {
  return pen.previous?.kind === 'quadratic' ? mirror(pen.previous.control, pen.at) : pen.at;
}

function mirror(point: Point, center: Point): Point {
  return { x: 2 * center.x - point.x, y: 2 * center.y - point.y };
}

function pointAt(args: number[], index: number): Point {
  return { x: args[index], y: args[index + 1] };
}

class PathScanner {
  static readonly #SEPARATORS = /[\s,]*/y;
  static readonly #LETTER = /[MLHVCSQTAZ]/iy;
  static readonly #NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  static readonly #FLAG = /[01]/y;
  static readonly #NUMBER_START = /[\d.+-]/;

  readonly #text: string;
  #position = 0;

  constructor(text: string) {
    this.#text = text;
  }

  hasMore(): boolean {
    this.#skipSeparators();
    return this.#position < this.#text.length;
  }

  startsNumber(): boolean {
    this.#skipSeparators();
    return PathScanner.#NUMBER_START.test(this.#text.charAt(this.#position));
  }

  readLetter(): string {
    return this.#read(PathScanner.#LETTER, 'a command letter');
  }

  readNumber(): number {
    this.#skipSeparators();
    return Number(this.#read(PathScanner.#NUMBER, 'a number'));
  }

  readFlag(): number {
    this.#skipSeparators();
    return Number(this.#read(PathScanner.#FLAG, 'an arc flag (0 or 1)'));
  }

  #skipSeparators(): void {
    this.#read(PathScanner.#SEPARATORS, 'separators');
  }

  #read(pattern: RegExp, expected: string): string {
    pattern.lastIndex = this.#position;
    const match = pattern.exec(this.#text);
    if (match === null) {
      throw new Error(`Invalid path data at position ${this.#position}: expected ${expected}`);
    }
    this.#position = pattern.lastIndex;
    return match[0];
  }
}
