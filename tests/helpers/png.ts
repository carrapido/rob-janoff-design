// Reads back the PNGs render-png writes: 8-bit RGBA, unfiltered rows.
// Layout: https://www.w3.org/TR/png-3/
import assert from 'node:assert/strict';
import { crc32, inflateSync } from 'node:zlib';

export type DecodedPng = { width: number; height: number; bitDepth: number; colorType: number; pixels: Uint8Array };

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 4;

export function decodePng(file: Buffer): DecodedPng {
  assert.deepEqual(file.subarray(0, 8), SIGNATURE, 'PNG signature');
  const chunks = readChunks(file.subarray(8));
  const header = chunks.find((chunk) => chunk.type === 'IHDR');
  assert.ok(header, 'IHDR chunk');
  assert.equal(chunks.at(-1)?.type, 'IEND');

  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
  return { width, height, bitDepth: header.data[8], colorType: header.data[9], pixels: unfilter(inflateSync(compressed), width, height) };
}

function readChunks(bytes: Buffer): { type: string; data: Buffer }[] {
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    const typeAndData = bytes.subarray(offset + 4, offset + 8 + length);
    assert.equal(bytes.readUInt32BE(offset + 8 + length), crc32(typeAndData), 'chunk CRC');
    chunks.push({ type: typeAndData.subarray(0, 4).toString('latin1'), data: typeAndData.subarray(4) });
    offset += 12 + length;
  }
  return chunks;
}

// Every row starts with filter type 0 (None), so the bytes after it are the pixels.
function unfilter(rows: Buffer, width: number, height: number): Uint8Array {
  const stride = width * BYTES_PER_PIXEL;
  const pixels = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    assert.equal(rows[row * (stride + 1)], 0, `filter type of row ${row}`);
    pixels.set(rows.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)), row * stride);
  }
  return pixels;
}
