import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Gigahoard: Ramster's evolved form, a big pear-shaped hamster that hoards
 * memory. It hugs two RAM sticks now (dual channel), wears a gold
 * heat-spreader crest between its ears, and its cheek pouches have grown into
 * a two-level cache that glows when hot. Its back is ridged with a stack of
 * gold address bits. Original design.
 */
const palette = {
  o: "#170f2e", // outline
  1: "#251d5a", // fur ramp, dark → light
  2: "#433c9c",
  3: "#6f68d0",
  4: "#aba6f0",
  a: "#c9a77a", // belly / muzzle ramp
  b: "#ecd6b0",
  d: "#fff6e2",
  w: "#ffffff",
  e: "#120c24", // eyes / mouth
  r: "#ff8fb0", // ears, nose, blush, tongue
  R: "#d04d7c",
  p: "#1e6b4a", // RAM board ramp
  P: "#35a06a",
  n: "#22233a", // memory chips
  N: "#4a4d70",
  y: "#d79a2a", // gold contacts / crest / address bits
  Y: "#ffe07a",
  h: "#e8b8ff", // cache glow
  f: "#a57a9a", // paws and feet
  F: "#d9a9c4",
} as const;

const FUR = ["1", "2", "3", "4"];
const CREAM = ["a", "b", "d"];

const EYE_OPEN: Grid = [".eeee.", "eewwee", "ewweee", "eeeeee", "eeeewe", ".eeee."];
const EYE_FOCUS: Grid = ["eee...", ".eeee.", "eewwee", "eeeeee", ".eeee.", "......"];
const EYE_SHUT: Grid = ["......", "......", "......", "eeeeee", ".eeee.", "......"];
const EYE_HURT: Grid = ["e....e", ".e..e.", "..ee..", "..ee..", ".e..e.", "e....e"];
/** The heat-spreader crest between the ears: a gold fin with cooling slots. */
const CREST: Grid = ["....yyyy....", "...yYYYYy...", "..yYyYyYyy..", ".yYyYyYyYyy.", "yYyYyYyYyYyy", "yyyyyyyyyyyy", ".yyyyyyyyyy."];
const CREST_LIT: Grid = ["....YYYY....", "...YwwwwY...", "..YwYwYwYY..", ".YwYwYwYwYY.", "YwYwYwYwYwYY", "YYYYYYYYYYYY", ".YYYYYYYYYY."];

interface Pose {
  bob?: number;
  squash?: number;
  lean?: number;
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "smile" | "open" | "wince";
  cheeks?: number; // 0 flat .. 1 stuffed .. 1.5 bursting
  lit?: boolean; // RAM sticks, crest and cheeks glowing
  arms?: number; // how high the sticks are lifted, px
  whisk?: boolean;
}

function ramStick(k: PixelCanvas, x: number, y: number, w: number, lit: boolean) {
  k.rect(x, y, w, 6, "p");
  k.rect(x, y, w, 1, "P");
  for (let cx = x + 2; cx + 3 <= x + w - 1; cx += 5) {
    k.rect(cx, y + 2, 3, 2, lit ? "h" : "n");
    k.rect(cx, y + 2, 3, 1, lit ? "w" : "N");
  }
  for (let gx = x + 1; gx < x + w - 1; gx += 2) k.px(gx, y + 5, lit ? "Y" : "y");
  k.px(x + (w >> 1), y + 5, "p");
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const ch = p.cheeks ?? 0.4;
  const arms = p.arms ?? 0;
  // a big pear body: wide at the hips
  const bry = 19 - sq * 1.5 + bob * 0.5;
  const brx = 24 + sq * 1.5 - bob * 0.3;
  const bcy = 61 - bry;
  const hcy = 22 + sq * 1.5 - bob * 0.3 + lean;
  k.ellipse(18, 61, 7, 3, ["f", "F"]);
  k.ellipse(32, bcy, brx, bry, FUR);
  k.ellipse(32, bcy + 4, brx * 0.6, bry * 0.66, CREAM);
  // big ears with tufts
  k.ellipse(15, hcy - 11, 6.5, 6.5, FUR);
  k.ellipse(15.5, hcy - 10.5, 3.5, 3.5, ["R", "r"]);
  k.line(10, hcy - 17, 12, hcy - 13, "4");
  k.ellipse(32, hcy, 18 + sq, 14 - sq * 0.5, FUR);
  // fur ruff along the jaw
  for (let i = 0; i < 4; i++) k.ellipse(13 + i * 2, hcy + 9 + i * 1.2, 2.5, 2.5, ["2", "3"]);
  // two-level cache: an outer L2 pouch and an inner L1 pouch
  const glow = p.lit ? ["4", "h", "w"] : ["3", "4", "d"];
  k.ellipse(12.5 - ch, hcy + 5, 6 + ch * 2, 6 + ch * 1.5, glow);
  k.ellipse(19 - ch * 0.5, hcy + 6, 4.5 + ch, 4.5 + ch, p.lit ? ["h", "w"] : ["4", "d"]);
  k.mirror();
  k.ellipse(32, hcy + 7, 7, 5, CREAM);
  const eye = { open: EYE_OPEN, focus: EYE_FOCUS, shut: EYE_SHUT, hurt: EYE_HURT }[p.eyes ?? "open"];
  const ey = Math.round(hcy - 5);
  k.stamp(eye, 21, ey);
  k.stamp(eye, 37, ey, true);
  // stern brows
  k.line(20, ey - 2, 26, ey - 1, "1");
  k.line(43, ey - 2, 37, ey - 1, "1");
  const ny = Math.round(hcy + 3);
  k.stamp(["rrr", ".R."], 31, ny);
  if (p.mouth === "open") k.stamp(["e...e", "eeeee", "ewRwe", "eRRRe", ".eee."], 30, ny + 2);
  else if (p.mouth === "wince") k.stamp(["e.e.e", ".e.e."], 30, ny + 3);
  else k.stamp(["e.e.e", ".e.e.", "..w..", "..w.."], 30, ny + 2);
  const wy = ny + (p.whisk ? 1 : 2);
  for (const [dx, dy] of [[0, 0], [1, 2]] as const) {
    k.line(24 - dx, wy + dy, 18 - dx, wy + dy - (p.whisk ? 2 : 1), "1");
    k.line(40 + dx, wy + dy, 46 + dx, wy + dy - (p.whisk ? 2 : 1), "1");
  }
  k.stamp(p.lit ? CREST_LIT : CREST, 26, Math.round(hcy - 19));
  // dual-channel RAM: two sticks, paws at the ends
  const sy = Math.round(bcy - 3 - arms);
  ramStick(k, 17, sy, 30, !!p.lit);
  ramStick(k, 17, sy + 7, 30, !!p.lit);
  k.ellipse(16, sy + 6, 4, 4.5, ["f", "F"]);
  k.ellipse(48, sy + 6, 4, 4.5, ["f", "F"]);
  k.outline("o");
  return k.toGrid();
}

/** Seen from behind: a broad back, crest, ears, cheek pouches at the sides and a stack of address bits. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const ch = p.cheeks ?? 0.4;
  const arms = p.arms ?? 0;
  const bry = 20 - sq * 1.5 + bob * 0.5;
  const brx = 26 + sq * 1.5 - bob * 0.3;
  const bcy = 63 - bry;
  const hcy = 23 + sq * 1.5 - bob * 0.3 - (p.lean ?? 0);
  k.ellipse(32, bcy, brx, bry, FUR, [-0.5, -0.9]);
  k.ellipse(11 - ch, hcy + 7, 6 + ch * 2, 6 + ch * 1.5, p.lit ? ["4", "h", "w"] : ["3", "4", "d"]);
  k.ellipse(15, hcy - 11, 6.5, 6.5, FUR);
  k.line(10, hcy - 17, 12, hcy - 13, "4");
  k.ellipse(32, hcy, 18.5 + sq, 14.5 - sq * 0.5, FUR, [-0.5, -0.2]);
  k.ellipse(32, hcy + 12, 16 + sq, 7, ["3", "4"], [-0.4, 0.1]);
  k.ellipse(8, bcy - 3 - arms, 4.5, 4.5, ["f", "F"]);
  k.mirror();
  // two rows of address bits down the back, like a stacked DIMM
  const top = Math.round(hcy - 8);
  const bottom = Math.round(bcy + bry * 0.6);
  for (let y = top; y <= bottom; y++) {
    k.rect(28, y, 3, 1, "1");
    k.rect(33, y, 3, 1, "1");
    if ((y - top) % 3 === 1) {
      k.px(29, y, p.lit ? "Y" : "y");
      k.px(34, y, p.lit ? "Y" : "y");
    }
  }
  k.stamp(p.lit ? CREST_LIT : CREST, 26, Math.round(hcy - 19));
  if (arms > 3) {
    const sy = Math.max(0, Math.round(hcy - 24 - arms * 0.4));
    ramStick(k, 17, sy, 30, !!p.lit);
  }
  k.ellipse(32, bottom + 1, 3.5, 3, ["f", "F"]);
  if (p.eyes === "hurt") for (const [x, y] of [[5, hcy - 13], [53, hcy - 12], [57, hcy - 5]] as const) k.stamp(["w.w", ".w.", "w.w"], x, Math.round(y));
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Gigahoard (${side})`,
    palette,
    idle: [f({}), f({ bob: 1, cheeks: 0.8, whisk: true }), f({ cheeks: 1 }), f({ bob: 1, eyes: "shut", cheeks: 0.6 })],
    anims: {
      attack: [f({ squash: 1, eyes: "focus", cheeks: 1.5, lit: true }), f({ squash: -1, lean: 3, eyes: "focus", mouth: "open", cheeks: 0.2, lit: true, arms: 8 }), f({ lean: 1, mouth: "open", cheeks: 0, arms: 3 })],
      hurt: [f({ squash: 1.4, eyes: "hurt", mouth: "wince", cheeks: 0 }), f({ squash: 0.6, eyes: "hurt", mouth: "wince", cheeks: 0.2 })],
    },
    fps: { idle: 2.5, attack: 6, hurt: 6 },
  };
}

export const GIGAHOARD_ART: CreatureArt = { id: "gigahoard", name: "Gigahoard", front: sheet("front"), back: sheet("back") };
