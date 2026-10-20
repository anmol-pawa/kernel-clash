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

/* ------------------------------------------------------------ Clocktower */

/** 4×4 ordered dither threshold in −0.5..0.5, so shade ramps blend like the creature art. */
const dither = (x: number, y: number) => ([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;

/**
 * A cog seen at an angle (`ry` < `rx` squashes it into perspective): a lit
 * disc with square teeth round the rim and a dark axle hole. `ramp` runs dark → light.
 */
function cog(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, teeth: number, ramp: string[], hole?: string, windows?: string) {
  const td = Math.max(0.14, 2 / rx); // tooth depth, as a fraction of the radius
  for (let y = Math.floor(cy - ry * (1 + td)); y <= Math.ceil(cy + ry * (1 + td)); y++)
    for (let x = Math.floor(cx - rx * (1 + td)); x <= Math.ceil(cx + rx * (1 + td)); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      const onTooth = Math.cos(teeth * Math.atan2(dy * rx, dx * ry)) > 0;
      if (d > (onTooth ? 1 + td : 1)) continue;
      if (hole && d < 0.16) {
        k.px(x, y, hole);
        continue;
      }
      // four windows cut between the hub and the rim, so it reads as a wheel
      const spoke = Math.abs(((Math.atan2(dy, dx) / (Math.PI / 2)) % 1 + 1) % 1 - 0.5);
      if (windows && d > 0.3 && d < 0.6 && spoke < 0.28) {
        k.px(x, y, windows);
        continue;
      }
      // a recessed groove inside the rim and a raised hub, lit from the top left
      if (d > 0.6 && d < 0.72) {
        k.px(x, y, ramp[dx + dy < 0 ? 0 : Math.min(1, ramp.length - 1)]);
        continue;
      }
      const l = 0.5 - dx * 0.3 - dy * 0.4 + (d < 0.34 ? 0.15 : 0) + (d > 1 ? -0.12 : 0);
      const i = Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length + dither(x, y) * 0.3)));
      k.px(x, y, ramp[i]);
    }
}

/** A clock face: cream dial, brass rim, twelve hour marks and two hands at `h`:`m`. */
function clockFace(k: PixelCanvas, cx: number, cy: number, r: number, h: number, m: number) {
  k.ellipse(cx, cy, r + 1.5, r + 1.5, ["B", "m", "l"]);
  k.ellipse(cx, cy, r, r, ["c", "C", "W"], [-0.3, -0.5]);
  if (r >= 4)
    for (let i = 0; i < 12; i++) {
      if (r < 6 && i % 3) continue;
      const a = (i / 12) * Math.PI * 2;
      k.px(cx + Math.sin(a) * (r - 0.8), cy - Math.cos(a) * (r - 0.8), "n");
    }
  const hand = (a: number, len: number) => k.line(Math.round(cx), Math.round(cy), Math.round(cx + Math.sin(a) * len), Math.round(cy - Math.cos(a) * len), "n");
  hand(((h % 12) / 12 + m / 720) * Math.PI * 2, r * 0.5);
  hand((m / 60) * Math.PI * 2, r * 0.8);
  k.px(cx, cy, "a");
}

/**
 * A stone tower: a lit left face, a shadowed right face, a band of lit
 * windows, a clock high up and a pointed copper roof with a finial.
 */
function tower(k: PixelCanvas, x: number, w: number, top: number, H: number, clock: [r: number, h: number, m: number] | null, roof: number, rnd: () => number) {
  const half = w >> 1;
  k.rect(x, top, w, H - top, "s");
  k.rect(x, top, 1, H - top, "S");
  k.rect(x + w - Math.max(2, w >> 2), top, Math.max(2, w >> 2), H - top, "d");
  // cornice ledges
  for (const ly of [top, top + Math.round((H - top) * 0.45)]) {
    k.rect(x - 1, ly, w + 2, 1, "S");
    k.rect(x - 1, ly + 1, w + 2, 1, "d");
  }
  // windows: arched slits, mostly lit at dusk
  for (let wy = top + Math.round((H - top) * 0.5); wy < H - 4; wy += 5)
    for (let wx = x + 2; wx < x + w - 2; wx += 3)
      if (rnd() < 0.6) {
        const lit = rnd() < 0.75;
        k.rect(wx, wy, 1, 2, lit ? "w" : "d");
        if (lit && rnd() < 0.4) k.px(wx, wy - 1, "W");
      }
  if (clock) clockFace(k, x + half - (w % 2 ? 0 : 0.5), top + clock[0] + 3, clock[0], clock[1], clock[2]);
  // pointed copper roof: a lit and a weathered side, then the finial
  for (let i = 0; i < roof; i++) {
    const hw = Math.round(((half + 1) * (roof - i)) / roof);
    const cxr = x + half - (w % 2 ? 0 : 0.5);
    for (let rx = -hw; rx <= hw; rx++) k.px(cxr + rx, top - 1 - i, rx < 0 ? (i % 3 === 2 ? "P" : "p") : rx === 0 ? "q" : "v");
  }
  k.rect(x + half - (w % 2 ? 0 : 1), top - roof - 3, 1, 3, "l");
  k.px(x + half - (w % 2 ? 0 : 1), top - roof - 4, "L");
}

/** The Clocktower's horizon: a city of gabled roofs and spires, a great clock tower and cogs turning between them. */
function clockSkyline(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(41);
  // far gabled rooftops, in haze
  for (let x = 0; x < W; ) {
    const w = 7 + Math.floor(rnd() * 7);
    const h = 14 + Math.floor(rnd() * 10);
    for (let i = 0; i < w; i++) {
      const peak = Math.round(Math.min(i, w - 1 - i) * 0.9);
      for (let y = H - h - peak; y < H; y++) k.px(x + i, y, y === H - h - peak ? "F" : "f");
    }
    x += w - 1;
  }
  // a big half-buried cog turning behind the roofs, and a smaller one meshing with it
  const back = new PixelCanvas(W, H);
  cog(back, 106, H - 18, 17, 17, 12, ["g", "G", "G"], "o");
  cog(back, 128, H - 35, 8, 8, 8, ["g", "G", "G"], "o");
  cog(back, 18, H - 22, 10, 10, 9, ["g", "G", "G"], "o");
  back.outline("g");
  k.stamp(back.toGrid(), 0, 0);
  // the near towers, each on its own layer so it gets an outline
  const towers: [x: number, w: number, top: number, clock: [number, number, number] | null, roof: number][] = [
    [6, 9, 40, [3, 3, 0], 7],
    [140, 10, 36, [3, 9, 15], 8],
    [118, 7, 50, null, 6],
    [30, 7, 46, null, 6],
    [64, 21, 18, [7, 10, 10], 12],
    [92, 11, 32, [4, 4, 45], 8],
  ];
  for (const [tx, w, top, clock, roof] of towers) {
    const t = new PixelCanvas(W, H);
    tower(t, tx, w, top, H, clock, roof, rnd);
    t.outline("o");
    k.stamp(t.toGrid(), 0, 0);
  }
  // the great tower's balcony and its bell arch, between the clock and the roof line
  const g = new PixelCanvas(W, H);
  g.rect(62, 38, 25, 2, "S");
  for (let bx = 63; bx < 86; bx += 3) g.rect(bx, 40, 1, 3, "S");
  g.rect(62, 43, 25, 1, "d");
  g.outline("o");
  k.stamp(g.toGrid(), 0, 0);
  // low houses along the foot, so the towers stand in a town
  const houses = new PixelCanvas(W, H);
  for (let x = -3; x < W + 4; ) {
    const w = 8 + Math.floor(rnd() * 6);
    const h = 5 + Math.floor(rnd() * 5);
    houses.rect(x, H - h, w, h, "s");
    houses.rect(x + w - 2, H - h, 2, h, "d");
    for (let i = 0; i <= w >> 1; i++) houses.rect(x + i, H - h - i, w - i * 2, 1, i % 2 ? "p" : "P");
    if (rnd() < 0.7) houses.rect(x + 2 + Math.floor(rnd() * (w - 5)), H - h + 2, 2, 2, "w");
    x += w + Math.floor(rnd() * 3);
  }
  houses.outline("o");
  k.stamp(houses.toGrid(), 0, 0);
  return k.toGrid();
}

const CLOCK_PALETTE = {
  o: "#1b1426",
  f: "#4b3560",
  F: "#5d4270",
  g: "#3d2c52",
  G: "#523a63",
  s: "#6f6278",
  S: "#9a8a9c",
  d: "#4a3f55",
  p: "#3f8a7a",
  P: "#5fb39a",
  q: "#9be0c4",
  v: "#2a5c56",
  w: "#ffcf6b",
  W: "#fff2b8",
  B: "#6b4a1e",
  m: "#a8742a",
  l: "#d9a441",
  L: "#ffe08a",
  c: "#cbb592",
  C: "#efe0bd",
  n: "#2a1d2e",
  a: "#c23b3b",
};

export const CLOCK_SKYLINE: SpriteSheet = { name: "Clocktower skyline", palette: CLOCK_PALETTE, idle: [clockSkyline()] };

/** A great brass cog sunk edge-on into the plaza, its rim teeth catching the dusk. */
function plazaCog(): string[] {
  const k = new PixelCanvas(34, 18);
  cog(k, 17, 17, 14, 14, 10, ["B", "m", "l", "L"], "o", "o");
  for (let y = 15; y < 18; y++) for (let x = 0; x < 34; x++) if (k.get(x, y) !== ".") k.px(x, y, y === 15 ? "e" : "E");
  k.outline("o");
  return k.toGrid();
}

const BRASS = { o: "#1b1426", B: "#6b4a1e", m: "#a8742a", l: "#d9a441", L: "#ffe08a" };

export const PLAZA_COG: SpriteSheet = {
  name: "Plaza cog",
  palette: { ...BRASS, e: "#5a4f62", E: "#3e3548" },
  idle: [plazaCog()],
};

/** An hourglass on a brass stand, its sand running from the top bulb to the bottom. */
function hourglass(): string[] {
  const k = new PixelCanvas(14, 22);
  k.rect(1, 0, 12, 2, "m");
  k.rect(1, 0, 12, 1, "l");
  k.rect(1, 20, 12, 2, "m");
  k.rect(1, 20, 12, 1, "l");
  for (const px of [2, 11]) k.rect(px, 2, 1, 18, "B");
  // the glass: two bulbs meeting at a neck
  for (let y = 2; y < 20; y++) {
    const t = Math.abs(y - 10.5) / 8.5;
    const hw = Math.max(0.5, 3.6 * Math.sin(t * Math.PI * 0.62) + 0.4);
    for (let x = Math.round(7 - hw); x < Math.round(7 + hw); x++) {
      const sand = (y >= 7 && y < 10) || y >= 16 || (y >= 13 && Math.abs(x + 0.5 - 7) < (y - 12) * 1.2);
      k.px(x, y, sand ? (x < 7 ? "y" : "Y") : x === Math.round(7 - hw) ? "G" : "g");
    }
  }
  k.px(7, 11, "y");
  k.px(7, 12, "Y");
  k.outline("o");
  return k.toGrid();
}

export const HOURGLASS: SpriteSheet = {
  name: "Hourglass",
  palette: { ...BRASS, g: "#9fc6d6", G: "#e3f4fa", y: "#f2cf7a", Y: "#c9973e" },
  idle: [hourglass()],
};

/** A wrought-iron lamp post topped with a little lit clock, the plaza's street light. */
function clockLamp(): string[] {
  const k = new PixelCanvas(13, 40);
  k.rect(5, 12, 3, 26, "i");
  k.rect(5, 12, 1, 26, "I");
  k.rect(3, 36, 7, 4, "i");
  k.rect(3, 36, 7, 1, "I");
  k.rect(4, 22, 5, 1, "I");
  // the lamp housing with its glow, under the clock
  k.rect(3, 10, 7, 2, "i");
  k.rect(4, 8, 5, 2, "w");
  k.px(5, 8, "W");
  k.ellipse(6.5, 4.5, 4.5, 4.5, ["B", "m", "l"]);
  k.ellipse(6.5, 4.5, 3.2, 3.2, ["c", "C"]);
  k.line(6, 4, 6, 2, "n");
  k.line(6, 4, 8, 4, "n");
  k.outline("o");
  return k.toGrid();
}

export const CLOCK_LAMP: SpriteSheet = {
  name: "Clock lamp post",
  palette: { ...BRASS, i: "#2e2838", I: "#5a5068", w: "#ffcf6b", W: "#fff2b8", c: "#cbb592", C: "#efe0bd", n: "#2a1d2e" },
  idle: [clockLamp()],
};

/** A few loose cobbles with a tuft of grass between them. */
export const COBBLES: SpriteSheet = {
  name: "Cobbles",
  palette: { o: "#1b1426", s: "#5a4f62", S: "#8a7d92", g: "#3f7a46", h: "#7cbf5a" },
  idle: [
    [
      "......o.......",
      "..oo.oho.ooo..",
      ".oSSoohgoSSso.",
      "oSSssohgoSsso.",
      "osssoogooosoo.",
      ".ooooSSsoo....",
      ".....osso.....",
      "......oo......",
    ],
  ],
};

/** A brass cog plinth set into stone, the Clocktower version of the grass platform: its face is a dial. */
function cogPlatform(): string[] {
  const k = new PixelCanvas(76, 24);
  const [cx, cy, rx, ry] = [38, 9, 29, 6];
  // stone drum underneath
  k.ellipse(cx, 15, 35, 8, ["e", "E", "s"], [-0.2, -1]);
  // the cog's brass edge, 3px thick, and square teeth stepping round the rim
  for (let t = 3; t >= 1; t--) k.ellipse(cx, cy + t, rx, ry, ["B", "B", "m"], [-0.6, 0.2]);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.09;
    const tx = Math.round(cx + Math.cos(a) * (rx + 1.5) - 1);
    const ty = Math.round(cy + Math.sin(a) * (ry + 1));
    k.rect(tx, ty, 3, 1, Math.cos(a) < 0.3 && Math.sin(a) < 0.5 ? "L" : "l");
    k.rect(tx, ty + 1, 3, 3, Math.cos(a) < 0 ? "m" : "B");
  }
  // the face: a lit brass ring, a groove, then a dial
  k.ellipse(cx, cy, rx, ry, ["m", "l", "l", "L"], [-0.4, -1]);
  k.ellipse(cx, cy, rx - 5, ry - 1.2, ["B", "B"]);
  k.ellipse(cx, cy + 0.3, rx - 6, ry - 1.6, ["m", "l"], [-0.4, -1]);
  k.ellipse(cx, cy + 0.3, rx - 9, ry - 2.3, ["c", "C"], [-0.1, -1]);
  // twelve hour marks round the dial, then the hub and two hands
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.px(cx + Math.sin(a) * (rx - 11), cy + 0.3 - Math.cos(a) * (ry - 3.2), i % 3 ? "c" : "n");
  }
  k.line(cx, cy, cx + 7, cy, "n");
  k.line(cx, cy, cx - 2, cy - 2, "n");
  k.rect(cx - 1, cy, 2, 1, "a");
  k.outline("o");
  return k.toGrid();
}

export const COG_PLATFORM: SpriteSheet = {
  name: "Cog dial platform",
  palette: { ...BRASS, e: "#2f2838", E: "#463d52", s: "#655a72", c: "#cbb592", C: "#efe0bd", n: "#2a1d2e", a: "#c23b3b" },
  idle: [cogPlatform()],
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

export const CLOCKTOWER: Backdrop = {
  name: "Clocktower",
  sky: [0x1a1840, 0x2a2052, 0x3d2a5e, 0x5a3466, 0x80406a, 0xb0566a, 0xe08a5e],
  specks: { count: 40, color: 0xffe9b0, kind: "stars" },
  horizon: CLOCK_SKYLINE,
  ground: { base: 0x4a4256, stripe: 0x544b60, edge: 0x2c2636 },
  platform: COG_PLATFORM,
  props: [
    { sheet: PLAZA_COG, x: 90, y: 262, scale: 3 },
    { sheet: PLAZA_COG, x: 940, y: 400, scale: 3, flip: true },
    { sheet: CLOCK_LAMP, x: 30, y: 400, scale: 3 },
    { sheet: CLOCK_LAMP, x: 520, y: 290, scale: 2, flip: true },
    { sheet: CLOCK_LAMP, x: 1060, y: 330, scale: 3 },
    { sheet: HOURGLASS, x: 480, y: 470, scale: 3 },
    { sheet: HOURGLASS, x: 880, y: 300, scale: 2 },
    ...([
      [300, 290], [400, 360], [570, 420], [640, 350], [790, 390], [60, 480], [450, 530], [720, 500], [860, 520], [990, 470], [-60, 320],
    ] as const).map(([x, y], i) => ({ sheet: COBBLES, x, y, scale: y < 330 ? 2 : 3, flip: i % 2 === 1 })),
  ],
};

/**
 * The battle backdrop for each gym, keyed by gym id. Gyms whose own scene
 * hasn't been drawn yet battle in kernel city.
 */
export const BACKDROPS: Record<string, Backdrop> = {
  basics: KERNEL_CITY,
  processes: FORK_GROVE,
  scheduling: CLOCKTOWER,
  sync: KERNEL_CITY,
  deadlocks: KERNEL_CITY,
  memory: KERNEL_CITY,
  virtual: KERNEL_CITY,
  storage: KERNEL_CITY,
  interview: KERNEL_CITY,
};

/** The backdrop for a gym id; wild and review battles (no gym) use kernel city. */
export const backdropFor = (gym?: string): Backdrop => (gym && BACKDROPS[gym]) || KERNEL_CITY;
