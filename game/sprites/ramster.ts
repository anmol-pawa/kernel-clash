import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Ramster: the memory-type starter, a plump indigo hamster that hugs a RAM
 * stick to its belly and stuffs its cheek pouches like a cache: the cheeks
 * swell as it loads data and glow when the cache is hot. Its back carries a
 * dorsal stripe of gold address bits and a stubby tail. Original design.
 */
const palette = {
  o: "#170f2e", // outline
  1: "#2c2466", // fur ramp, dark → light
  2: "#4b44a8",
  3: "#7a74d8",
  4: "#b4b0f4",
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
  y: "#d79a2a", // gold contacts / address bits
  Y: "#ffe07a",
  h: "#e8b8ff", // cache glow in the cheeks
  f: "#a57a9a", // paws and feet
  F: "#d9a9c4",
} as const;

const FUR = ["1", "2", "3", "4"];
const CREAM = ["a", "b", "d"];

const EYE_OPEN: Grid = [".eeee.", "eewwee", "ewweee", "eeeeee", "eeeewe", ".eeee."];
const EYE_FOCUS: Grid = ["ee....", ".eeee.", "eewwee", "eeeeee", ".eeee.", "......"];
const EYE_SHUT: Grid = ["......", "......", "......", "eeeeee", ".eeee.", "......"];
const EYE_HURT: Grid = ["e....e", ".e..e.", "..ee..", "..ee..", ".e..e.", "e....e"];

interface Pose {
  bob?: number; // 0..1 breathing
  squash?: number; // + wider/shorter, - taller/thinner
  lean?: number; // px toward the viewer (front) / up the screen (back)
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "smile" | "open" | "wince";
  cheeks?: number; // 0 flat .. 1 stuffed .. 1.5 bursting
  lit?: boolean; // RAM stick + cheeks glowing
  arms?: number; // how high the RAM stick is lifted, px
  whisk?: boolean; // whisker twitch
}

/** A RAM stick, `w` wide: green board, black chips, gold contacts along the bottom. */
function ramStick(k: PixelCanvas, x: number, y: number, w: number, lit: boolean) {
  k.rect(x, y, w, 7, "p");
  k.rect(x, y, w, 1, "P");
  for (let cx = x + 2; cx + 4 <= x + w - 1; cx += 6) {
    k.rect(cx, y + 2, 4, 3, lit ? "h" : "n");
    k.rect(cx, y + 2, 4, 1, lit ? "w" : "N");
  }
  for (let gx = x + 1; gx < x + w - 1; gx += 2) k.px(gx, y + 6, lit ? "Y" : "y");
  k.px(x + (w >> 1), y + 6, "p"); // the key notch
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const ch = p.cheeks ?? 0.4;
  const bry = 16 - sq * 1.5 + bob * 0.5;
  const brx = 20 + sq * 1.5 - bob * 0.3;
  const bcy = 60 - bry - 1;
  const hcy = 23 + sq * 1.5 - bob * 0.3 + lean;
  // feet, body and belly
  k.ellipse(22, 60, 6, 3, ["f", "F"]);
  k.ellipse(32, bcy, brx, bry, FUR);
  k.ellipse(32, bcy + 3, brx * 0.62, bry * 0.7, CREAM);
  // ears, then the head over their roots
  k.ellipse(17, hcy - 11, 5.5, 5.5, FUR);
  k.ellipse(17.5, hcy - 10.5, 3, 3, ["R", "r"]);
  k.ellipse(32, hcy, 17 + sq, 13.5 - sq * 0.5, FUR);
  // cheek pouches: the cache. They swell as data is loaded.
  k.ellipse(17.5 - ch, hcy + 5, 6 + ch * 2.5, 5.5 + ch * 1.8, p.lit ? ["4", "h", "w"] : ["3", "4", "d"]);
  k.mirror();
  // muzzle, eyes, nose, mouth and teeth
  k.ellipse(32, hcy + 6.5, 7, 5, CREAM);
  const eye = { open: EYE_OPEN, focus: EYE_FOCUS, shut: EYE_SHUT, hurt: EYE_HURT }[p.eyes ?? "open"];
  const ey = Math.round(hcy - 5);
  k.stamp(eye, 20, ey);
  k.stamp(eye, 38, ey, true);
  k.rect(16, ey + 7, 3, 1, "r");
  k.rect(45, ey + 7, 3, 1, "r");
  const ny = Math.round(hcy + 3);
  k.stamp(["rrr", ".R."], 31, ny);
  if (p.mouth === "open") k.stamp(["e...e", "eeeee", "ewRwe", "eRRRe", ".eee."], 30, ny + 2);
  else if (p.mouth === "wince") k.stamp(["e.e.e", ".e.e."], 30, ny + 3);
  else k.stamp(["e.e.e", ".e.e.", "..w..", "..w.."], 30, ny + 2);
  // whiskers
  const wy = ny + (p.whisk ? 1 : 2);
  for (const [dx, dy] of [[0, 0], [1, 2]] as const) {
    k.line(22 - dx, wy + dy, 16 - dx, wy + dy - (p.whisk ? 2 : 1), "1");
    k.line(42 + dx, wy + dy, 48 + dx, wy + dy - (p.whisk ? 2 : 1), "1");
  }
  // the RAM stick it hugs, with paws at both ends
  const sy = Math.round(bcy - 1 - (p.arms ?? 0));
  ramStick(k, 19, sy, 27, !!p.lit);
  k.ellipse(18.5, sy + 4, 3.5, 3.5, ["f", "F"]);
  k.ellipse(45.5, sy + 4, 3.5, 3.5, ["f", "F"]);
  k.outline("o");
  return k.toGrid();
}

/** Seen from behind: a round furry back, address-bit stripe, tail nub, cheeks bulging out at the sides. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const ch = p.cheeks ?? 0.4;
  const bry = 18 - sq * 1.5 + bob * 0.5;
  const brx = 23 + sq * 1.5 - bob * 0.3;
  const bcy = 63 - bry;
  const hcy = 24 + sq * 1.5 - bob * 0.3 - (p.lean ?? 0);
  k.ellipse(32, bcy, brx, bry, FUR, [-0.5, -0.9]);
  k.ellipse(15.5 - ch, hcy + 6, 6 + ch * 2.5, 5.5 + ch * 1.8, p.lit ? ["4", "h", "w"] : ["3", "4", "d"]);
  k.ellipse(17, hcy - 11, 5.5, 5.5, FUR);
  k.ellipse(32, hcy, 17.5 + sq, 14 - sq * 0.5, FUR, [-0.5, -0.2]);
  // the scruff where head meets back, so it reads as one body
  k.ellipse(32, hcy + 11, 14 + sq, 6, ["3", "4"], [-0.4, 0.1]);
  // paws peeking out at the sides, holding the stick up when attacking
  k.ellipse(9.5, bcy - 2 - (p.arms ?? 0), 4, 4, ["f", "F"]);
  k.mirror();
  // dorsal stripe of address bits running from the crown down the back
  const top = Math.round(hcy - 9);
  const bottom = Math.round(bcy + bry * 0.55);
  for (let y = top; y <= bottom; y++) {
    k.rect(30, y, 4, 1, "1");
    if ((y - top) % 3 === 1) k.rect(31, y, 2, 1, p.lit ? "Y" : "y");
  }
  // the tip of the RAM stick over its head when it lifts it
  if ((p.arms ?? 0) > 3) ramStick(k, 19, Math.round(hcy - 17 - (p.arms ?? 0) * 0.5), 27, !!p.lit);
  // tail nub
  k.ellipse(32, bottom + 1, 3, 2.5, ["f", "F"]);
  if (p.eyes === "hurt") for (const [x, y] of [[8, hcy - 12], [53, hcy - 10], [56, hcy - 4]] as const) k.stamp(["w.w", ".w.", "w.w"], x, Math.round(y));
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Ramster (${side})`,
    palette,
    idle: [f({}), f({ bob: 1, cheeks: 0.8, whisk: true }), f({ cheeks: 1 }), f({ bob: 1, eyes: "shut", cheeks: 0.6 })],
    anims: {
      attack: [f({ squash: 1, eyes: "focus", cheeks: 1.5, lit: true }), f({ squash: -1, lean: 3, eyes: "focus", mouth: "open", cheeks: 0.2, lit: true, arms: 8 }), f({ lean: 1, mouth: "open", cheeks: 0, arms: 3 })],
      hurt: [f({ squash: 1.4, eyes: "hurt", mouth: "wince", cheeks: 0 }), f({ squash: 0.6, eyes: "hurt", mouth: "wince", cheeks: 0.2 })],
    },
    fps: { idle: 2.5, attack: 6, hurt: 6 },
  };
}

export const RAMSTER_ART: CreatureArt = { id: "ramster", name: "Ramster", front: sheet("front"), back: sheet("back") };
