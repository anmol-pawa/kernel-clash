import { PixelCanvas, type SpriteSheet } from "@/lib/pixel";

/** Grass platform that creatures stand on (title screen and battles). */
function platform(): string[] {
  const k = new PixelCanvas(72, 18);
  k.ellipse(36, 9, 35, 8, ["d", "m", "l", "L"], [-0.2, -1]);
  // tufts along the rim
  for (let x = 6; x < 66; x += 7) k.stamp(["l.l", ".L."], x, 2 + Math.round(Math.abs(36 - x) / 9));
  k.outline("o");
  return k.toGrid();
}

export const PLATFORM: SpriteSheet = {
  name: "Grass platform",
  palette: { o: "#1c2a1a", d: "#2f5a2c", m: "#4b8a3a", l: "#7cc24f", L: "#b8e57a" },
  idle: [platform()],
};

/** Distant "kernel city" skyline: server towers with lit windows. Seeded, so it's stable. */
function skyline(): string[] {
  const W = 160;
  const H = 44;
  const k = new PixelCanvas(W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // far layer of hills
  for (let x = 0; x < W; x++) {
    const h = 10 + Math.round(4 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3));
    for (let y = H - h; y < H; y++) k.px(x, y, "f");
  }
  // towers
  let x = 1;
  while (x < W - 4) {
    const w = 6 + Math.floor(rnd() * 8);
    const h = 14 + Math.floor(rnd() * 24);
    k.rect(x, H - h, w, h, "t");
    k.rect(x, H - h, 1, h, "T"); // lit edge
    for (let wy = H - h + 3; wy < H - 3; wy += 3)
      for (let wx = x + 2; wx < x + w - 1; wx += 2) if (rnd() < 0.45) k.px(wx, wy, rnd() < 0.3 ? "w" : "W");
    if (rnd() < 0.5) k.rect(x + (w >> 1), H - h - 4, 1, 4, "T"); // antenna
    x += w + 1 + Math.floor(rnd() * 4);
  }
  return k.toGrid();
}

export const SKYLINE: SpriteSheet = {
  name: "Kernel city skyline",
  palette: { f: "#2a2156", t: "#1d1640", T: "#3a2f78", w: "#ffe27a", W: "#5eead4" },
  idle: [skyline()],
};

/* ----------------------------------------------------------- Fork Grove */

/** A deterministic PRNG so every grove grows the same way. */
function lcg(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

type Leaf = [x: number, y: number, r: number];

/**
 * A tree that forks into two at every joint, like a process tree: each branch
 * is a shaded tube, and the tips are collected so canopies can go on last.
 */
function forkTree(k: PixelCanvas, x: number, y: number, len: number, ang: number, r: number, depth: number, rnd: () => number, bark: string[], tips: Leaf[]) {
  const x2 = x + Math.sin(ang) * len;
  const y2 = y - Math.cos(ang) * len;
  const bend = (rnd() - 0.5) * len * 0.25;
  k.tube([x, y], [(x + x2) / 2 + bend, (y + y2) / 2], [x2, y2], Math.max(0.8, r), Math.max(0.8, r * 0.72), bark);
  if (depth === 0) return void tips.push([x2, y2, 3 + r * 2.2]);
  const spread = 0.36 + rnd() * 0.18;
  for (const s of [-1, 1]) forkTree(k, x2, y2, len * (0.66 + rnd() * 0.12), ang + s * spread, r * 0.68, depth - 1, rnd, bark, tips);
}

/** A leafy canopy clump: a few lit blobs with bright fringes and the odd glowing bud. */
function canopy(k: PixelCanvas, [x, y, r]: Leaf, rnd: () => number, leaf: string[], bud: string) {
  k.ellipse(x, y + 1, r * 1.25, r * 0.85, leaf);
  for (let i = 0; i < 3; i++) k.ellipse(x + (rnd() - 0.5) * r * 1.6, y - rnd() * r * 0.6, r * 0.7, r * 0.55, leaf);
  if (rnd() < 0.55) k.px(x + (rnd() - 0.5) * r, y + (rnd() - 0.2) * r * 0.6, bud);
}

/** Fork Grove's tree line: a misty far wood behind outlined forked trees and undergrowth. */
function groveTrees(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(23);
  // far wood: flat, misty canopy bumps and a few bare forked trunks
  for (let x = 0; x < W; x++) {
    const h = 30 + Math.round(6 * Math.sin(x / 9.5) + 4 * Math.sin(x / 3.7 + 1) + 3 * Math.sin(x / 21));
    for (let y = H - h; y < H; y++) k.px(x, y, y < H - h + 2 ? "F" : "f");
  }
  for (const fx of [14, 47, 92, 131]) {
    const far = new PixelCanvas(W, H);
    const tips: Leaf[] = [];
    forkTree(far, fx, H, 16, 0, 1.6, 3, rnd, ["f", "f"], tips);
    for (const t of tips) far.ellipse(t[0], t[1], 4, 3, ["f", "F"]);
    k.stamp(far.toGrid(), 0, 0);
  }
  // near trees, drawn back to front, each on its own layer so it gets an outline
  const trees: [x: number, len: number, r: number, depth: number, ang: number][] = [
    [30, 19, 3.2, 3, -0.06],
    [126, 21, 3.4, 3, 0.05],
    [76, 13, 2.2, 3, 0.02],
    [4, 15, 2.6, 2, 0.12],
    [158, 15, 2.6, 2, -0.12],
  ];
  for (const [tx, len, r, depth, ang] of trees) {
    const t = new PixelCanvas(W, H);
    const tips: Leaf[] = [];
    forkTree(t, tx, H + 2, len, ang, r, depth, rnd, ["b", "B", "c"], tips);
    for (const tip of tips) canopy(t, tip, rnd, ["g", "G", "h", "H"], "t");
    t.outline("o");
    k.stamp(t.toGrid(), 0, 0);
  }
  // undergrowth along the foot of the trees
  const bush = new PixelCanvas(W, H);
  for (let x = -4; x < W + 6; x += 7 + Math.floor(rnd() * 5)) bush.ellipse(x, H - 2, 5 + rnd() * 4, 3.5 + rnd() * 2.5, ["g", "G", "h"]);
  bush.outline("o");
  k.stamp(bush.toGrid(), 0, 0);
  return k.toGrid();
}

const GROVE_PALETTE = {
  o: "#0d1f17",
  f: "#1f4a3f",
  F: "#2b5c4c",
  b: "#3b2a22",
  B: "#5e4433",
  c: "#8a6a4b",
  g: "#1f4d2c",
  G: "#2f6e37",
  h: "#4f9a45",
  H: "#8fcf62",
  t: "#5eead4",
};

export const GROVE_TREES: SpriteSheet = { name: "Fork Grove tree line", palette: GROVE_PALETTE, idle: [groveTrees()] };

/** Gnarled roots that fork as they creep over the grove floor. */
function groveRoots(): string[] {
  const k = new PixelCanvas(64, 14);
  const ramp = ["b", "B", "c"];
  k.tube([2, 4], [20, 2], [34, 7], 2.6, 1.8, ramp);
  k.tube([34, 7], [44, 10], [60, 9], 1.8, 0.9, ramp);
  k.tube([34, 7], [40, 4], [52, 3], 1.4, 0.8, ramp);
  k.tube([16, 4], [18, 9], [12, 12], 1.4, 0.8, ramp);
  k.tube([44, 9], [47, 12], [53, 12], 1, 0.8, ramp);
  // moss on the upper sides
  for (const [x, y] of [[8, 1], [9, 1], [10, 1], [24, 3], [25, 3], [30, 5], [41, 2]] as const) k.px(x, y, "m");
  k.outline("o");
  return k.toGrid();
}

export const GROVE_ROOTS: SpriteSheet = {
  name: "Grove roots",
  palette: { o: "#0d1f17", b: "#3b2a22", B: "#5e4433", c: "#8a6a4b", m: "#6fae4c" },
  idle: [groveRoots()],
};

/** A clump of glowing teal-capped mushrooms. */
function groveShrooms(): string[] {
  const k = new PixelCanvas(20, 15);
  for (const [x, top, h, r] of [[6, 6, 8, 4], [13, 3, 11, 4.5], [17, 9, 5, 2.5]] as const) {
    k.rect(x - 1, top + 1, 2, h, "s");
    k.px(x, top + 2, "S");
    k.px(x, top + 3, "S");
    k.ellipse(x, top + 1, r, r * 0.6, ["c", "C", "L"]);
    k.px(x - 1, top, "W");
    k.px(x + Math.round(r / 2), top + 1, "W");
  }
  k.rect(2, 14, 17, 1, "g");
  k.outline("o");
  return k.toGrid();
}

export const GROVE_SHROOMS: SpriteSheet = {
  name: "Grove mushrooms",
  palette: { o: "#0d1f17", s: "#bfae8e", S: "#e8dcc0", c: "#14786c", C: "#2bb7a0", L: "#5eead4", W: "#e6fffb", g: "#2f6e37" },
  idle: [groveShrooms()],
};

/** A leafy grove bush with a forked twig poking out and a couple of glowing buds. */
function groveBush(): string[] {
  const k = new PixelCanvas(30, 18);
  k.line(20, 10, 24, 3, "B");
  k.line(24, 3, 23, 0, "B");
  k.line(24, 3, 27, 1, "B");
  const leaf = ["g", "G", "h", "H"];
  k.ellipse(9, 12, 8, 5.5, leaf);
  k.ellipse(20, 12, 8.5, 5.5, leaf);
  k.ellipse(14, 8, 7, 5.5, leaf);
  k.rect(3, 16, 25, 2, "g");
  k.px(9, 11, "t");
  k.px(18, 7, "t");
  k.outline("o");
  return k.toGrid();
}

export const GROVE_BUSH: SpriteSheet = {
  name: "Grove bush",
  palette: { o: "#0d1f17", B: "#5e4433", g: "#1f4d2c", G: "#2f6e37", h: "#4f9a45", H: "#8fcf62", t: "#5eead4" },
  idle: [groveBush()],
};

/** A tuft of grove grass with a couple of fallen leaves. */
export const GROVE_TUFT: SpriteSheet = {
  name: "Grove tuft",
  palette: { o: "#0d1f17", g: "#2f6e37", h: "#6fae4c", y: "#c9a24a", Y: "#8a6a2b" },
  idle: [
    [
      "...o....o....",
      "..oho..oho...",
      ".ohgo.ohgo.o.",
      ".ohgoohgoohoo",
      "oyYohgggohgo.",
      ".oyoggggggo..",
      "..ooooooooo..",
    ],
  ],
};

/** A mossy earth mound ringed by roots, the Fork Grove version of the grass platform. */
function rootPlatform(): string[] {
  const k = new PixelCanvas(72, 20);
  k.ellipse(36, 11, 35, 8, ["e", "E", "B"], [-0.2, -1]);
  k.ellipse(36, 8, 33, 6, ["d", "m", "l", "L"], [-0.2, -1]);
  // roots curling down over the rim
  for (const [x, dx] of [[9, -2], [22, -1], [47, 1], [60, 2]] as const) {
    k.tube([x, 10], [x + dx, 14], [x + dx * 2, 18], 1.4, 0.8, ["b", "B", "c"]);
  }
  for (let x = 6; x < 66; x += 7) k.stamp(["l.l", ".L."], x, 1 + Math.round(Math.abs(36 - x) / 9));
  k.outline("o");
  return k.toGrid();
}

export const ROOT_PLATFORM: SpriteSheet = {
  name: "Mossy root platform",
  palette: { o: "#0d1f17", e: "#2a1d16", E: "#433024", b: "#3b2a22", B: "#5e4433", c: "#8a6a4b", d: "#24502c", m: "#3d7f3a", l: "#6fae4c", L: "#a8dc78" },
  idle: [rootPlatform()],
};

/* ------------------------------------------------------------ Backdrops */

/** A prop on the battle ground, placed in stage coordinates by its bottom centre. */
export interface Prop {
  sheet: SpriteSheet;
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
}

/** Everything the battle stage needs to paint one area's scene. */
export interface Backdrop {
  name: string;
  /** Sky bands, top to horizon. */
  sky: number[];
  /** Stars in the sky, or fireflies drifting over the ground. */
  specks: { count: number; color: number; kind: "stars" | "fireflies" };
  /** Tiled along the horizon every 480 stage pixels at 3×. */
  horizon: SpriteSheet;
  ground: { base: number; stripe: number; edge: number };
  platform: SpriteSheet;
  props: Prop[];
}

export const KERNEL_CITY: Backdrop = {
  name: "Kernel city",
  sky: [0x1b1446, 0x251a5c, 0x33226e, 0x4a2c7e, 0x6b3a86, 0x94508a, 0xc46f86],
  specks: { count: 60, color: 0xffffff, kind: "stars" },
  horizon: SKYLINE,
  ground: { base: 0x2a5a3a, stripe: 0x336b44, edge: 0x1d3f2a },
  platform: PLATFORM,
  props: [],
};

export const FORK_GROVE: Backdrop = {
  name: "Fork Grove",
  sky: [0x0f2a33, 0x143a3e, 0x1a4a46, 0x245c4c, 0x356f52, 0x56865a, 0x8aa866],
  specks: { count: 26, color: 0xd9ff8a, kind: "fireflies" },
  horizon: GROVE_TREES,
  ground: { base: 0x24452c, stripe: 0x2c5234, edge: 0x13291b },
  platform: ROOT_PLATFORM,
  props: [
    { sheet: GROVE_ROOTS, x: 120, y: 262, scale: 3 },
    { sheet: GROVE_ROOTS, x: 470, y: 256, scale: 3, flip: true },
    { sheet: GROVE_ROOTS, x: 930, y: 266, scale: 3 },
    { sheet: GROVE_BUSH, x: 40, y: 380, scale: 3 },
    { sheet: GROVE_BUSH, x: 930, y: 440, scale: 3, flip: true },
    { sheet: GROVE_BUSH, x: 520, y: 300, scale: 2, flip: true },
    { sheet: GROVE_SHROOMS, x: 480, y: 470, scale: 3 },
    { sheet: GROVE_SHROOMS, x: 860, y: 330, scale: 2, flip: true },
    { sheet: GROVE_SHROOMS, x: -120, y: 420, scale: 3 },
    { sheet: GROVE_BUSH, x: 1090, y: 360, scale: 3 },
    ...([
      [30, 280], [320, 300], [400, 360], [560, 420], [620, 350], [780, 380], [890, 290], [60, 470], [420, 530], [700, 500], [840, 520], [990, 400], [-60, 300], [1060, 500],
    ] as const).map(([x, y], i) => ({ sheet: GROVE_TUFT, x, y, scale: y < 330 ? 2 : 3, flip: i % 2 === 1 })),
  ],
};

/**
 * The battle backdrop for each gym, keyed by gym id. Gyms whose own scene
 * hasn't been drawn yet battle in kernel city.
 */
export const BACKDROPS: Record<string, Backdrop> = {
  basics: KERNEL_CITY,
  processes: FORK_GROVE,
  scheduling: KERNEL_CITY,
  sync: KERNEL_CITY,
  deadlocks: KERNEL_CITY,
  memory: KERNEL_CITY,
  virtual: KERNEL_CITY,
  storage: KERNEL_CITY,
  interview: KERNEL_CITY,
};

/** The backdrop for a gym id; wild and review battles (no gym) use kernel city. */
export const backdropFor = (gym?: string): Backdrop => (gym && BACKDROPS[gym]) || KERNEL_CITY;
