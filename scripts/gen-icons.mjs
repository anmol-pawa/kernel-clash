// Generates the app icons (public/icon-*.png, app/icon.png, app/apple-icon.png)
// from an in-repo pixel grid: a CPU chip with "KC" on its die. Run with
// `npm run icons` after editing the grid; the PNGs are committed.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PAL = {
  ".": [0x10, 0x0e, 0x24], // background
  o: [0x05, 0x04, 0x10], // outline
  p: [0x9a, 0x86, 0x5c], // pin
  P: [0xe8, 0xd0, 0x8a], // pin highlight
  c: [0x2a, 0x2f, 0x5c], // chip body dark
  C: [0x3f, 0x48, 0x8c], // chip body
  h: [0x60, 0x6c, 0xc8], // chip highlight
  d: [0x0d, 0x3b, 0x34], // die dark
  D: [0x15, 0x6b, 0x5c], // die
  k: [0x5e, 0xea, 0xd4], // letter
  K: [0xd6, 0xff, 0xf6], // letter highlight
};

// 32×32, drawn procedurally so the chip stays symmetric. Content stays inside
// the maskable-icon safe zone (centre ~80%).
const K = ["k...k", "k..kK", "k.kK.", "kkK..", "k.kK.", "k..kK", "k...k"];
const C = [".kkk", "kK..", "k...", "k...", "k...", "kK..", ".kkk"];
function drawGrid() {
  const g = Array.from({ length: 32 }, () => Array(32).fill("."));
  const set = (x, y, c) => (g[y][x] = c);
  // pins on all four sides
  for (let i = 10; i <= 21; i += 2) {
    for (let d = 5; d <= 7; d++) {
      const tip = d === 5 ? "P" : "p";
      set(i, d, tip); // top
      set(i, 31 - d, "p"); // bottom (in shadow)
      set(d, i, tip); // left
      set(31 - d, i, "p"); // right
    }
  }
  // chip body 8..23
  for (let y = 8; y <= 23; y++)
    for (let x = 8; x <= 23; x++) {
      const edge = x === 8 || x === 23 || y === 8 || y === 23;
      let c = "C";
      if (x === 9 || y === 9) c = "h";
      if (x === 22 || y === 22) c = "c";
      set(x, y, edge ? "o" : c);
    }
  // die 11..20 with an outline ring at 10/21
  for (let y = 10; y <= 21; y++)
    for (let x = 10; x <= 21; x++) {
      const edge = x === 10 || x === 21 || y === 10 || y === 21;
      set(x, y, edge ? "o" : x === 20 || y === 20 ? "d" : "D");
    }
  const blit = (glyph, ox, oy) => glyph.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && set(ox + x, oy + y, ch)));
  blit(K, 11, 12);
  blit(C, 17, 12);
  // corner notch (pin-1 marker)
  set(11, 19, "K");
  return g.map((r) => r.join(""));
}
const GRID = drawGrid();

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(grid, size) {
  const n = grid.length;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const ch = grid[Math.floor((y * n) / size)][Math.floor((x * n) / size)] ?? ".";
      const [r, g, b] = PAL[ch];
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const grid = GRID;
for (const [file, size] of [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["app/icon.png", 64],
  ["app/apple-icon.png", 192],
]) {
  writeFileSync(file, png(grid, size));
  console.log(file, size);
}
