// Reads the fills of an SVG that render-png paints, and lists what it leaves out.
// Painting: https://www.w3.org/TR/SVG2/painting.html · Basic shapes: https://www.w3.org/TR/SVG2/shapes.html
import { parseContours, type Segment } from './svg-path.ts';
import { IDENTITY, multiply, parseTransform, type Matrix } from './transform.ts';

export type ViewBox = { x: number; y: number; width: number; height: number };
// Channels from 0 to 255, alpha from 0 to 1.
export type Color = { red: number; green: number; blue: number; alpha: number };
export type FillRule = 'nonzero' | 'evenodd';
export type Shape = { contours: Segment[][]; color: Color; fillRule: FillRule; transform: Matrix };
export type SvgDocument = { viewBox: ViewBox; shapes: Shape[]; notDrawn: string[] };

type Attributes = Record<string, string>;
type Element = { name: string; attributes: Attributes; declarations: Attributes };
type Context = { inherited: Attributes; transform: Matrix; opacity: number; hidden: boolean };
type Reader = { shapes: Shape[]; notDrawn: Set<string> };

const VIEW_BOX = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/;
const COMMENT_OR_CDATA = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
// An opening, closing or self-closing tag; a quoted value may hold a ">". Doctypes and <?xml?> do not match.
const TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const INHERITED = ['fill', 'fill-rule', 'fill-opacity', 'stroke'];
const NOT_RENDERED = new Set([
  'defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern',
  'linearGradient', 'radialGradient', 'title', 'desc', 'metadata', 'script',
]);
const NOT_DRAWN_ELEMENTS = new Set(['text', 'use', 'image', 'foreignObject']);
const NOT_DRAWN_EFFECTS = ['mask', 'clip-path', 'filter'];
const SHAPES: Record<string, (attributes: Attributes) => string> = {
  path: (attributes) => attributes.d ?? '',
  rect: rectanglePath,
  circle: ({ cx, cy, r }) => ellipsePath(length(cx), length(cy), length(r), length(r)),
  ellipse: ({ cx, cy, rx, ry }) => ellipsePath(length(cx), length(cy), length(rx), length(ry)),
  polygon: ({ points }) => pointsPath(points),
  polyline: ({ points }) => pointsPath(points),
};
const BLACK: Color = { red: 0, green: 0, blue: 0, alpha: 1 };
const NAMED_COLORS: Record<string, Color | 'none'> = {
  black: BLACK,
  white: { red: 255, green: 255, blue: 255, alpha: 1 },
  none: 'none',
  transparent: 'none',
};
const ROOT: Context = { inherited: {}, transform: IDENTITY, opacity: 1, hidden: false };

export function readSvgDocument(svg: string): SvgDocument {
  const viewBox = readViewBox(svg);
  const reader: Reader = { shapes: [], notDrawn: new Set() };
  const open: Context[] = [ROOT];
  for (const [, closing, name, attributeText] of svg.replaceAll(COMMENT_OR_CDATA, '').matchAll(TAG)) {
    if (closing) {
      open.pop();
      continue;
    }
    const element = readElement(name, attributeText);
    const context = enter(open[open.length - 1], element);
    visit(element, context, reader);
    if (!attributeText.trimEnd().endsWith('/')) open.push(context);
  }
  return { viewBox, shapes: reader.shapes, notDrawn: [...reader.notDrawn] };
}

// The viewBox, or 0 0 width height. Also the frame scale-report measures against.
export function readViewBox(svg: string): ViewBox {
  const viewBox = VIEW_BOX.exec(svg)?.[1];
  const [x, y, width, height] = viewBox
    ? viewBox.trim().split(/[\s,]+/).map(Number)
    : [0, 0, svgSizeAttribute(svg, 'width'), svgSizeAttribute(svg, 'height')];
  if (!(width > 0 && height > 0)) {
    throw new Error('The SVG needs a viewBox (or a width and height) to know its frame.');
  }
  return { x, y, width, height };
}

// A plain number or a px length; a percentage says nothing about the frame.
function svgSizeAttribute(svg: string, name: string): number {
  const match = new RegExp(String.raw`<svg\b[^>]*?\s${name}\s*=\s*["']([\d.]+)(?:px)?["']`).exec(svg);
  return Number(match?.[1]);
}

// Presentation attributes, overridden by the style attribute.
function readElement(name: string, attributeText: string): Element {
  const attributes = Object.fromEntries(
    [...attributeText.matchAll(ATTRIBUTE)].map(([, key, doubleQuoted, singleQuoted]) => [key, doubleQuoted ?? singleQuoted]),
  );
  return { name, attributes, declarations: { ...attributes, ...styleDeclarations(attributes.style ?? '') } };
}

function styleDeclarations(style: string): Attributes {
  const declarations = style
    .split(';')
    .map((declaration) => declaration.split(':').map((part) => part.trim()))
    .filter(([property, value]) => property && value);
  return Object.fromEntries(declarations);
}

// Paint is inherited and transforms compose; opacity multiplies, which approximates a group's opacity.
function enter(parent: Context, { name, attributes, declarations }: Element): Context {
  const own = Object.fromEntries(INHERITED.filter((property) => property in declarations).map((property) => [property, declarations[property]]));
  return {
    inherited: { ...parent.inherited, ...own },
    transform: multiply(parent.transform, parseTransform(attributes.transform ?? '')),
    opacity: parent.opacity * Number(declarations.opacity ?? 1),
    hidden: parent.hidden || NOT_RENDERED.has(name) || declarations.display === 'none',
  };
}

function visit(element: Element, context: Context, reader: Reader): void {
  // A style block applies even from inside defs.
  if (element.name === 'style') reader.notDrawn.add('<style> block');
  if (context.hidden) return;

  if (NOT_DRAWN_ELEMENTS.has(element.name)) reader.notDrawn.add(`<${element.name}>`);
  for (const effect of NOT_DRAWN_EFFECTS.filter((name) => name in element.declarations)) reader.notDrawn.add(effect);
  if (element.name in SHAPES) addShape(element, context, reader);
}

function addShape({ name, attributes }: Element, context: Context, reader: Reader): void {
  const { fill = 'black', stroke = 'none' } = context.inherited;
  if (stroke !== 'none') reader.notDrawn.add('stroke');
  if (fill.startsWith('url(')) {
    reader.notDrawn.add('gradient or pattern fill');
    return;
  }

  const color = parseColor(fill);
  if (color === 'none') return;
  if (color === undefined) reader.notDrawn.add(`colour ${fill} (drawn black)`);
  const opacity = context.opacity * Number(context.inherited['fill-opacity'] ?? 1);
  reader.shapes.push({
    contours: parseContours(SHAPES[name](attributes)),
    color: { ...(color ?? BLACK), alpha: (color ?? BLACK).alpha * opacity },
    fillRule: context.inherited['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero',
    transform: context.transform,
  });
}

// undefined when the colour is not one render-png knows.
function parseColor(value: string): Color | 'none' | undefined {
  const text = value.trim().toLowerCase();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/.exec(text)?.[1];
  if (hex) return hexColor(hex);
  const rgb = /^rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*\)$/.exec(text);
  if (rgb) return { red: Number(rgb[1]), green: Number(rgb[2]), blue: Number(rgb[3]), alpha: 1 };
  return NAMED_COLORS[text];
}

function hexColor(hex: string): Color {
  const digits = hex.length === 3 ? [...hex].map((digit) => digit + digit) : hex.match(/../g) ?? [];
  const [red, green, blue] = digits.map((pair) => Number.parseInt(pair, 16));
  return { red, green, blue, alpha: 1 };
}

// A missing rx or ry takes the other's value; both stop at half the side.
function rectanglePath({ x, y, width, height, rx, ry }: Attributes): string {
  const left = length(x);
  const top = length(y);
  const right = left + length(width);
  const bottom = top + length(height);
  if (right <= left || bottom <= top) return '';

  const radiusX = Math.min(length(rx ?? ry), (right - left) / 2);
  const radiusY = Math.min(length(ry ?? rx), (bottom - top) / 2);
  if (radiusX <= 0 || radiusY <= 0) return `M${left} ${top} H${right} V${bottom} H${left} Z`;

  const corner = `A${radiusX} ${radiusY} 0 0 1`;
  return [
    `M${left + radiusX} ${top} H${right - radiusX} ${corner} ${right} ${top + radiusY}`,
    `V${bottom - radiusY} ${corner} ${right - radiusX} ${bottom}`,
    `H${left + radiusX} ${corner} ${left} ${bottom - radiusY}`,
    `V${top + radiusY} ${corner} ${left + radiusX} ${top} Z`,
  ].join(' ');
}

function ellipsePath(centerX: number, centerY: number, radiusX: number, radiusY: number): string {
  if (radiusX <= 0 || radiusY <= 0) return '';
  const half = `A${radiusX} ${radiusY} 0 1 0`;
  return `M${centerX - radiusX} ${centerY} ${half} ${centerX + radiusX} ${centerY} ${half} ${centerX - radiusX} ${centerY} Z`;
}

// A polyline is filled as if it were closed, like a polygon. An odd last number is dropped, as the spec says.
function pointsPath(points = ''): string {
  const all = points.trim().split(/[\s,]+/).filter(Boolean);
  const numbers = all.slice(0, all.length - (all.length % 2));
  if (numbers.length < 4) return '';
  return `M${numbers.slice(0, 2).join(' ')} L${numbers.slice(2).join(' ')} Z`;
}

// Units are dropped: "10px" is 10.
function length(value: string | undefined): number {
  return Number.parseFloat(value ?? '0') || 0;
}
