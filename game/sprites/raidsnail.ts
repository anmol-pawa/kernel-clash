import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Raidsnail: Spinnail's evolved form. Its shell has grown into a mirrored
 * pair of platters (RAID 1), one stacked on the other, so nothing it stores
 * is lost if one disk fails. A steel actuator arm sweeps a read head over
 * the top platter, its eye stalks end in visored read heads, and a green
 * casing plate armours its brow. Original design.
 */
const palette = {
  o: "#13200f", // outline
  1: "#2c5a1c", // body ramp, dark → light
  2: "#4f8f2a",
  3: "#86c63c",
  4: "#c8f07a",
  s: "#3b4452", // platter ramp (steel)
  S: "#68768a",
  t: "#9eabbd",
  T: "#d5dde8",
  g: "#1f5a2e", // shell casing ramp
  G: "#3f9a50",
  H: "#7fd68a",
  y: "#d9a22c", // bright sector / spindle cap / LEDs
  Y: "#ffe27a",
  w: "#ffffff",
  e: "#121a10", // pupils / mouth
  r: "#ff8a9c", // blush / tongue
  R: "#c9475f",
  L: "#a6e4ff", // slime sheen / visor glass
} as const;

const BODY = ["1", "2", "3", "4"];
const CASE = ["g", "G", "H"];

const EYE_OPEN: Grid = ["LLLLLL", "wwwwww", "wwweew", "wwewew", "wweeew", ".wwww."];
const EYE_FOCUS: Grid = ["LLLLLL", "eeeeee", "wwweew", "wwewew", "wweeew", ".wwww."];
const EYE_SHUT: Grid = ["LLLLLL", "......", "......", "eeeeee", ".eeee.", "......"];
const EYE_HURT: Grid = ["LLLLLL", "wewwew", "wweeww", "wweeww", "wewwew", ".wwww."];

interface Pose {
  bob?: number;
  squash?: number;
  lean?: number;
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "smile" | "open" | "wince";
  spin?: number; // platter angle, quarter turns
  lit?: boolean; // platters spun up, sectors blazing
  stalk?: number; // + longer, - retracted
  droop?: boolean;
  seek?: number; // actuator arm angle, 0..1
}

/** One platter: casing rim, steel disc, track rings, a swept sector and the spindle. */
function platter(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, spin: number, lit: boolean) {
  k.ellipse(cx, cy, rx, ry, CASE);
  k.ellipse(cx, cy, rx - 3, ry - 3, ["S", "t", "T"], [-0.4, -0.5]);
  const a0 = (spin * Math.PI) / 2 - Math.PI / 2;
  const span = lit ? Math.PI * 0.9 : Math.PI * 0.45;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / (rx - 3);
      const dy = (y + 0.5 - cy) / (ry - 3);
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const ring = [0.8, 0.6, 0.42].some((r) => Math.abs(d - r) < 0.04);
      if (ring) k.px(x, y, "s");
      let a = Math.atan2(dy, dx) - a0;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (!ring && d > 0.3 && d < 0.94 && a < span) k.px(x, y, a < span * 0.35 ? (lit ? "w" : "Y") : "y");
    }
  k.ellipse(cx, cy, 3, 3, ["s", "S", "T"]);
  k.px(cx - 1, cy - 1, "w");
}

/** The mirrored pair: the lower platter's casing edge peeks out under the top one. */
function raidStack(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, spin: number, lit: boolean) {
  k.ellipse(cx, cy + 6, rx, ry, ["g", "g", "G"]);
  // a band of activity LEDs along the lower disk's edge
  for (let i = -3; i <= 3; i++) k.px(cx + i * 4, Math.round(cy + ry + 4 - Math.abs(i) * 0.6), lit || i % 2 === 0 ? "Y" : "y");
  platter(k, cx, cy, rx, ry, spin, lit);
}

/** The actuator arm: a steel bar from a pivot at the rim, with a read head at its tip. */
/** `base` is the arm angle in half-turns at seek 0; seeking swings it a further 0.25 half-turns. */
function actuator(k: PixelCanvas, px: number, py: number, len: number, base: number, seek: number) {
  const a = Math.PI * (base + seek * 0.25);
  const hx = px + Math.cos(a) * len;
  const hy = py + Math.sin(a) * len * 0.8;
  k.line(px, py, Math.round(hx), Math.round(hy), "s");
  k.line(px, py - 1, Math.round(hx), Math.round(hy) - 1, "T");
  k.ellipse(px, py, 2.5, 2.5, ["s", "S", "T"]);
  k.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, "y");
  k.px(Math.round(hx), Math.round(hy) - 1, "Y");
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const scy = 25 + bob * 0.5 + sq;
  raidStack(k, 32, scy, 24 - sq * 0.5, 17 - sq, p.spin ?? 0, !!p.lit);
  actuator(k, 52, Math.round(scy - 9), 14, 0.8, p.seek ?? 0);
  // the foot: a broad slug base with ridged armour
  const fp = new PixelCanvas(64, 64);
  fp.ellipse(32, 56, 30 + sq * 1.5, 7 - sq * 0.5, BODY);
  for (let x = 6; x <= 58; x += 6) fp.px(x, 53, "1");
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (fp.g[y][x] !== ".") k.g[y][x] = fp.g[y][x];
  // eye stalks first (behind the head), then the head
  const hy = 41 + sq * 1.5 + lean - bob * 0.5;
  const st = p.stalk ?? 0;
  const tip = Math.round(hy - 30 - st + bob);
  const tx = p.droop ? 2 : 9 - Math.round(st * 0.5);
  const half = new PixelCanvas(64, 64);
  half.tube([27, hy - 4], [20, hy - 16], [tx + 4, tip + 4], 3, 2, ["2", "3", "4"]);
  half.ellipse(32, hy + 6, 13 + sq, 9, BODY);
  half.ellipse(32, hy, 15 + sq, 11 - sq * 0.4, BODY);
  // the casing plate on its brow, with a vent slot
  half.ellipse(32, hy - 7, 9, 4, CASE, [-0.3, -0.9]);
  half.ellipse(tx + 4, tip + 3.5, 5.5, 5.5, ["2", "3", "4"]);
  half.mirror();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (half.g[y][x] !== ".") k.g[y][x] = half.g[y][x];
  k.rect(28, Math.round(hy - 8), 8, 1, "g");
  const eye = { open: EYE_OPEN, focus: EYE_FOCUS, shut: EYE_SHUT, hurt: EYE_HURT }[p.eyes ?? "open"];
  k.stamp(eye, tx + 1, tip + 1);
  k.stamp(eye, 64 - tx - 7, tip + 1, true);
  const fy = Math.round(hy + 1);
  k.rect(21, fy, 3, 1, "r");
  k.rect(40, fy, 3, 1, "r");
  if (p.mouth === "open") k.stamp([".eeeee.", "eRrrrRe", ".eeeee."], 29, fy + 1);
  else if (p.mouth === "wince") k.stamp(["e.e.e.e", ".e.e.e."], 29, fy + 2);
  else k.stamp(["e.....e", ".eeeee."], 29, fy + 1);
  k.rect(8, 59, 7, 1, "L");
  k.rect(49, 59, 5, 1, "L");
  k.outline("o");
  return k.toGrid();
}

/** Seen from behind: the full top platter over its mirror twin, the actuator, the stalks over the top. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const st = p.stalk ?? 0;
  const scy = 31 + bob * 0.5 + sq - lean;
  const tip = Math.round(scy - 30 - st + bob);
  const tx = p.droop ? 6 : 14 - Math.round(st * 0.3);
  k.tube([27, scy - 10], [22, scy - 20], [tx + 3, tip + 3], 2.6, 2, ["2", "3", "4"]);
  k.ellipse(tx + 3, tip + 2.5, 4.5, 4.5, ["2", "3", "4"]);
  k.rect(tx, tip, 7, 1, "L");
  k.ellipse(32, 58, 31 + sq * 1.5, 6 - sq * 0.5, BODY, [-0.4, -0.9]);
  k.mirror();
  raidStack(k, 32, scy, 27 - sq * 0.5, 21 - sq, -(p.spin ?? 0), !!p.lit);
  actuator(k, 11, Math.round(scy - 11), 17, -0.05, p.seek ?? 0);
  if (p.eyes === "hurt") for (const [x, y] of [[2, scy - 20], [55, scy - 22], [58, scy - 16]] as const) k.stamp(["w.w", ".w.", "w.w"], x, Math.round(y));
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Raidsnail (${side})`,
    palette,
    idle: [f({ spin: 0, seek: 0 }), f({ spin: 1, bob: 1, seek: 0.4 }), f({ spin: 2, seek: 0.8 }), f({ spin: 3, bob: 1, eyes: "shut", seek: 0.4 })],
    anims: {
      attack: [f({ squash: 1, stalk: -4, eyes: "focus", spin: 0, lit: true, seek: 1 }), f({ squash: -1, lean: 3, stalk: 2, eyes: "focus", mouth: "open", spin: 2, lit: true, seek: 0 }), f({ lean: 1, mouth: "open", spin: 3, lit: true, seek: 0.5 })],
      hurt: [f({ squash: 1.4, eyes: "hurt", mouth: "wince", droop: true, stalk: -2, seek: 1 }), f({ squash: 0.6, eyes: "hurt", mouth: "wince", droop: true, seek: 1 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const RAIDSNAIL_ART: CreatureArt = { id: "raidsnail", name: "Raidsnail", front: sheet("front"), back: sheet("back") };
