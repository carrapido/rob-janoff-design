// Renders an SVG logo to PNG at 256, 48 and 16 px, plus a sheet to look at before showing it.
// Exit codes: 0 everything was drawn, 1 the files were written but something was not drawn,
// 2 the SVG could not be read.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { EXIT_PASS, EXIT_PROBLEMS, readCommandLine, runCommand, UsageError } from './lib/cli.ts';
import { contactSheet, enlarge, type Image } from './lib/image.ts';
import { encodePng } from './lib/png.ts';
import { rasterize } from './lib/raster.ts';
import { readSvgDocument } from './lib/svg-document.ts';

type Request = { file: string; outDir: string };
type Render = { path: string; image: Image };

const USAGE = 'Usage: node render-png.ts <logo.svg> [--out <dir>]';
// The scale test of SKILL.md, from the largest size to the smallest.
const SIZES = [256, 48, 16];
// The 16 px render is enlarged ×8 on the sheet, so its real pixels can be seen.
const SMALLEST_ENLARGEMENT = 8;

runCommand(USAGE, () => main(process.argv.slice(2)));

function main(args: string[]): number {
  const { file, outDir } = parseRequest(args);
  const document = readSvgDocument(readFileSync(file, 'utf8'));
  const name = basename(file, extname(file));
  const renders = SIZES.map((size) => ({ path: join(outDir, `${name}-${size}.png`), image: rasterize(document, size) }));
  const sheet = { path: join(outDir, `${name}-sheet.png`), image: sheetOf(renders.map((render) => render.image)) };
  writeAll(outDir, [...renders, sheet]);
  console.log(formatReport(file, renders, sheet, document.notDrawn));
  return document.notDrawn.length > 0 ? EXIT_PROBLEMS : EXIT_PASS;
}

function parseRequest(args: string[]): Request {
  const { values, positionals } = readCommandLine(args, { out: { type: 'string' } });
  if (positionals.length !== 1) throw new UsageError('Give one SVG file.');
  return { file: positionals[0], outDir: values.out ?? dirname(positionals[0]) };
}

function sheetOf(images: Image[]): Image {
  const smallest = images[images.length - 1];
  return contactSheet([...images.slice(0, -1), enlarge(smallest, SMALLEST_ENLARGEMENT)]);
}

function writeAll(outDir: string, renders: Render[]): void {
  mkdirSync(outDir, { recursive: true });
  for (const { path, image } of renders) writeFileSync(path, encodePng(image));
}

function formatReport(file: string, renders: Render[], sheet: Render, notDrawn: string[]): string {
  return [
    `render-png ${file}`,
    ...renders.map(({ path, image }) => `  wrote ${path} (${image.width} × ${image.height})`),
    `  look at ${sheet.path}: ${SIZES.slice(0, -1).join(' px and ')} px at real size, ${SIZES.at(-1)} px enlarged ×${SMALLEST_ENLARGEMENT}`,
    '',
    conclusion(notDrawn),
  ].join('\n');
}

function conclusion(notDrawn: string[]): string {
  if (notDrawn.length === 0) return 'PASS: everything was drawn';
  return `NOT DRAWN: ${notDrawn.join(', ')}. The PNGs leave them out; check them in a browser.`;
}
