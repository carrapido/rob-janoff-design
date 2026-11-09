import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodePng } from '../skills/rob-janoff-design/scripts/lib/png.ts';
import { decodePng } from './helpers/png.ts';

describe('encodePng', () => {
  it('writes an 8-bit RGBA PNG that decodes to the same pixels', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 255]);
    const decoded = decodePng(encodePng({ width: 2, height: 2, pixels }));

    assert.deepEqual([decoded.width, decoded.height, decoded.bitDepth, decoded.colorType], [2, 2, 8, 6]);
    assert.deepEqual([...decoded.pixels], [...pixels]);
  });
});
