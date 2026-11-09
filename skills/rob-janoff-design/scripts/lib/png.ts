// Encodes an image as an 8-bit RGBA PNG with Node's own zlib.
// Layout: https://www.w3.org/TR/png-3/ · zlib: https://nodejs.org/docs/latest-v24.x/api/zlib.html
import { crc32, deflateSync } from 'node:zlib';
import { CHANNELS, type Image } from './image.ts';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BIT_DEPTH = 8;
const COLOR_TYPE_RGBA = 6;
const FILTER_NONE = 0;

export function encodePng(image: Image): Buffer {
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header(image)),
    chunk('IDAT', deflateSync(filteredRows(image))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Compression, filter method and interlace stay 0: deflate, adaptive filtering, no interlace.
function header({ width, height }: Image): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = BIT_DEPTH;
  data[9] = COLOR_TYPE_RGBA;
  return data;
}

// Every row starts with its filter type; None keeps the pixels as they are.
function filteredRows({ width, height, pixels }: Image): Buffer {
  const stride = width * CHANNELS;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    rows[row * (stride + 1)] = FILTER_NONE;
    rows.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }
  return rows;
}

// Length, type, data, and a CRC over type and data.
function chunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}
