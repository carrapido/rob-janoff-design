import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { contactSheet, enlarge, type Image } from '../skills/rob-janoff-design/scripts/lib/image.ts';
import { rasterize } from '../skills/rob-janoff-design/scripts/lib/raster.ts';
import { readSvgDocument } from '../skills/rob-janoff-design/scripts/lib/svg-document.ts';
import { assertClose } from './helpers/assert-close.ts';

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const BLACK = [0, 0, 0, 255];
const TRANSPARENT = [0, 0, 0, 0];
const MID_GREY = [128, 128, 128, 255];

describe('rasterize: shapes and paint', () => {
  it('fills a shape with its color and leaves the rest transparent', () => {
    const image = render('<rect width="50" height="100" fill="#ff0000"/>');

    assert.deepEqual(pixel(image, 25, 50), RED);
    assert.deepEqual(pixel(image, 75, 50), TRANSPARENT);
  });

  it('antialiases an edge by its exact horizontal coverage', () => {
    const image = render('<rect width="50.5" height="100" fill="#ff0000"/>');

    assertClose(pixel(image, 50, 50)[3], 128, 1);
  });

  it('maps the viewBox onto the size, keeping the aspect of a frame that is not square', () => {
    const image = rasterize(readSvgDocument(svg('<rect x="100" y="100" width="100" height="100"/>', '100 100 200 100')), 50);

    assert.deepEqual([image.width, image.height], [50, 25]);
    assert.deepEqual(pixel(image, 10, 10), BLACK);
    assert.deepEqual(pixel(image, 40, 10), TRANSPARENT);
  });

  it('fills nested contours by the fill rule', () => {
    const sameDirection = 'M10 10 H90 V90 H10 Z M30 30 H70 V70 H30 Z';

    assert.deepEqual(pixel(render(`<path d="${sameDirection}"/>`), 50, 50), BLACK, 'nonzero fills the inner square');
    assert.deepEqual(pixel(render(`<path fill-rule="evenodd" d="${sameDirection}"/>`), 50, 50), TRANSPARENT);
  });

  it('cuts a hole where a contour runs the other way under nonzero', () => {
    const image = render('<path d="M10 10 H90 V90 H10 Z M30 30 V70 H70 V30 Z"/>');

    assert.deepEqual(pixel(image, 50, 50), TRANSPARENT);
    assert.deepEqual(pixel(image, 20, 50), BLACK);
  });

  it('paints in document order', () => {
    const image = render('<rect width="100" height="100" fill="#ff0000"/><rect width="50" height="100" fill="#0000ff"/>');

    assert.deepEqual(pixel(image, 25, 50), BLUE);
    assert.deepEqual(pixel(image, 75, 50), RED);
  });

  it('draws circles, ellipses, polygons, polylines and rounded rectangles', () => {
    const circle = render('<circle cx="50" cy="50" r="40"/>');
    const ellipse = render('<ellipse cx="50" cy="50" rx="40" ry="20"/>');
    const polygon = render('<polygon points="0,0 100,0 0,100"/>');
    const polyline = render('<polyline points="0 0 100 0 0 100"/>');
    const rounded = render('<rect width="100" height="100" rx="30"/>');

    assert.deepEqual([pixel(circle, 50, 50), pixel(circle, 5, 5)], [BLACK, TRANSPARENT]);
    assert.deepEqual([pixel(ellipse, 50, 50), pixel(ellipse, 50, 25)], [BLACK, TRANSPARENT]);
    assert.deepEqual([pixel(polygon, 10, 10), pixel(polygon, 90, 90)], [BLACK, TRANSPARENT]);
    assert.deepEqual(pixel(polyline, 10, 10), BLACK, 'a polyline is filled as if closed');
    assert.deepEqual([pixel(rounded, 50, 2), pixel(rounded, 2, 2)], [BLACK, TRANSPARENT]);
  });

  it('reads #rgb, #rrggbb and rgb() colors; a missing fill is black and none draws nothing', () => {
    assert.deepEqual(pixel(render('<rect width="100" height="100" fill="#f80"/>'), 50, 50), [255, 136, 0, 255]);
    assert.deepEqual(pixel(render('<rect width="100" height="100" fill="rgb(10, 20, 30)"/>'), 50, 50), [10, 20, 30, 255]);
    assert.deepEqual(pixel(render('<rect width="100" height="100"/>'), 50, 50), BLACK);
    assert.deepEqual(pixel(render('<rect width="100" height="100" fill="none"/>'), 50, 50), TRANSPARENT);
  });

  it('inherits paint from groups, and the style attribute wins over presentation attributes', () => {
    assert.deepEqual(pixel(render('<g fill="#00ff00"><rect width="100" height="100"/></g>'), 50, 50), GREEN);
    assert.deepEqual(pixel(render('<rect width="100" height="100" fill="#ff0000" style="fill: #0000ff"/>'), 50, 50), BLUE);
  });

  it('multiplies opacity and fill-opacity into the alpha', () => {
    const image = render('<g opacity="0.5"><rect width="100" height="100" fill-opacity="0.5"/></g>');

    assertClose(pixel(image, 50, 50)[3], 64, 1);
  });
});

describe('rasterize: transforms and hidden content', () => {
  it('composes transforms down the tree', () => {
    const image = render('<g transform="translate(50 0)"><rect width="10" height="10" transform="scale(2)"/></g>');

    assert.deepEqual(pixel(image, 60, 10), BLACK);
    assert.deepEqual(pixel(image, 40, 10), TRANSPARENT);
  });

  it('rotates about a centre', () => {
    const image = render('<rect width="50" height="100" transform="rotate(90 50 50)"/>');

    assert.deepEqual(pixel(image, 50, 25), BLACK);
    assert.deepEqual(pixel(image, 50, 75), TRANSPARENT);
  });

  it('draws nothing from defs, titles or display="none"', () => {
    const document = readSvgDocument(
      svg('<title>A</title><defs><rect width="100" height="100"/></defs><rect width="100" height="100" display="none"/>'),
    );

    assert.deepEqual(pixel(rasterize(document, 100), 50, 50), TRANSPARENT);
    assert.deepEqual(document.notDrawn, []);
  });

  it('lists what it does not draw, in order of appearance', () => {
    const document = readSvgDocument(
      svg(
        '<style>rect { fill: red }</style><path d="M0 0 L10 10" stroke="#000"/><rect width="10" height="10" fill="url(#gradient)"/>' +
          '<g mask="url(#m)"><text>Hi</text></g><use href="#a"/>',
      ),
    );

    assert.deepEqual(document.notDrawn, ['<style> block', 'stroke', 'gradient or pattern fill', 'mask', '<text>', '<use>']);
  });

  it('cannot read an SVG without a viewBox or a size', () => {
    assert.throws(() => readSvgDocument('<svg><rect width="10" height="10"/></svg>'), /viewBox/);
  });

  it('renders the cat: cream background, dark eye', () => {
    const cat = readFileSync(new URL('../skills/rob-janoff-design/examples/cat/after.svg', import.meta.url), 'utf8');
    const image = rasterize(readSvgDocument(cat), 256);

    assert.deepEqual(pixel(image, 1, 1), [242, 240, 234, 255]);
    // The left eye's centre (386.7, 601.8) in the 700-unit frame that starts at (150, 190).
    assert.deepEqual(pixel(image, 86, 150), [10, 10, 10, 255]);
  });
});

describe('enlarge and contactSheet', () => {
  it('enlarges with nearest-neighbour pixels', () => {
    const big = enlarge(image(2, 1, [...RED, ...BLUE]), 8);

    assert.deepEqual([big.width, big.height], [16, 8]);
    assert.deepEqual([pixel(big, 7, 7), pixel(big, 8, 0)], [RED, BLUE]);
  });

  it('lays the renders side by side on mid-grey, with 16 px gutters', () => {
    const sheet = contactSheet([image(2, 2, [...RED, ...RED, ...RED, ...RED]), image(1, 1, TRANSPARENT)]);

    assert.deepEqual([sheet.width, sheet.height], [16 + 2 + 16 + 1 + 16, 16 + 2 + 16]);
    assert.deepEqual(pixel(sheet, 0, 0), MID_GREY);
    assert.deepEqual(pixel(sheet, 16, 16), RED);
    assert.deepEqual(pixel(sheet, 34, 16), MID_GREY, 'transparent pixels show the grey');
  });
});

function render(body: string): Image {
  return rasterize(readSvgDocument(svg(body)), 100);
}

function svg(body: string, viewBox = '0 0 100 100'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}

function image(width: number, height: number, rgba: number[]): Image {
  return { width, height, pixels: new Uint8ClampedArray(rgba) };
}

function pixel({ width, pixels }: Image, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return [...pixels.subarray(offset, offset + 4)];
}
