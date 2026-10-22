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

/* ----------------------------------------------------------- Mutex Marsh */

/** A railway semaphore signal: a striped arm on a post, with a lamp at the arm's tip. `down` swings the arm to "go" and lights it green. */
function signalPost(k: PixelCanvas, x: number, base: number, h: number, down: boolean) {
  k.rect(x, base - h, 2, h, "i");
  k.rect(x, base - h, 1, h, "I");
  k.rect(x - 1, base - 3, 4, 3, "i"); // footing
  k.rect(x - 1, base - h - 1, 4, 1, "I"); // cap
  for (let i = 0; i < 8; i++) {
    const ay = base - h + 2 + (down ? Math.floor(i / 2) : 0);
    k.rect(x + 2 + i, ay, 1, 2, i % 4 < 2 ? "a" : "W");
  }
  const ly = base - h + 2 + (down ? 4 : 0);
  k.rect(x + 10, ly - 1, 2, 4, "i");
  k.px(x + 10, ly, down ? "t" : "R");
  k.px(x + 11, ly, down ? "t" : "R");
  k.px(x + 10, ly + 1, down ? "T" : "r");
}

/** The marsh's tree line: a misty bank, bare snags, railway signals standing in the water and a thicket of cattails. */
function marshHorizon(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(59);
  // far bank in mist
  for (let x = 0; x < W; x++) {
    const h = 24 + Math.round(5 * Math.sin(x / 11) + 3 * Math.sin(x / 4.1 + 2) + 2 * Math.sin(x / 26));
    for (let y = H - h; y < H; y++) k.px(x, y, y < H - h + 2 ? "F" : "f");
  }
  // bare snags rising from the bank
  for (const sx of [12, 41, 78, 109, 148]) {
    const snag = new PixelCanvas(W, H);
    const top = 22 + Math.floor(rnd() * 14);
    snag.line(sx, H, sx + 1, H - top, "n");
    snag.line(sx + 1, H - top + 6, sx - 5, H - top - 1, "n");
    snag.line(sx + 1, H - top + 12, sx + 6, H - top + 5, "n");
    snag.line(sx - 2, H - top + 3, sx - 3, H - top - 5, "n");
    k.stamp(snag.toGrid(), 0, 0);
  }
  // signals in the water: the middle one has cleared, the rest still say stop
  [[26, 46, false], [88, 58, true], [132, 40, false]].forEach(([sx, sh, down]) => {
    const s = new PixelCanvas(W, H);
    signalPost(s, sx as number, H - 4, sh as number, down as boolean);
    s.outline("o");
    k.stamp(s.toGrid(), 0, 0);
  });
  // still water at the foot, with a few ripples
  for (let x = 0; x < W; x++) for (let y = H - 5; y < H; y++) k.px(x, y, "w");
  for (let i = 0; i < 16; i++) {
    const rx = Math.floor(rnd() * (W - 6));
    k.rect(rx, H - 4 + Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 3), 1, "W");
  }
  // cattails and reeds along the near edge
  const reeds = new PixelCanvas(W, H);
  for (let x = 1; x < W; x += 3 + Math.floor(rnd() * 4)) {
    const hgt = 10 + Math.floor(rnd() * 14);
    const lean = (rnd() - 0.5) * 5;
    reeds.line(x, H, x + lean, H - hgt, rnd() < 0.5 ? "g" : "G");
    if (rnd() < 0.45) reeds.rect(Math.round(x + lean) - 0, H - hgt - 3, 2, 4, "c");
  }
  reeds.outline("o");
  k.stamp(reeds.toGrid(), 0, 0);
  return k.toGrid();
}

export const MARSH_HORIZON: SpriteSheet = {
  name: "Mutex Marsh bank",
  palette: {
    o: "#0b1a1e",
    f: "#1f3f46",
    F: "#2c5359",
    n: "#14292e",
    i: "#2c3a44",
    I: "#566a78",
    a: "#c23b3b",
    W: "#e8f0ee",
    R: "#ff5a4f",
    r: "#9a2a2a",
    t: "#6ef0a0",
    T: "#c8ffd8",
    w: "#1a3a44",
    g: "#2d6b45",
    G: "#4f9a58",
    c: "#6b4a2e",
  },
  idle: [marshHorizon()],
};

/** A tall clump of reeds with cattail heads. */
function reedClump(): string[] {
  const k = new PixelCanvas(26, 34);
  const rnd = lcg(5);
  for (const [x, h, lean] of [[5, 22, -3], [9, 30, -1], [13, 26, 1], [17, 32, 3], [21, 20, 4], [7, 16, -4]] as const) {
    k.line(x, 33, x + lean, 33 - h, "g");
    k.line(x + 1, 33, x + lean + 1, 33 - h, "G");
    if (rnd() < 0.9) k.rect(x + lean, 33 - h - 3, 2, 5, "c");
    k.px(x + lean, 33 - h - 3, "C");
    k.px(x + lean, 33 - h - 5, "G");
  }
  k.line(3, 33, 14, 21, "G");
  k.line(24, 33, 14, 24, "g");
  k.rect(2, 32, 22, 2, "m");
  k.outline("o");
  return k.toGrid();
}

export const MARSH_REEDS: SpriteSheet = {
  name: "Marsh reeds",
  palette: { o: "#0b1a1e", g: "#2d6b45", G: "#5aa85c", c: "#6b4a2e", C: "#a67c4e", m: "#1f4a38" },
  idle: [reedClump()],
};

/** A cluster of lily pads with a glowing bud. */
function lilyPads(): string[] {
  const k = new PixelCanvas(32, 12);
  for (const [cx, cy, rx, ry, notch] of [[9, 6, 8, 3.6, 1], [23, 7, 7, 3.2, -1], [16, 4, 5, 2.4, 1]] as const) {
    k.ellipse(cx, cy, rx, ry, ["g", "G", "h"], [-0.3, -1]);
    k.line(cx, cy, cx + notch * rx, cy - 1, ".");
  }
  k.px(16, 3, "p");
  k.px(15, 2, "P");
  k.px(17, 2, "P");
  k.px(16, 1, "P");
  k.outline("o");
  return k.toGrid();
}

export const LILY_PADS: SpriteSheet = {
  name: "Lily pads",
  palette: { o: "#0b1a1e", g: "#24603f", G: "#3f8f50", h: "#78c466", p: "#ffe27a", P: "#5eead4" },
  idle: [lilyPads()],
};

/** A signal post standing in the shallows (the marsh's wait()/signal() lamp). */
function signalProp(): string[] {
  const k = new PixelCanvas(22, 44);
  signalPost(k, 5, 43, 40, true);
  k.rect(2, 41, 14, 3, "m");
  k.outline("o");
  return k.toGrid();
}

export const SIGNAL_POST: SpriteSheet = {
  name: "Signal post",
  palette: { o: "#0b1a1e", i: "#2c3a44", I: "#566a78", a: "#c23b3b", W: "#e8f0ee", R: "#ff5a4f", r: "#9a2a2a", t: "#6ef0a0", T: "#c8ffd8", m: "#1f4a38" },
  idle: [signalProp()],
};

/** A mooring post wearing a big brass padlock: the marsh's mutex. */
function lockPost(): string[] {
  const k = new PixelCanvas(18, 30);
  k.rect(6, 10, 6, 20, "b");
  k.rect(6, 10, 2, 20, "B");
  k.rect(4, 27, 10, 3, "m");
  // shackle
  k.ellipse(9, 7, 5, 6, ["s", "S"]);
  k.ellipse(9, 8, 3, 4, [".", "."]);
  for (let y = 4; y < 13; y++) for (let x = 6; x < 13; x++) if (Math.hypot(x + 0.5 - 9, y + 0.5 - 8) < 3.2) k.px(x, y, ".");
  // lock body
  k.rect(3, 11, 12, 9, "y");
  k.rect(3, 11, 12, 2, "Y");
  k.rect(3, 18, 12, 2, "d");
  k.rect(8, 14, 2, 3, "k");
  k.px(8, 14, "k");
  k.outline("o");
  return k.toGrid();
}

export const LOCK_POST: SpriteSheet = {
  name: "Padlock post",
  palette: { o: "#0b1a1e", b: "#3b2a22", B: "#5e4433", m: "#1f4a38", s: "#7e8a96", S: "#c4ced8", y: "#d9a441", Y: "#ffe08a", d: "#a8742a", k: "#2a1d2e" },
  idle: [lockPost()],
};

/** A flat lily-pad platform on dark water, the Mutex Marsh version of the grass platform. */
function padPlatform(): string[] {
  const k = new PixelCanvas(74, 20);
  k.ellipse(37, 13, 35, 6, ["w", "W", "x"], [-0.2, -1]); // water ring
  k.ellipse(37, 9, 33, 7, ["g", "G", "h", "H"], [-0.3, -1]);
  // the pad's notch, then veins radiating from the stem
  k.line(37, 9, 68, 5, ".");
  k.line(37, 9, 69, 7, ".");
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.2 + (i / 8) * Math.PI * 1.45;
    k.line(37, 9, 37 + Math.cos(a) * 24, 9 + Math.sin(a) * 4.8, "g");
  }
  k.rect(36, 8, 3, 2, "p");
  k.px(36, 8, "P");
  k.outline("o");
  return k.toGrid();
}

export const PAD_PLATFORM: SpriteSheet = {
  name: "Lily pad platform",
  palette: { o: "#0b1a1e", w: "#16323a", W: "#245058", x: "#3b7a80", g: "#24603f", G: "#3f8f50", h: "#5fb35c", H: "#9be07a", p: "#d9a441", P: "#ffe08a" },
  idle: [padPlatform()],
};

/* --------------------------------------------------------- Gridlock Gym */

/** A little side-on car: body, cabin, glass, wheels and a lamp at the nose. `lead` is the body ramp letter (c red, d blue, e yellow). */
function car(k: PixelCanvas, x: number, base: number, w: number, lead: "c" | "d" | "e", faceRight: boolean) {
  const up = lead.toUpperCase();
  k.rect(x, base - 7, w, 5, lead);
  k.rect(x, base - 7, w, 1, up);
  k.rect(x, base - 3, w, 1, "z");
  const cx = x + (faceRight ? 3 : w - 3 - (w - 8));
  k.rect(cx, base - 11, w - 8, 4, lead);
  k.rect(cx, base - 11, w - 8, 1, up);
  k.rect(cx + 1, base - 10, Math.max(2, Math.floor((w - 10) / 2) - 1), 3, "g");
  k.rect(cx + Math.floor((w - 8) / 2) + 1, base - 10, Math.max(2, Math.floor((w - 10) / 2) - 1), 3, "g");
  k.rect(faceRight ? x + w - 1 : x, base - 6, 1, 2, "y");
  k.rect(faceRight ? x : x + w - 1, base - 6, 1, 2, "r");
  for (const wx of [x + 2, x + w - 5]) {
    k.rect(wx, base - 3, 3, 3, "t");
    k.px(wx + 1, base - 2, "h");
  }
}

/** A traffic light on a post; every lamp but the lit one is dark. Gridlock Gym lights are all red. */
function trafficLight(k: PixelCanvas, x: number, base: number, h: number) {
  k.rect(x, base - h, 2, h, "i");
  k.rect(x, base - h, 1, h, "I");
  k.rect(x - 1, base - 3, 4, 3, "i");
  k.rect(x - 2, base - h - 9, 6, 9, "z");
  k.rect(x - 2, base - h - 9, 1, 9, "i");
  k.rect(x - 1, base - h - 8, 4, 2, "R");
  k.px(x, base - h - 8, "W");
  k.rect(x - 1, base - h - 5, 4, 2, "q");
  k.rect(x - 1, base - h - 2, 4, 2, "q");
}

/** The gym's skyline: dusk towers, a gantry of red lights over a jam of cars nose to tail. */
function gridlockHorizon(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(83);
  // far towers, two layers
  for (const [layer, lo, col] of [[0, 22, "f"], [1, 14, "b"]] as const) {
    let x = layer ? 3 : 0;
    while (x < W) {
      const w = 7 + Math.floor(rnd() * 9);
      const h = lo + 6 + Math.floor(rnd() * 22);
      k.rect(x, H - 10 - h, w, h, col);
      k.rect(x, H - 10 - h, 1, h, "B");
      if (layer)
        for (let wy = H - 10 - h + 3; wy < H - 14; wy += 3)
          for (let wx = x + 2; wx < x + w - 1; wx += 3) if (rnd() < 0.4) k.px(wx, wy, rnd() < 0.5 ? "w" : "y");
      x += w + Math.floor(rnd() * 3);
    }
  }
  // the road
  k.rect(0, H - 10, W, 10, "z");
  for (let x = 2; x < W; x += 12) k.rect(x, H - 5, 6, 1, "y");
  // a gantry of red lights across the street
  const g = new PixelCanvas(W, H);
  g.rect(8, H - 52, W - 16, 2, "i");
  g.rect(8, H - 52, W - 16, 1, "I");
  g.rect(8, H - 52, 2, 46, "i");
  g.rect(W - 10, H - 52, 2, 46, "i");
  for (const lx of [34, 80, 124]) {
    g.rect(lx, H - 50, 2, 3, "i");
    g.rect(lx - 2, H - 47, 6, 9, "z");
    g.rect(lx - 1, H - 46, 4, 2, "R");
    g.px(lx, H - 46, "W");
    g.rect(lx - 1, H - 43, 4, 2, "q");
    g.rect(lx - 1, H - 40, 4, 2, "q");
  }
  g.outline("o");
  k.stamp(g.toGrid(), 0, 0);
  // cars jammed bumper to bumper, facing both ways
  const cars = new PixelCanvas(W, H);
  const colours = ["c", "d", "e"] as const;
  let cx = 2;
  let i = 0;
  while (cx < W - 18) {
    const w = 15 + Math.floor(rnd() * 5);
    car(cars, cx, H - 5 + (i % 2), w, colours[i % 3], i % 2 === 0);
    cx += w + 1;
    i++;
  }
  cars.outline("o");
  k.stamp(cars.toGrid(), 0, 0);
  return k.toGrid();
}

const GRIDLOCK_COLOURS = {
  o: "#1a1018",
  f: "#2a2145",
  b: "#3a2a58",
  B: "#5a4278",
  w: "#ffcf6e",
  y: "#e8b04a",
  z: "#2a2630",
  i: "#4a4654",
  I: "#7a7686",
  R: "#ff4a3f",
  r: "#a82a2a",
  q: "#3a1a1e",
  W: "#ffe3de",
  c: "#c2413b",
  C: "#ef7467",
  d: "#3b6fc2",
  D: "#72a4ec",
  e: "#d9a441",
  E: "#ffd97a",
  g: "#a8d8f0",
  t: "#15121a",
  h: "#8a8696",
};

export const GRIDLOCK_HORIZON: SpriteSheet = {
  name: "Gridlock Gym street",
  palette: GRIDLOCK_COLOURS,
  idle: [gridlockHorizon()],
};

/** A traffic light standing at the kerb, stuck on red. */
function lightProp(): string[] {
  const k = new PixelCanvas(16, 46);
  trafficLight(k, 7, 45, 34);
  k.rect(3, 43, 10, 3, "z");
  k.outline("o");
  return k.toGrid();
}

export const TRAFFIC_LIGHT: SpriteSheet = {
  name: "Traffic light",
  palette: GRIDLOCK_COLOURS,
  idle: [lightProp()],
};

/** Two cars nose to nose, neither able to back out. */
function standoff(): string[] {
  const k = new PixelCanvas(44, 14);
  car(k, 1, 13, 20, "c", true);
  car(k, 23, 13, 20, "d", false);
  k.outline("o");
  return k.toGrid();
}

export const STANDOFF_CARS: SpriteSheet = {
  name: "Nose-to-nose cars",
  palette: GRIDLOCK_COLOURS,
  idle: [standoff()],
};

/** An orange traffic cone with two reflective bands. */
function cone(): string[] {
  const k = new PixelCanvas(12, 16);
  k.rect(1, 13, 10, 3, "z");
  k.rect(1, 13, 10, 1, "i");
  for (let y = 0; y < 13; y++) {
    const half = 1 + Math.floor((y * 4) / 13);
    k.rect(6 - half, y, half * 2, 1, y % 5 === 0 ? "w" : "n");
  }
  k.rect(4, 5, 4, 1, "W");
  k.rect(3, 9, 6, 1, "W");
  k.rect(5, 0, 1, 12, "N");
  k.outline("o");
  return k.toGrid();
}

export const CONE: SpriteSheet = {
  name: "Traffic cone",
  palette: { ...GRIDLOCK_COLOURS, n: "#e8742a", N: "#ffa45a", w: "#f4b27a" },
  idle: [cone()],
};

/** A patch of asphalt with a cracked kerb stripe, scattered over the ground. */
function asphalt(): string[] {
  const k = new PixelCanvas(30, 8);
  k.rect(0, 2, 30, 4, "z");
  k.rect(0, 2, 30, 1, "i");
  for (let x = 3; x < 28; x += 9) k.rect(x, 4, 5, 1, "y");
  k.line(12, 5, 16, 7, "t");
  k.outline("o");
  return k.toGrid();
}

export const ASPHALT: SpriteSheet = {
  name: "Asphalt patch",
  palette: GRIDLOCK_COLOURS,
  idle: [asphalt()],
};

/** A round manhole-cover platform with a yellow ring: an intersection to stand in. */
function crossingPlatform(): string[] {
  const k = new PixelCanvas(74, 20);
  k.ellipse(37, 13, 35, 6, ["z", "i", "I"], [-0.2, -1]);
  k.ellipse(37, 9, 33, 7, ["a", "A", "s", "S"], [-0.3, -1]);
  // hazard-yellow rim
  for (let x = 6; x < 68; x += 6) k.rect(x, 3 + Math.round(Math.abs(37 - x) / 10), 3, 1, "y");
  // crosswalk stripes
  for (let x = 18; x < 58; x += 5) k.rect(x, 8, 3, 4, "W");
  k.outline("o");
  return k.toGrid();
}

export const CROSSING_PLATFORM: SpriteSheet = {
  name: "Intersection platform",
  palette: { ...GRIDLOCK_COLOURS, a: "#2c2a36", A: "#403d4c", s: "#58546a", S: "#767288", W: "#e8e4ee" },
  idle: [crossingPlatform()],
};

/* ---------------------------------------------------------- Heap Harbor */

/** A shipping container: corrugated sides, a lit top edge and a dark foot. `lead` is the colour ramp letter (c red, d blue, e yellow, m green). */
function container(k: PixelCanvas, x: number, y: number, w: number, h: number, lead: "c" | "d" | "e" | "m") {
  k.rect(x, y, w, h, lead);
  k.rect(x, y, w, 1, lead.toUpperCase());
  k.rect(x, y + h - 1, w, 1, "s");
  for (let cx = x + 2; cx < x + w - 1; cx += 2) k.rect(cx, y + 1, 1, h - 2, "s");
  k.rect(x + w - 2, y + 1, 1, h - 2, lead.toUpperCase());
}

/** The harbour front: a quay of container blocks with gaps between them (free holes), two gantry cranes and still water below. */
function harborHorizon(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(97);
  // far warehouses in the haze
  let x = 0;
  while (x < W) {
    const w = 10 + Math.floor(rnd() * 12);
    const h = 14 + Math.floor(rnd() * 16);
    k.rect(x, H - 16 - h, w, h, "f");
    k.rect(x, H - 16 - h, w, 1, "F");
    for (let wx = x + 2; wx < x + w - 1; wx += 3) if (rnd() < 0.5) k.px(wx, H - 16 - h + 4, "w");
    x += w + Math.floor(rnd() * 3);
  }
  // the quay
  k.rect(0, H - 16, W, 11, "q");
  k.rect(0, H - 16, W, 1, "Q");
  for (let qx = 0; qx < W; qx += 8) k.rect(qx, H - 10, 1, 5, "p");
  // two gantry cranes, each hoisting a container
  const cranes = new PixelCanvas(W, H);
  for (const [cx, hgt] of [[34, 56], [118, 50]] as const) {
    const top = H - 16 - hgt;
    cranes.rect(cx - 8, top, 2, hgt, "i");
    cranes.rect(cx + 8, top, 2, hgt, "i");
    cranes.rect(cx - 8, top, 1, hgt, "I");
    cranes.rect(cx - 8, top + 8, 18, 1, "i");
    cranes.rect(cx - 20, top, 40, 2, "i");
    cranes.rect(cx - 20, top, 40, 1, "I");
    cranes.line(cx - 8, top + 8, cx - 1, top, "i");
    cranes.line(cx + 9, top + 8, cx + 2, top, "i");
    cranes.rect(cx - 12, top + 2, 1, 14, "i");
    cranes.rect(cx - 5, top + 2, 1, 14, "i");
    container(cranes, cx - 14, top + 16, 12, 6, "e");
    cranes.px(cx + 14, top - 2, "R");
  }
  cranes.outline("o");
  k.stamp(cranes.toGrid(), 0, 0);
  // allocated blocks with free holes between them
  const blocks = new PixelCanvas(W, H);
  const lead = ["c", "d", "e", "m"] as const;
  let bx = 2;
  let i = 0;
  while (bx < W - 10) {
    const w = 10 + 2 * Math.floor(rnd() * 5);
    container(blocks, bx, H - 24, w, 8, lead[i % 4]);
    if (i % 3 === 1) container(blocks, bx + 1, H - 31, w - 2, 7, lead[(i + 2) % 4]);
    bx += w + (i % 2 ? 3 : 7 + Math.floor(rnd() * 5));
    i++;
  }
  blocks.outline("o");
  k.stamp(blocks.toGrid(), 0, 0);
  // water at the foot
  for (let wx = 0; wx < W; wx++) for (let y = H - 5; y < H; y++) k.px(wx, y, "v");
  for (let r = 0; r < 18; r++) k.rect(Math.floor(rnd() * (W - 6)), H - 4 + Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 3), 1, "V");
  return k.toGrid();
}

const HARBOR_COLOURS = {
  o: "#0c1624",
  f: "#1f3350",
  F: "#2f4a6c",
  w: "#ffd98a",
  q: "#34384a",
  Q: "#555b72",
  p: "#252838",
  i: "#46526a",
  I: "#7a8aa6",
  R: "#ff5a4f",
  c: "#b5443c",
  C: "#e8786a",
  d: "#3c6cb5",
  D: "#74a4e8",
  e: "#d9a441",
  E: "#ffd97a",
  m: "#3f9a6a",
  M: "#78d29e",
  s: "#241a2c",
  v: "#16324e",
  V: "#3a6a94",
  b: "#7a5030",
  B: "#a8744a",
  L: "#d49a64",
  h: "#c8d4e4",
};

export const HARBOR_HORIZON: SpriteSheet = {
  name: "Heap Harbor quay",
  palette: HARBOR_COLOURS,
  idle: [harborHorizon()],
};

/** A stack of containers with a gap in the middle row: a hole too small for the next block. */
function containerStack(): string[] {
  const k = new PixelCanvas(36, 36);
  container(k, 1, 26, 16, 9, "c");
  container(k, 19, 26, 16, 9, "d");
  container(k, 1, 17, 10, 9, "m");
  container(k, 22, 17, 13, 9, "e");
  container(k, 6, 8, 14, 9, "d");
  k.rect(12, 18, 9, 8, "v");
  k.outline("o");
  return k.toGrid();
}

export const CONTAINER_STACK: SpriteSheet = {
  name: "Container stack",
  palette: HARBOR_COLOURS,
  idle: [containerStack()],
};

/** A mooring bollard on the quay edge with a coil of rope. */
function bollard(): string[] {
  const k = new PixelCanvas(14, 20);
  k.rect(3, 4, 8, 14, "i");
  k.rect(3, 4, 2, 14, "I");
  k.rect(1, 2, 12, 3, "i");
  k.rect(1, 2, 12, 1, "I");
  k.rect(0, 17, 14, 3, "q");
  for (let y = 8; y < 15; y += 2) k.rect(2, y, 10, 1, "L");
  k.outline("o");
  return k.toGrid();
}

export const BOLLARD: SpriteSheet = {
  name: "Mooring bollard",
  palette: HARBOR_COLOURS,
  idle: [bollard()],
};

/** A little wooden crate, the sort a small allocation fits in. */
function crate(): string[] {
  const k = new PixelCanvas(14, 14);
  k.rect(0, 0, 14, 14, "b");
  k.rect(0, 0, 14, 2, "B");
  k.rect(0, 12, 14, 2, "p");
  k.rect(0, 0, 2, 14, "B");
  k.rect(12, 0, 2, 14, "p");
  k.line(2, 2, 11, 11, "L");
  k.line(11, 2, 2, 11, "L");
  k.outline("o");
  return k.toGrid();
}

export const CRATE: SpriteSheet = {
  name: "Wooden crate",
  palette: HARBOR_COLOURS,
  idle: [crate()],
};

/** A patch of wet planks with a nail head or two, scattered over the ground. */
function planks(): string[] {
  const k = new PixelCanvas(30, 8);
  k.rect(0, 2, 30, 4, "b");
  k.rect(0, 2, 30, 1, "B");
  for (const px of [9, 19]) k.rect(px, 2, 1, 4, "p");
  for (const px of [4, 14, 25]) k.px(px, 4, "L");
  k.rect(11, 6, 6, 1, "V");
  k.outline("o");
  return k.toGrid();
}

export const PLANKS: SpriteSheet = {
  name: "Wet planks",
  palette: HARBOR_COLOURS,
  idle: [planks()],
};

/** A pier platform: planks laid as a grid of fixed-size pages, with a gold page being addressed. */
function pierPlatform(): string[] {
  const k = new PixelCanvas(74, 20);
  k.ellipse(37, 13, 35, 6, ["p", "q", "i"], [-0.2, -1]);
  k.ellipse(37, 9, 33, 7, ["b", "b", "B", "L"], [-0.3, -1]);
  for (let x = 12; x < 64; x += 8) k.rect(x, 5, 1, 9, "p");
  for (const y of [7, 11]) k.rect(8, y, 58, 1, "p");
  k.rect(37, 8, 7, 3, "E");
  k.rect(37, 8, 7, 1, "h");
  k.outline("o");
  return k.toGrid();
}

export const PIER_PLATFORM: SpriteSheet = {
  name: "Pier platform",
  palette: HARBOR_COLOURS,
  idle: [pierPlatform()],
};

/* ------------------------------------------------------------- Swapwood */

const SWAP_COLOURS = {
  o: "#101a1c",
  f: "#1c3a3c",
  F: "#2c5a54",
  g: "#2a5a48",
  G: "#4c9470",
  t: "#3a2c34",
  T: "#5c4450",
  k: "#8a6a70",
  p: "#e8dcc0",
  P: "#fff6dc",
  q: "#b8a888",
  r: "#c8604c",
  y: "#e8b84c",
  u: "#7a5ac8",
  U: "#a890f0",
  s: "#141c22",
  v: "#1e3a4c",
  V: "#4a7a94",
  m: "#4c8a3c",
  M: "#86c456",
  b: "#6a4c36",
  B: "#a07850",
  L: "#d4a870",
};

/** A page card: a small cream sheet with ruled lines, hanging from a branch. `lit` = a gold "resident" page. */
function pageCard(k: PixelCanvas, x: number, y: number, lit = false) {
  k.rect(x, y, 5, 6, lit ? "y" : "p");
  k.rect(x, y, 5, 1, "P");
  k.rect(x + 1, y + 2, 3, 1, "q");
  k.rect(x + 1, y + 4, 3, 1, "q");
}

/** The wood: a misty wall of trunks hung with page cards (resident pages), a few swapped out into the dark river at the foot. */
function swapHorizon(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(131);
  // far canopy haze
  for (let x = 0; x < W; x++) {
    const h = 26 + Math.round(5 * Math.sin(x / 9) + 4 * Math.sin(x / 4.1));
    for (let y = H - 12 - h; y < H - 12; y++) k.px(x, y, "f");
    k.px(x, H - 12 - h, "F");
  }
  // trunks with canopies
  const trees = new PixelCanvas(W, H);
  for (let tx = 6; tx < W - 4; tx += 14 + Math.floor(rnd() * 8)) {
    const top = 10 + Math.floor(rnd() * 14);
    const bot = H - 13;
    trees.rect(tx, top + 8, 4, bot - top - 8, "t");
    trees.rect(tx, top + 8, 1, bot - top - 8, "T");
    trees.ellipse(tx + 2, top + 8, 12, 9, ["g", "g", "G"], [-0.3, -1]);
    // cards hang from the canopy edge
    for (let c = -1; c <= 1; c++) {
      const cy = top + 14 + Math.floor(rnd() * 8);
      pageCard(trees, tx + 2 + c * 6 - 2, cy, rnd() < 0.3);
      trees.rect(tx + 2 + c * 6, cy - 3, 1, 3, "k");
    }
  }
  trees.outline("o");
  k.stamp(trees.toGrid(), 0, 0);
  // the bank and a dark river (the backing store)
  k.rect(0, H - 13, W, 4, "m");
  k.rect(0, H - 13, W, 1, "M");
  k.rect(0, H - 9, W, 9, "v");
  for (let r = 0; r < 20; r++) k.rect(Math.floor(rnd() * (W - 6)), H - 8 + Math.floor(rnd() * 7), 3 + Math.floor(rnd() * 4), 1, "V");
  // pages that have been swapped out, floating downstream
  for (let c = 0; c < 6; c++) {
    const cx = 8 + c * 26 + Math.floor(rnd() * 8);
    const cy = H - 7 + Math.floor(rnd() * 3);
    k.rect(cx, cy, 5, 2, "p");
    k.rect(cx, cy, 5, 1, "P");
  }
  return k.toGrid();
}

export const SWAP_HORIZON: SpriteSheet = {
  name: "Swapwood treeline",
  palette: SWAP_COLOURS,
  idle: [swapHorizon()],
};

/** A small tree hung with page cards, a couple of them gold (in a frame). */
function pageTree(): string[] {
  const k = new PixelCanvas(34, 44);
  k.rect(15, 24, 5, 19, "t");
  k.rect(15, 24, 1, 19, "T");
  k.ellipse(17, 16, 16, 13, ["g", "g", "G"], [-0.3, -1]);
  for (const [cx, cy, lit] of [[4, 22, false], [12, 28, true], [24, 26, false], [28, 18, true], [2, 12, false]] as const) {
    pageCard(k, cx, cy, lit);
    k.rect(cx + 2, cy - 2, 1, 2, "k");
  }
  k.outline("o");
  return k.toGrid();
}

export const PAGE_TREE: SpriteSheet = {
  name: "Page tree",
  palette: SWAP_COLOURS,
  idle: [pageTree()],
};

/** A signpost with an arrow up (page-in) and an arrow down (page-out). */
function swapSign(): string[] {
  const k = new PixelCanvas(20, 30);
  k.rect(9, 6, 3, 23, "b");
  k.rect(9, 6, 1, 23, "B");
  k.rect(1, 3, 17, 7, "B");
  k.rect(1, 3, 17, 1, "L");
  k.rect(2, 12, 15, 7, "B");
  k.rect(2, 12, 15, 1, "L");
  k.rect(5, 5, 1, 4, "s");
  k.px(4, 6, "s");
  k.px(6, 6, "s");
  k.rect(13, 14, 1, 4, "s");
  k.px(12, 16, "s");
  k.px(14, 16, "s");
  k.outline("o");
  return k.toGrid();
}

export const SWAP_SIGN: SpriteSheet = {
  name: "Swap signpost",
  palette: SWAP_COLOURS,
  idle: [swapSign()],
};

/** A stack of cards lying on the moss: the pages waiting to be evicted. */
function cardPile(): string[] {
  const k = new PixelCanvas(24, 14);
  for (let i = 0; i < 4; i++) {
    const y = 9 - i * 2;
    k.rect(1 + (i % 2) * 2, y, 18, 3, i === 3 ? "P" : "p");
    k.rect(1 + (i % 2) * 2, y + 2, 18, 1, "q");
  }
  k.rect(16, 1, 6, 8, "y");
  k.rect(16, 1, 6, 1, "P");
  k.rect(17, 3, 4, 1, "q");
  k.rect(17, 5, 4, 1, "q");
  k.outline("o");
  return k.toGrid();
}

export const CARD_PILE: SpriteSheet = {
  name: "Card pile",
  palette: SWAP_COLOURS,
  idle: [cardPile()],
};

/** Glowing violet toadstools, the glow of a page being touched. */
function glowShrooms(): string[] {
  const k = new PixelCanvas(20, 14);
  for (const [x, w, h] of [[2, 8, 6], [11, 6, 5]] as const) {
    k.rect(x + Math.floor(w / 2) - 1, 14 - h, 2, h - 2, "q");
    k.ellipse(x + w / 2, 14 - h, w / 2, 3, ["u", "u", "U"], [-0.3, -1]);
  }
  k.px(5, 6, "P");
  k.px(13, 7, "P");
  k.outline("o");
  return k.toGrid();
}

export const GLOW_SHROOMS: SpriteSheet = {
  name: "Glow toadstools",
  palette: SWAP_COLOURS,
  idle: [glowShrooms()],
};

/** Leaf litter and moss on the ground. */
function mossPatch(): string[] {
  const k = new PixelCanvas(30, 8);
  k.ellipse(15, 5, 14, 2, ["m", "m", "M"], [-0.2, -1]);
  for (const px of [6, 14, 22]) k.px(px, 3, "r");
  k.px(10, 2, "y");
  k.px(19, 2, "r");
  k.outline("o");
  return k.toGrid();
}

export const MOSS_PATCH: SpriteSheet = {
  name: "Moss patch",
  palette: SWAP_COLOURS,
  idle: [mossPatch()],
};

/** A tree-ring platform: a sawn stump whose rings are a grid of frame slots, one lit gold. */
function stumpPlatform(): string[] {
  const k = new PixelCanvas(74, 20);
  k.ellipse(37, 13, 35, 6, ["s", "t", "T"], [-0.2, -1]);
  k.ellipse(37, 9, 33, 7, ["b", "b", "B", "L"], [-0.3, -1]);
  k.ellipse(37, 9, 24, 5, ["b", "B"], [0, -1]);
  k.ellipse(37, 9, 14, 3, ["b", "B"], [0, -1]);
  for (const x of [21, 29, 45, 53]) k.rect(x, 7, 1, 5, "T");
  k.rect(34, 8, 6, 3, "y");
  k.rect(34, 8, 6, 1, "P");
  k.outline("o");
  return k.toGrid();
}

export const STUMP_PLATFORM: SpriteSheet = {
  name: "Stump platform",
  palette: SWAP_COLOURS,
  idle: [stumpPlatform()],
};

/* ---------------------------------------------------------- Platter Peak */

const PEAK_COLOURS = {
  o: "#0c1620",
  f: "#1c2c40",
  F: "#2c4460",
  n: "#3c5a78",
  N: "#6e92b0",
  w: "#e8f2fa",
  d: "#26303c",
  D: "#3e4c5c",
  e: "#62758a",
  E: "#9fb2c6",
  r: "#e0483c",
  R: "#ff8a70",
  y: "#e8b84c",
  Y: "#ffe08a",
  s: "#141c26",
  v: "#16283a",
  V: "#3a6684",
  k: "#586a7c",
  K: "#8fa4b8",
};

/** The peak range: jagged snow-capped ridges with a huge platter rising behind them, its tracks ringed and a read arm reaching in. */
function peakHorizon(): string[] {
  const W = 160;
  const H = 80;
  const k = new PixelCanvas(W, H);
  const rnd = lcg(131);
  // the giant platter behind the range, tracks as concentric rings
  const disc = new PixelCanvas(W, H);
  disc.ellipse(104, 36, 34, 26, ["f", "F", "n"], [-0.4, -0.8]);
  for (const [rx, ry] of [[26, 20], [18, 14], [10, 8]] as const) {
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      disc.px(Math.round(104 + Math.cos(t) * rx), Math.round(36 + Math.sin(t) * ry), "N");
    }
  }
  disc.ellipse(104, 36, 4, 3, ["d", "e", "E"], [-0.4, -0.8]);
  // the actuator arm sweeping in from the left, ending in a red read head
  disc.line(54, 14, 90, 34, "e");
  disc.line(54, 15, 90, 35, "D");
  disc.rect(86, 31, 6, 4, "r");
  disc.px(87, 31, "R");
  disc.outline("o");
  k.stamp(disc.toGrid(), 0, 0);
  // two ridges of peaks, far then near, with snow caps
  const ridge = (base: number, peakH: number, step: number, body: string, cap: string, shade: string) => {
    const r = new PixelCanvas(W, H);
    let x = -4;
    while (x < W) {
      const w = step + Math.floor(rnd() * step);
      const h = peakH - 6 + Math.floor(rnd() * 12);
      for (let i = 0; i < w; i++) {
        const t = i / (w - 1);
        const y = base - Math.round(h * (1 - Math.abs(t * 2 - 1)));
        for (let yy = y; yy < base; yy++) {
          const c = yy - y < 5 && Math.abs(t - 0.5) < 0.22 && h > peakH - 4 ? cap : t > 0.5 ? shade : body;
          if (x + i >= 0 && x + i < W) r.px(x + i, yy, c);
        }
      }
      x += w - 2;
    }
    r.outline("o");
    k.stamp(r.toGrid(), 0, 0);
  };
  ridge(H - 18, 34, 30, "F", "w", "f");
  ridge(H - 8, 20, 26, "n", "w", "F");
  // dark foot of the ridge so the platform reads against it
  k.rect(0, H - 8, W, 8, "f");
  k.rect(0, H - 8, W, 1, "o");
  for (let i = 0; i < 12; i++) k.rect(Math.floor(rnd() * (W - 6)), H - 6 + Math.floor(rnd() * 5), 3 + Math.floor(rnd() * 3), 1, "F");
  return k.toGrid();
}

export const PEAK_HORIZON: SpriteSheet = {
  name: "Platter Peak range",
  palette: PEAK_COLOURS,
  idle: [peakHorizon()],
};

/** A stack of platters, each a thin disc with a bright rim and a spindle hole, leaning a little. */
function platterStack(): string[] {
  const k = new PixelCanvas(32, 30);
  const discs: [number, number, number][] = [[16, 25, 14], [15, 20, 13], [17, 15, 12], [15, 10, 10], [16, 5, 8]];
  for (const [cx, cy, rx] of discs) {
    k.ellipse(cx, cy + 2, rx, 4, ["d", "D"], [0, -1]);
    k.ellipse(cx, cy, rx, 4, ["k", "e", "E", "K"], [-0.3, -1]);
    k.ellipse(cx, cy, rx - 5, 2, ["e", "k"], [0, -1]);
    k.px(cx, cy, "s");
  }
  k.outline("o");
  return k.toGrid();
}

export const PLATTER_STACK: SpriteSheet = {
  name: "Platter stack",
  palette: PEAK_COLOURS,
  idle: [platterStack()],
};

/** A read-write head post: a pivot with an arm and a little red head, as if left parked on the slope. */
function headPost(): string[] {
  const k = new PixelCanvas(24, 34);
  k.rect(10, 12, 4, 20, "e");
  k.rect(10, 12, 1, 20, "E");
  k.rect(5, 28, 14, 4, "D");
  k.rect(5, 28, 14, 1, "e");
  k.ellipse(12, 10, 4, 4, ["d", "e", "E"], [-0.4, -0.8]);
  k.line(12, 10, 21, 20, "e");
  k.line(12, 11, 21, 21, "D");
  k.rect(19, 20, 4, 5, "r");
  k.px(19, 20, "R");
  k.px(12, 10, "y");
  k.outline("o");
  return k.toGrid();
}

export const HEAD_POST: SpriteSheet = {
  name: "Head post",
  palette: PEAK_COLOURS,
  idle: [headPost()],
};

/** A slate boulder with a glint of snow. */
function slateRock(): string[] {
  const k = new PixelCanvas(20, 14);
  k.ellipse(10, 8, 9, 5, ["d", "D", "e", "E"], [-0.5, -0.8]);
  k.rect(5, 4, 5, 1, "w");
  k.line(8, 6, 12, 9, "d");
  k.outline("o");
  return k.toGrid();
}

export const SLATE_ROCK: SpriteSheet = {
  name: "Slate rock",
  palette: PEAK_COLOURS,
  idle: [slateRock()],
};

/** Ring-scored ground: a few concentric track arcs etched into the stone. */
function trackScore(): string[] {
  const k = new PixelCanvas(30, 8);
  k.ellipse(15, 4, 14, 3, ["d", "D"], [0, -1]);
  k.ellipse(15, 4, 9, 2, ["D", "d"], [0, -1]);
  k.ellipse(15, 4, 4, 1, ["d", "D"], [0, -1]);
  k.px(15, 4, "y");
  k.outline("o");
  return k.toGrid();
}

export const TRACK_SCORE: SpriteSheet = {
  name: "Track score",
  palette: PEAK_COLOURS,
  idle: [trackScore()],
};

/** A platter platform: a disc whose rings are tracks, with the gold read head sitting on one. */
function platterPlatform(): string[] {
  const k = new PixelCanvas(74, 20);
  k.ellipse(37, 13, 35, 6, ["s", "d", "D"], [-0.2, -1]);
  k.ellipse(37, 9, 33, 7, ["k", "e", "E", "K"], [-0.3, -1]);
  k.ellipse(37, 9, 25, 5, ["e", "k"], [0, -1]);
  k.ellipse(37, 9, 16, 3, ["k", "e"], [0, -1]);
  k.ellipse(37, 9, 5, 1, ["d", "D"], [0, -1]);
  k.rect(46, 7, 6, 3, "y");
  k.rect(46, 7, 6, 1, "Y");
  k.outline("o");
  return k.toGrid();
}

export const PLATTER_PLATFORM: SpriteSheet = {
  name: "Platter platform",
  palette: PEAK_COLOURS,
  idle: [platterPlatform()],
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

export const MUTEX_MARSH: Backdrop = {
  name: "Mutex Marsh",
  sky: [0x0c1c26, 0x112a33, 0x17383e, 0x214b48, 0x346052, 0x58795c, 0x93a070],
  specks: { count: 24, color: 0x9bffd0, kind: "fireflies" },
  horizon: MARSH_HORIZON,
  ground: { base: 0x1d3f42, stripe: 0x244b4d, edge: 0x0f2427 },
  platform: PAD_PLATFORM,
  props: [
    { sheet: SIGNAL_POST, x: 110, y: 262, scale: 3 },
    { sheet: SIGNAL_POST, x: 940, y: 440, scale: 3, flip: true },
    { sheet: LOCK_POST, x: 500, y: 290, scale: 2 },
    { sheet: LOCK_POST, x: 40, y: 410, scale: 3, flip: true },
    { sheet: MARSH_REEDS, x: 330, y: 300, scale: 2 },
    { sheet: MARSH_REEDS, x: 880, y: 330, scale: 2, flip: true },
    { sheet: MARSH_REEDS, x: 1070, y: 520, scale: 3 },
    { sheet: MARSH_REEDS, x: 470, y: 540, scale: 3, flip: true },
    ...([
      [200, 300], [420, 360], [600, 420], [650, 350], [790, 390], [120, 560], [700, 520], [850, 500], [1000, 400], [-40, 330],
    ] as const).map(([x, y], i) => ({ sheet: LILY_PADS, x, y, scale: y < 340 ? 2 : 3, flip: i % 2 === 1 })),
  ],
};

export const GRIDLOCK_GYM: Backdrop = {
  name: "Gridlock Gym",
  sky: [0x1a1440, 0x2c1c58, 0x462a6a, 0x6a3a72, 0x984e72, 0xc86a62, 0xf0975a],
  specks: { count: 30, color: 0xffd9a0, kind: "stars" },
  horizon: GRIDLOCK_HORIZON,
  ground: { base: 0x3a3844, stripe: 0x433f4e, edge: 0x1e1c26 },
  platform: CROSSING_PLATFORM,
  props: [
    { sheet: TRAFFIC_LIGHT, x: 100, y: 262, scale: 3 },
    { sheet: TRAFFIC_LIGHT, x: 950, y: 440, scale: 3, flip: true },
    { sheet: STANDOFF_CARS, x: 520, y: 292, scale: 2 },
    { sheet: STANDOFF_CARS, x: 560, y: 570, scale: 3, flip: true },
    { sheet: CONE, x: 40, y: 420, scale: 3 },
    { sheet: CONE, x: 340, y: 310, scale: 2 },
    { sheet: CONE, x: 880, y: 330, scale: 2 },
    { sheet: CONE, x: 1080, y: 530, scale: 3 },
    ...([
      [220, 300], [420, 360], [620, 420], [680, 350], [800, 390], [440, 560], [700, 520], [860, 500], [1000, 400], [-40, 330],
    ] as const).map(([x, y], i) => ({ sheet: ASPHALT, x, y, scale: y < 340 ? 2 : 3, flip: i % 2 === 1 })),
  ],
};

export const HEAP_HARBOR: Backdrop = {
  name: "Heap Harbor",
  sky: [0x0e1a3a, 0x16295a, 0x20407a, 0x2f5a90, 0x4a7aa0, 0x7aa0b0, 0xd8b88a],
  specks: { count: 30, color: 0xfff0c8, kind: "stars" },
  horizon: HARBOR_HORIZON,
  ground: { base: 0x4a3a2e, stripe: 0x54433a, edge: 0x2a2018 },
  platform: PIER_PLATFORM,
  props: [
    { sheet: CONTAINER_STACK, x: 100, y: 262, scale: 3 },
    { sheet: CONTAINER_STACK, x: 950, y: 440, scale: 3, flip: true },
    { sheet: BOLLARD, x: 40, y: 420, scale: 3 },
    { sheet: BOLLARD, x: 520, y: 292, scale: 2 },
    { sheet: CRATE, x: 340, y: 310, scale: 2 },
    { sheet: CRATE, x: 880, y: 330, scale: 2, flip: true },
    { sheet: CRATE, x: 1080, y: 530, scale: 3 },
    { sheet: BOLLARD, x: 520, y: 560, scale: 3, flip: true },
    ...([
      [220, 300], [420, 360], [620, 420], [680, 350], [800, 390], [440, 540], [700, 520], [860, 500], [1000, 400], [-40, 330],
    ] as const).map(([x, y], i) => ({ sheet: PLANKS, x, y, scale: y < 340 ? 2 : 3, flip: i % 2 === 1 })),
  ],
};

export const SWAPWOOD: Backdrop = {
  name: "Swapwood",
  sky: [0x170f38, 0x241a52, 0x37266a, 0x4e3478, 0x704486, 0xa05c8a, 0xd8887a],
  specks: { count: 28, color: 0xc8b0ff, kind: "fireflies" },
  horizon: SWAP_HORIZON,
  ground: { base: 0x2c4a36, stripe: 0x345540, edge: 0x172a20 },
  platform: STUMP_PLATFORM,
  props: [
    { sheet: PAGE_TREE, x: 100, y: 262, scale: 3 },
    { sheet: PAGE_TREE, x: 950, y: 440, scale: 3, flip: true },
    { sheet: SWAP_SIGN, x: 40, y: 420, scale: 3 },
    { sheet: SWAP_SIGN, x: 520, y: 292, scale: 2, flip: true },
    { sheet: CARD_PILE, x: 340, y: 310, scale: 2 },
    { sheet: CARD_PILE, x: 1080, y: 530, scale: 3, flip: true },
    { sheet: GLOW_SHROOMS, x: 880, y: 330, scale: 2 },
    { sheet: GLOW_SHROOMS, x: 520, y: 560, scale: 3 },
    ...([
      [220, 300], [420, 360], [620, 420], [680, 350], [800, 390], [440, 540], [700, 520], [860, 500], [1000, 400], [-40, 330],
    ] as const).map(([x, y], i) => ({ sheet: MOSS_PATCH, x, y, scale: y < 340 ? 2 : 3, flip: i % 2 === 1 })),
  ],
};

export const PLATTER_PEAK: Backdrop = {
  name: "Platter Peak",
  sky: [0x0a1628, 0x112440, 0x1a3a5c, 0x2a5578, 0x4a7898, 0x86a8b8, 0xe8b890],
  specks: { count: 36, color: 0xe8f4ff, kind: "stars" },
  horizon: PEAK_HORIZON,
  ground: { base: 0x3a4a5a, stripe: 0x44566a, edge: 0x1c2630 },
  platform: PLATTER_PLATFORM,
  props: [
    { sheet: PLATTER_STACK, x: 100, y: 262, scale: 3 },
    { sheet: PLATTER_STACK, x: 950, y: 440, scale: 3, flip: true },
    { sheet: HEAD_POST, x: 40, y: 420, scale: 3 },
    { sheet: HEAD_POST, x: 520, y: 292, scale: 2, flip: true },
    { sheet: SLATE_ROCK, x: 340, y: 310, scale: 2 },
    { sheet: SLATE_ROCK, x: 1080, y: 530, scale: 3, flip: true },
    { sheet: SLATE_ROCK, x: 880, y: 330, scale: 2 },
    { sheet: HEAD_POST, x: 520, y: 560, scale: 3 },
    ...([
      [220, 300], [420, 360], [620, 420], [680, 350], [800, 390], [440, 540], [700, 520], [860, 500], [1000, 400], [-40, 330],
    ] as const).map(([x, y], i) => ({ sheet: TRACK_SCORE, x, y, scale: y < 340 ? 2 : 3, flip: i % 2 === 1 })),
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
  sync: MUTEX_MARSH,
  deadlocks: GRIDLOCK_GYM,
  memory: HEAP_HARBOR,
  virtual: SWAPWOOD,
  storage: PLATTER_PEAK,
  interview: KERNEL_CITY,
};

/** The backdrop for a gym id; wild and review battles (no gym) use kernel city. */
export const backdropFor = (gym?: string): Backdrop => (gym && BACKDROPS[gym]) || KERNEL_CITY;
