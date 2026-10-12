import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Thrashmoth, boss of the Swapwood Gym (virtual memory): a great violet moth
 * whose forewings are page tables. Every wing cell is a page frame: gold cells
 * are resident, dark cells are swapped out, and the pattern changes on every
 * wingbeat because it never keeps a working set for long. Its hindwings carry
 * a gold "dirty bit" eyespot. Original design, 96×96.
 */
const palette = {
  o: "#140a24", // outline
  1: "#3a1c6e", // wing ramp (gym violet), dark → light
  2: "#5e32a8",
  3: "#9466e0",
  4: "#d2b8ff",
  d: "#1c0e38", // swapped-out page
  y: "#a8701a", // resident page glow
  Y: "#f2c040",
  Z: "#fff6c0",
  f: "#6e5a8a", // fur ramp
  F: "#b8a6d6",
  G: "#ece4ff",
  r: "#7a1430", // compound eyes
  R: "#e0405a",
  q: "#ff9aa8",
  e: "#0c0c14",
  t: "#fffaf0",
} as const;

const W = 96;
const FUR = ["f", "F", "G"];
const VIOLET = ["1", "2", "3", "4"];

type Pt = [number, number];

interface Pose {
  by?: number;
  bx?: number;
  /** wing lift: + raises the tips, − drops them */
  lift?: number;
  /** wings crumple inward when hurt */
  crumple?: number;
  /** which pages are resident this frame */
  seed?: number;
  /** all pages evicted */
  evicted?: boolean;
  blink?: boolean;
  hurt?: boolean;
  glow?: boolean;
  /** scale dust cloud */
  dust?: number;
  /** antenna sway */
  ant?: number;
}

function inside(pts: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function fill(k: PixelCanvas, pts: Pt[], colour: (x: number, y: number) => string | null) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
      if (inside(pts, x + 0.5, y + 0.5)) {
        const c = colour(x, y);
        if (c) k.px(x, y, c);
      }
}

/** Scale a polygon about `o`. */
const grow = (pts: Pt[], o: Pt, s: number): Pt[] => pts.map(([x, y]) => [o[0] + (x - o[0]) * s, o[1] + (y - o[1]) * s]);

function hash(a: number, b: number, c: number) {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Left wings in left-side coordinates; `s` = −1 draws the left pair, 1 the
 * right pair (mirrored about the body's centre line).
 */
function wings(k: PixelCanvas, p: Pose, s: number) {
  const cx = 48 + (p.bx ?? 0);
  const by = p.by ?? 0;
  const lift = p.lift ?? 0;
  const cr = p.crumple ?? 0;
  const X = (x: number) => cx + s * (48 - x); // x given for the left wing (x < 48)
  // forewing: the tip lifts most, the root not at all
  const fw = (x: number, y: number): Pt => {
    const reach = (48 - x) / 44;
    return [X(x + cr * reach * 8), y + 6 + by - lift * reach * 0.8 + cr * reach * 6];
  };
  const fore: Pt[] = [fw(44, 38), fw(40, 26), fw(30, 13), fw(18, 6), fw(7, 7), fw(2, 15), fw(5, 26), fw(14, 36), fw(28, 44), fw(42, 46)];
  const rootF: Pt = [X(44), 48 + by];
  // hindwing hangs lower and lifts less
  const hw = (x: number, y: number): Pt => {
    const reach = (48 - x) / 34;
    return [X(x + cr * reach * 5), y + 4 + by - lift * reach * 0.4 + cr * reach * 4];
  };
  const hind: Pt[] = [hw(44, 48), hw(34, 50), hw(22, 58), hw(14, 68), hw(16, 78), hw(24, 82), hw(34, 76), hw(42, 64)];
  const rootH: Pt = [X(44), 58 + by];

  // hindwing: fringe, a violet body and a gold eyespot
  fill(k, grow(hind, rootH, 1.1), () => "4");
  const eye = hw(25, 70);
  fill(k, hind, (x, y) => {
    const d = Math.hypot(x + 0.5 - rootH[0], y + 0.5 - rootH[1]) / 30;
    const e = Math.hypot(x + 0.5 - eye[0], y + 0.5 - eye[1]);
    if (e < 2.2) return p.evicted ? "d" : "e";
    if (e < 4) return p.evicted ? "1" : "Y";
    if (e < 5.2) return "1";
    return d < 0.35 ? "1" : d < 0.7 ? "2" : "3";
  });

  // forewing: fringe, then a page-table grid between the furry root and the edge
  fill(k, grow(fore, rootF, 1.07), () => "4");
  const seed = p.seed ?? 0;
  fill(k, fore, (x, y) => {
    const d = Math.hypot(x + 0.5 - rootF[0], y + 0.5 - rootF[1]) / 44;
    if (d < 0.22) return "2";
    if (d > 0.93) return "3";
    if (d > 0.88) return "2";
    // cells are 7×6 page frames, with dark veins between them
    const gx = Math.abs(x + 0.5 - cx) - 0.5;
    const gy = y - by - 2;
    const lx = ((gx % 7) + 7) % 7;
    const ly = ((gy % 6) + 6) % 6;
    if (lx === 0 || ly === 0) return "1";
    const cell = [Math.floor(gx / 7), Math.floor(gy / 6)];
    const resident = !p.evicted && hash(cell[0] * s, cell[1], seed) < 0.42;
    if (!resident) return lx === 1 || ly === 1 ? "2" : "d";
    return lx === 1 || ly === 1 ? "Z" : lx === 6 || ly === 5 ? "y" : "Y";
  });
  // a leading-edge vein from the root to the tip
  const tip = fore[3];
  k.line(rootF[0], rootF[1] - 3, tip[0], tip[1] + 1, "1");
}

function antennae(k: PixelCanvas, cx: number, top: number, sway: number) {
  for (const s of [-1, 1]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push([cx + s * (3 + t * 6 + t * t * 7) + sway * t * t, top - t * 26 + t * t * 6]);
    }
    pts.forEach(([x, y], i) => {
      k.px(x, y, "G");
      k.px(x + s, y, "F");
      // feathery barbs on both sides, getting shorter toward the tip
      if (i > 1 && i < 14 && i % 2 === 0) {
        const len = i < 10 ? 2 : 1;
        for (let j = 1; j <= len; j++) {
          k.px(x - s * j * 0.4, y - j, "F");
          k.px(x + s * j, y + j * 0.3, "f");
        }
      }
    });
    k.px(pts[14][0], pts[14][1], "G");
  }
}

function dust(k: PixelCanvas, amount: number, seed: number) {
  for (let i = 0; i < amount; i++) {
    const x = 4 + hash(i, seed, 1) * 88;
    const y = 4 + hash(i, seed, 2) * 84;
    k.stamp(i % 2 === 0 ? [".Z.", "ZYZ", ".Z."] : ["Z", "Y"], x, y);
  }
}

function stars(k: PixelCanvas) {
  for (const [x, y] of [[8, 4], [84, 10], [70, 2]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const cx = 48 + (p.bx ?? 0);
  wings(k, p, -1);
  wings(k, p, 1);
  // segmented abdomen hanging below the thorax
  k.ellipse(cx, 70 + by, 7, 14, VIOLET);
  for (let i = 0; i < 5; i++) k.line(cx - 6 + Math.abs(i - 2) * 0.5, 63 + by + i * 4, cx + 6 - Math.abs(i - 2) * 0.5, 63 + by + i * 4, "F");
  // little legs gripping nothing
  for (const s of [-1, 1]) for (const [dy, len] of [[2, 6], [6, 7]]) k.line(cx + s * 7, 52 + by + dy, cx + s * (7 + len), 56 + by + dy + len * 0.4, "f");
  // fuzzy thorax and ruff
  k.ellipse(cx, 50 + by, 11, 10, FUR);
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    k.px(cx + Math.cos(ang) * 11, 50 + by + Math.sin(ang) * 10, a % 2 ? "F" : "G");
  }
  // head with two huge compound eyes
  const hy = 35 + by;
  antennae(k, cx, hy - 5, p.ant ?? 0);
  k.ellipse(cx, hy, 11, 8, FUR);
  for (const s of [-1, 1]) {
    const ex = cx + s * 8;
    k.ellipse(ex, hy, 6.5, 6.5, ["r", "R"]);
    if (p.hurt) {
      k.stamp(["e...e", ".e.e.", "..e..", ".e.e.", "e...e"], Math.round(ex) - 2, hy - 2);
      continue;
    }
    if (p.blink) {
      k.rect(Math.round(ex) - 4, hy - 1, 9, 3, "f");
      k.rect(Math.round(ex) - 4, hy + 1, 9, 1, "o");
      continue;
    }
    // facets: a checker of light dots over the eye
    for (let y = -4; y <= 4; y += 2) for (let x = -4; x <= 4; x += 2) if (x * x * 0.8 + y * y < 18) k.px(ex + x + (y & 2 ? 1 : 0), hy + y, p.glow ? "Y" : "q");
    k.stamp(["tt", "t."], Math.round(ex) - 3, hy - 4);
  }
  // a curled proboscis, or fangs when it strikes
  if (p.glow) for (const s of [-1, 1]) k.stamp(["t", "t", "."], cx + (s < 0 ? -2 : 1), hy + 6);
  else k.stamp([".ff.", "f..f", "..ff"], cx - 2, hy + 6);
  if (p.dust) dust(k, p.dust, p.seed ?? 0);
  if (p.hurt) stars(k);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the wings from above, the striped abdomen nearest the viewer, the furry back of the head. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const cx = 48 + (p.bx ?? 0);
  wings(k, p, -1);
  wings(k, p, 1);
  // head on the far side, antennae up and the edges of the compound eyes
  const hy = 35 + by;
  antennae(k, cx, hy - 4, p.ant ?? 0);
  for (const s of [-1, 1]) k.ellipse(cx + s * 8, hy + 1, 3, 4.5, ["r", "R"]);
  k.ellipse(cx, hy, 8, 7, FUR);
  // fuzzy thorax with a dark saddle mark
  k.ellipse(cx, 49 + by, 12, 11, FUR);
  k.stamp([".fff.", "fffff", ".fff.", "..f.."], cx - 2, 46 + by);
  // the abdomen, big and close, with fur bands
  k.ellipse(cx, 71 + by, 10, 17, VIOLET);
  for (let i = 0; i < 6; i++) {
    const y = 61 + by + i * 4;
    const hw = Math.round(9 * Math.sqrt(Math.max(0, 1 - ((y - 71 - by) / 17) ** 2)));
    k.line(cx - hw + 1, y, cx + hw - 1, y, i % 2 ? "F" : "G");
  }
  k.stamp(["ff", ".f"], cx - 1, 87 + by);
  if (p.dust) dust(k, p.dust, p.seed ?? 0);
  if (p.hurt) stars(k);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Thrashmoth (${side})`,
    palette,
    idle: [f({ seed: 1 }), f({ seed: 2, lift: 4, by: -1, ant: 1 }), f({ seed: 3, lift: 6, by: -2, ant: 2 }), f({ seed: 4, lift: 2, by: -1, blink: true, ant: 1 })],
    anims: {
      attack: [f({ seed: 5, lift: 7, by: -2, glow: true }), f({ seed: 6, lift: -6, by: 0, glow: true, dust: 10 }), f({ seed: 7, lift: 0, by: 1, glow: true, dust: 22 })],
      hurt: [f({ bx: -5, by: 3, lift: -4, crumple: 1, hurt: true, evicted: true }), f({ bx: -3, by: 2, lift: -2, crumple: 0.6, hurt: true, evicted: true })],
    },
    fps: { idle: 6, attack: 6, hurt: 6 },
  };
}

export const THRASHMOTH_ART: CreatureArt = { id: "thrashmoth", name: "Thrashmoth", boss: true, front: sheet("front"), back: sheet("back") };
