// Paints the fills of an SVG document into antialiased RGBA pixels.
// Fill rules: https://www.w3.org/TR/SVG2/painting.html#FillRuleProperty
import { flattenContour } from './contours.ts';
import type { Point } from './geometry.ts';
import { CHANNELS, type Image } from './image.ts';
import type { Color, FillRule, Shape, SvgDocument } from './svg-document.ts';
import { applyMatrix, largestScale, multiply, type Matrix } from './transform.ts';

type Edge = { top: Point; bottom: Point; winding: number };
type Crossing = { x: number; winding: number };

// Coverage is exact across a row; down the row it is sampled on this many sub-scanlines.
const SUBSCANLINES = 16;
// Curves are flattened in quarter-pixel steps, so they stay far within a pixel of the true shape.
const FLATTEN_STEP_IN_PIXELS = 0.25;

export function rasterize(document: SvgDocument, size: number): Image {
  const { viewBox } = document;
  const scale = size / Math.max(viewBox.width, viewBox.height);
  const width = Math.round(viewBox.width * scale);
  const height = Math.round(viewBox.height * scale);
  const toDevice: Matrix = [scale, 0, 0, scale, -viewBox.x * scale, -viewBox.y * scale];
  // Premultiplied channels from 0 to 1, so painting over is one multiply-add per channel.
  const canvas = new Float64Array(width * height * CHANNELS);
  for (const shape of document.shapes) {
    const polygons = devicePolygons(shape, toDevice);
    paintOver(canvas, coverage(polygons, shape.fillRule, width, height), shape.color);
  }
  return { width, height, pixels: toStraightBytes(canvas) };
}

function devicePolygons(shape: Shape, toDevice: Matrix): Point[][] {
  const transform = multiply(toDevice, shape.transform);
  const spacing = FLATTEN_STEP_IN_PIXELS / largestScale(transform);
  return shape.contours.map((contour) => flattenContour(contour, spacing).map((point) => applyMatrix(transform, point)));
}

// The share of each pixel that lies inside the shape, from 0 to 1.
function coverage(polygons: Point[][], fillRule: FillRule, width: number, height: number): Float64Array {
  const cover = new Float64Array(width * height);
  const edgesOfRow = edgesByRow(polygons, height);
  for (let row = 0; row < height; row += 1) {
    coverRow(cover.subarray(row * width, (row + 1) * width), edgesOfRow[row], row, fillRule);
  }
  return cover;
}

// Each edge is listed in every pixel row it crosses; horizontal edges cross no sub-scanline.
function edgesByRow(polygons: Point[][], height: number): Edge[][] {
  const rows: Edge[][] = Array.from({ length: height }, () => []);
  for (const edge of polygons.flatMap(edgesOf)) {
    const last = Math.min(height - 1, Math.floor(edge.bottom.y));
    for (let row = Math.max(0, Math.floor(edge.top.y)); row <= last; row += 1) rows[row].push(edge);
  }
  return rows;
}

// A downward edge winds +1 and an upward one −1.
function edgesOf(polygon: Point[]): Edge[] {
  return polygon.slice(1).flatMap((to, index) => {
    const from = polygon[index];
    if (from.y === to.y) return [];
    return from.y < to.y ? [{ top: from, bottom: to, winding: 1 }] : [{ top: to, bottom: from, winding: -1 }];
  });
}

function coverRow(rowCover: Float64Array, edges: Edge[], row: number, fillRule: FillRule): void {
  for (let sub = 0; sub < SUBSCANLINES; sub += 1) {
    const y = row + (sub + 0.5) / SUBSCANLINES;
    for (const [left, right] of insideSpans(crossingsAt(edges, y), fillRule)) {
      addSpan(rowCover, left, right, 1 / SUBSCANLINES);
    }
  }
}

function crossingsAt(edges: Edge[], y: number): Crossing[] {
  return edges
    .filter(({ top, bottom }) => top.y <= y && y < bottom.y)
    .map(({ top, bottom, winding }) => ({ x: top.x + ((y - top.y) * (bottom.x - top.x)) / (bottom.y - top.y), winding }))
    .sort((a, b) => a.x - b.x);
}

// Walking left to right, the winding number says whether each stretch is inside.
function insideSpans(crossings: Crossing[], fillRule: FillRule): [number, number][] {
  const spans: [number, number][] = [];
  let winding = 0;
  crossings.forEach((crossing, index) => {
    winding += crossing.winding;
    const isInside = fillRule === 'nonzero' ? winding !== 0 : winding % 2 !== 0;
    if (isInside && index + 1 < crossings.length) spans.push([crossing.x, crossings[index + 1].x]);
  });
  return spans;
}

// Adds weight × the length of the span inside each pixel it touches.
function addSpan(rowCover: Float64Array, left: number, right: number, weight: number): void {
  const from = Math.max(0, left);
  const to = Math.min(rowCover.length, right);
  if (to <= from) return;

  const first = Math.floor(from);
  const last = Math.min(rowCover.length - 1, Math.floor(to));
  if (first === last) {
    rowCover[first] += (to - from) * weight;
    return;
  }
  rowCover[first] += (first + 1 - from) * weight;
  for (let x = first + 1; x < last; x += 1) rowCover[x] += weight;
  rowCover[last] += (to - last) * weight;
}

function paintOver(canvas: Float64Array, cover: Float64Array, color: Color): void {
  const channels = [color.red / 255, color.green / 255, color.blue / 255, 1];
  cover.forEach((share, pixel) => {
    const alpha = Math.min(1, share) * color.alpha;
    if (alpha === 0) return;
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      const offset = pixel * CHANNELS + channel;
      canvas[offset] = channels[channel] * alpha + canvas[offset] * (1 - alpha);
    }
  });
}

function toStraightBytes(canvas: Float64Array): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(canvas.length);
  for (let offset = 0; offset < canvas.length; offset += CHANNELS) {
    const alpha = canvas[offset + 3];
    if (alpha === 0) continue;
    for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = (canvas[offset + channel] / alpha) * 255;
    pixels[offset + 3] = alpha * 255;
  }
  return pixels;
}
