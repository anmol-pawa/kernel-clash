/**
 * Tiny pixel-art toolkit. Sprites are palette + character-grid strings: each
 * character is a palette key and "." is transparent. A PixelCanvas lets a
 * sprite be built from shaded shapes plus hand-placed details, then exported
 * as a grid, so the result is still a plain, reviewable character grid.
 */
export type Palette = Record<string, string>;
export type Grid = string[];

export interface SpriteSheet {
  name: string;
  palette: Palette;
  /** idle animation frames, all the same size */
  idle: Grid[];
  /** other named animations (attack, hurt…), same size as idle */
  anims?: Record<string, Grid[]>;
  /** frames per second per animation (default 4) */
  fps?: Record<string, number>;
}

/** Frames for an animation, falling back to idle. */
export function framesOf(s: SpriteSheet, anim: string): Grid[] {
  return anim === "idle" ? s.idle : (s.anims?.[anim] ?? s.idle);
}

/** "#rrggbb" → [r, g, b] */
export function hexRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGBA bytes for one frame. `white` paints every filled pixel white (hurt / evolve silhouettes). */
export function gridToRGBA(s: SpriteSheet, grid: Grid, white = false): Uint8ClampedArray {
  const w = grid[0].length;
  const out = new Uint8ClampedArray(w * grid.length * 4);
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const [r, g, b] = white ? [255, 255, 255] : hexRGB(s.palette[ch]);
      out.set([r, g, b, 255], (y * w + x) * 4);
    }),
  );
  return out;
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export class PixelCanvas {
  readonly g: string[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill("."));
  }

  get(x: number, y: number): string {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? "." : this.g[y][x];
  }

  px(x: number, y: number, c: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
  }

  /**
   * Filled ellipse shaded like a lit sphere. `ramp` runs dark → light; the
   * light comes from the top-left and ramp boundaries are ordered-dithered.
   */
  ellipse(cx: number, cy: number, rx: number, ry: number, ramp: string[], light: [number, number] = [-0.55, -0.75]) {
    const [lx, ly] = light;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const l = Math.max(0, dx * lx + dy * ly + nz * 0.55); // 0..~1.2
        const t = Math.min(0.999, l / 1.15) * ramp.length;
        const dither = (BAYER4[y & 3][x & 3] + 0.5) / 16 - 0.5;
        const i = Math.max(0, Math.min(ramp.length - 1, Math.floor(t + dither * 0.6)));
        this.px(x, y, ramp[i]);
      }
  }

  rect(x0: number, y0: number, w: number, h: number, c: string) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }

  /** Stamp a hand-drawn grid ("." stays transparent). */
  stamp(grid: Grid, ox: number, oy: number, flip = false) {
    grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== ".") this.px(flip ? ox + row.length - 1 - x : ox + x, oy + y, ch);
      }),
    );
  }

  /** Copy the left half onto the right half, mirrored. */
  mirror() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w >> 1; x++) this.g[y][this.w - 1 - x] = this.g[y][x];
  }

  /** Add a 1px outline in colour `c` around every filled pixel. */
  outline(c: string) {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.g[y][x] !== ".") continue;
        if ([this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)].some((n) => n !== "." && n !== c)) add.push([x, y]);
      }
    for (const [x, y] of add) this.g[y][x] = c;
  }

  toGrid(): Grid {
    return this.g.map((r) => r.join(""));
  }
}

/** Horizontal runs of one colour, for compact SVG/canvas rendering. */
export function runs(grid: Grid): { x: number; y: number; w: number; c: string }[] {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== ".") out.push({ x, y, w, c });
      x += w;
    }
  });
  return out;
}
