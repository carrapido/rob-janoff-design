// RGBA images with straight alpha, and the sheet the agent looks at.

export type Image = { width: number; height: number; pixels: Uint8ClampedArray };

export const CHANNELS = 4;
const GUTTER = 16;
// Mid-grey sets apart a white logo, a black one and transparency.
const SHEET_GREY = 128;

// Each pixel becomes a factor × factor block, so a 16 px render shows its real pixels.
export function enlarge(image: Image, factor: number): Image {
  const width = image.width * factor;
  const height = image.height * factor;
  const pixels = new Uint8ClampedArray(width * height * CHANNELS);
  for (let index = 0; index < width * height; index += 1) {
    const sourceX = Math.floor((index % width) / factor);
    const sourceY = Math.floor(Math.floor(index / width) / factor);
    const source = (sourceY * image.width + sourceX) * CHANNELS;
    pixels.set(image.pixels.subarray(source, source + CHANNELS), index * CHANNELS);
  }
  return { width, height, pixels };
}

// The images side by side, top-aligned, with a gutter around each.
export function contactSheet(images: Image[]): Image {
  const width = GUTTER + images.reduce((sum, image) => sum + image.width + GUTTER, 0);
  const height = 2 * GUTTER + Math.max(...images.map((image) => image.height));
  const opaqueGrey = Uint8ClampedArray.from({ length: width * height * CHANNELS }, (_, offset) =>
    offset % CHANNELS === 3 ? 255 : SHEET_GREY,
  );
  const sheet: Image = { width, height, pixels: opaqueGrey };
  let left = GUTTER;
  for (const image of images) {
    drawOver(sheet, image, left, GUTTER);
    left += image.width + GUTTER;
  }
  return sheet;
}

// Source-over onto an opaque sheet: out = source · alpha + sheet · (1 − alpha).
function drawOver(sheet: Image, image: Image, left: number, top: number): void {
  for (let index = 0; index < image.width * image.height; index += 1) {
    const source = index * CHANNELS;
    const target = ((top + Math.floor(index / image.width)) * sheet.width + left + (index % image.width)) * CHANNELS;
    const alpha = image.pixels[source + 3] / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      sheet.pixels[target + channel] = image.pixels[source + channel] * alpha + sheet.pixels[target + channel] * (1 - alpha);
    }
    sheet.pixels[target + 3] = 255;
  }
}
