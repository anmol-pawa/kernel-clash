import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Glitchit: a wild software-bug beetle, the first foe you meet. A crimson
 * shell split down the middle, hex-spots, phosphor-green eyes and a body that
 * tears into RGB scanlines when it twitches. Original design.
 */
const palette = {
  o: "#1a0b16", // outline
  1: "#5c1424", // shell ramp, dark → light
  2: "#9c2236",
  3: "#d8424a",
  4: "#ff8a7a",
  s: "#2a0f1c", // spots / seam
  h: "#2b1d3f", // head ramp
  H: "#46336a",
  j: "#6f5aa0",
  l: "#3a2a52", // legs
  L: "#5b4680",
  e: "#7dff9a", // eyes
  E: "#e8ffe9",
  m: "#c9b8e8", // mandibles
  c: "#38e8ff", // glitch fringe (cyan)
  k: "#ff3df0", // glitch fringe (magenta)
} as const;

const LEG_SETS: [number, number, number, number, number, number][] = [
  // hip x,y → knee x,y → foot x,y
  [14, 30, 6, 26, 3, 33],
  [13, 38, 5, 40, 4, 48],
  [17, 45, 10, 51, 8, 58],
];

function body(step: number, lunge: number): PixelCanvas {
  const k = new PixelCanvas(64, 64);
  const oy = lunge;
  LEG_SETS.forEach(([hx, hy, kx, ky, fx, fy], i) => {
    const lift = (i + step) % 2 === 0 ? -1 : 0;
    k.line(hx, hy + oy, kx, ky + oy + lift, "l");
    k.line(kx, ky + oy + lift, fx, fy + oy + lift, "L");
    k.line(kx + 1, ky + oy + lift, fx + 1, fy + oy + lift, "l");
  });
  // antennae
  k.line(27, 13 + oy, 22, 6 + oy, "l");
  k.line(22, 6 + oy, 17, 5 + oy - step, "L");
  k.px(16, 4 + oy - step, "e");
  // shell dome and head
  k.ellipse(32, 29 + oy, 22, 19, ["1", "2", "3", "4"]);
  k.ellipse(32, 47 + oy, 12 + lunge * 0.3, 8, ["h", "H", "j"]);
  k.mirror();
  return k;
}

function details(k: PixelCanvas, oy: number, open: boolean, blink: boolean, hurt = false) {
  // seam between the wing cases
  k.line(31, 11 + oy, 31, 40 + oy, "s");
  k.line(32, 11 + oy, 32, 40 + oy, "1");
  // hex spots: a pair of 0/x glyph spots on each wing case
  const spots: Grid = [".ss.", "s..s", "s..s", ".ss."];
  const xs: Grid = ["s..s", ".ss.", ".ss.", "s..s"];
  k.stamp(spots, 19, 20 + oy);
  k.stamp(xs, 24, 29 + oy);
  k.stamp(xs, 36, 20 + oy);
  k.stamp(spots, 41, 29 + oy);
  // shell shine
  k.rect(18, 15 + oy, 3, 1, "4");
  k.rect(17, 16 + oy, 2, 1, "4");
  // eyes
  const eye: Grid = hurt ? ["e..e", ".ee.", ".ee.", "e..e"] : blink ? ["....", "eeee", "...."] : [".Ee.", "eEee", "eeee", ".ee."];
  k.stamp(eye, 24, 44 + oy);
  k.stamp(eye, 36, 44 + oy, true);
  // mandibles
  const man: Grid = open ? ["m...", ".m..", ".mm.", "..m."] : ["..m.", "..m.", ".mm.", "m..."];
  k.stamp(man, 26, 53 + oy);
  k.stamp(man, 34, 53 + oy, true);
}

/** Tear `rows` horizontally by `dx` and add an RGB fringe: the bug "glitches". */
function glitch(k: PixelCanvas, y0: number, rows: number, dx: number) {
  for (let y = y0; y < y0 + rows; y++) {
    const row = k.g[y].slice();
    for (let x = 0; x < k.w; x++) k.g[y][x] = row[x - dx] ?? ".";
    const first = k.g[y].findIndex((c) => c !== ".");
    const last = k.g[y].length - 1 - [...k.g[y]].reverse().findIndex((c) => c !== ".");
    if (first >= 0) {
      k.px(first - 1, y, "c");
      k.px(last + 1, y, "k");
    }
  }
}

interface Pose {
  step?: number;
  lunge?: number;
  open?: boolean;
  blink?: boolean;
  hurt?: boolean;
  tear?: [number, number, number];
}

function frame(o: Pose): Grid {
  const lunge = o.lunge ?? 0;
  const k = body(o.step ?? 0, lunge);
  details(k, lunge, !!o.open, !!o.blink, o.hurt);
  k.outline("o");
  if (o.tear) glitch(k, ...o.tear);
  return k.toGrid();
}

/** From behind: the shell fills the view, wing cases slightly parted, a stinger-like tail tip. */
function backFrame(o: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const oy = -(o.lunge ?? 0);
  const step = o.step ?? 0;
  LEG_SETS.forEach(([hx, hy, kx, ky, fx, fy], i) => {
    const lift = (i + step) % 2 === 0 ? -1 : 0;
    k.line(hx, hy + 4 + oy, kx - 1, ky + 4 + oy + lift, "l");
    k.line(kx - 1, ky + 4 + oy + lift, fx - 1, Math.min(62, fy + 4) + oy + lift, "L");
  });
  // antenna tips peeking over the shell
  k.line(26, 12 + oy, 20, 3 + oy - step, "l");
  k.px(19, 2 + oy - step, "e");
  k.ellipse(32, 56 + oy, 6, 5, ["h", "H", "j"]); // tail tip
  k.ellipse(32, 33 + oy, 25, 23, ["1", "2", "3", "4"]);
  k.mirror();
  // parted wing cases: a dark wedge down the middle, flared open to attack
  for (let y = 12; y <= 54; y++) {
    const half = o.open ? Math.floor((y - 12) / 7) : y < 40 ? 0 : Math.floor((y - 40) / 4);
    k.rect(31 - half, y + oy, 2 + half * 2, 1, "s");
  }
  const spots: Grid = [".ss.", "s..s", "s..s", ".ss."];
  const xs: Grid = ["s..s", ".ss.", ".ss.", "s..s"];
  k.stamp(xs, 17, 22 + oy);
  k.stamp(spots, 22, 33 + oy);
  k.stamp(spots, 38, 33 + oy);
  k.stamp(xs, 43, 22 + oy);
  k.stamp(spots, 25, 44 + oy);
  k.stamp(xs, 35, 44 + oy);
  k.rect(16, 18 + oy, 4, 1, "4");
  k.rect(15, 19 + oy, 2, 1, "4");
  if (o.hurt) for (const [x, y] of [[8, 8], [52, 6]]) k.stamp(["e.e", ".E.", "e.e"], x, y);
  k.outline("o");
  if (o.tear) glitch(k, ...o.tear);
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frame : backFrame;
  return {
    name: `Glitchit (${side})`,
    palette,
    idle: [f({ step: 0 }), f({ step: 1 }), f({ step: 0, tear: [24, 3, 3] }), f({ step: 1, blink: true })],
    anims: {
      attack: [f({ step: 0, open: true }), f({ step: 1, lunge: 3, open: true }), f({ step: 0, lunge: 3, open: false, tear: [30, 4, -3] })],
      hurt: [f({ hurt: true, tear: [18, 5, 4] }), f({ step: 1, hurt: true, tear: [36, 4, -3] })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const GLITCHIT_ART: CreatureArt = { id: "glitchit", name: "Glitchit", front: sheet("front"), back: sheet("back") };
export const GLITCHIT = GLITCHIT_ART.front;
