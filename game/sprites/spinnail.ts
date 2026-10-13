import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Spinnail: the storage-type starter, a slow and steady lime snail whose
 * shell is a disk platter in a green casing: concentric tracks round a steel
 * spindle, with a bright sector that sweeps round as the platter spins. Its
 * eyes ride on long stalks, like a pair of read heads.
 * Original design.
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
  g: "#2a6e3a", // shell casing ramp
  G: "#3f9a50",
  H: "#7fd68a",
  y: "#d9a22c", // bright sector / spindle cap
  Y: "#ffe27a",
  w: "#ffffff",
  e: "#121a10", // pupils / mouth
  r: "#ff8a9c", // blush / tongue
  R: "#c9475f",
  L: "#a6e4ff", // slime sheen
} as const;

const BODY = ["1", "2", "3", "4"];

const EYE_OPEN: Grid = [".wwww.", "wwwwww", "wwweew", "wwewew", "wweeew", ".wwww."];
const EYE_FOCUS: Grid = ["......", "eeeeee", "wwweew", "wwewew", "wweeew", ".wwww."];
const EYE_SHUT: Grid = ["......", "......", "......", "eeeeee", ".eeee.", "......"];
const EYE_HURT: Grid = [".wwww.", "wewwew", "wweeww", "wweeww", "wewwew", ".wwww."];

interface Pose {
  bob?: number;
  squash?: number;
  lean?: number; // px toward the viewer (front) / up the screen (back)
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "smile" | "open" | "wince";
  spin?: number; // platter angle, quarter turns
  lit?: boolean; // platter spun up, sector blazing
  stalk?: number; // stalk length offset: + longer, - retracted
  droop?: boolean; // stalks flop sideways
}

/** The platter shell: casing rim, steel disc, track rings, a swept sector and the spindle. */
function platter(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, spin: number, lit: boolean) {
  k.ellipse(cx, cy, rx, ry, ["g", "G", "H"]);
  k.ellipse(cx, cy, rx - 3, ry - 3, ["S", "t", "T"], [-0.4, -0.5]);
  const a0 = (spin * Math.PI) / 2 - Math.PI / 2;
  const span = lit ? Math.PI * 0.9 : Math.PI * 0.45;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / (rx - 3);
      const dy = (y + 0.5 - cy) / (ry - 3);
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      // track rings
      for (const r of [0.78, 0.56]) if (Math.abs(d - r) < 0.045) k.px(x, y, "s");
      // the sector under the head: a wedge between two track rings
      let a = Math.atan2(dy, dx) - a0;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (d > 0.3 && d < 0.94 && a < span && Math.abs(d - 0.78) >= 0.045 && Math.abs(d - 0.56) >= 0.045)
        k.px(x, y, a < span * 0.35 ? (lit ? "w" : "Y") : "y");
    }
  k.ellipse(cx, cy, 3, 3, ["s", "S", "T"]);
  k.px(cx - 1, cy - 1, "w");
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  // the shell rides behind and above the body
  const scx = 32;
  const scy = 30 + bob * 0.5 + sq;
  platter(k, scx, scy, 20 - sq * 0.5, 18 - sq, p.spin ?? 0, !!p.lit);
  // foot: a wide soft slug base
  k.ellipse(32, 55, 27 + sq * 1.5, 7.5 - sq * 0.5, BODY);
  // head and neck rising in front of the shell
  const hy = 40 + sq * 1.5 + lean - bob * 0.5;
  // eye stalks rise from behind the crown, so the head covers their roots
  const st = p.stalk ?? 0;
  const tip = Math.round(hy - 32 - st + bob);
  const tx = p.droop ? 4 : 12 - Math.round(st * 0.5);
  k.tube([28, hy - 4], [24, hy - 18], [tx + 4, tip + 4], 2.6, 1.8, ["2", "3", "4"]);
  k.ellipse(32, hy + 6, 11 + sq, 9, BODY);
  k.ellipse(32, hy, 13 + sq, 10.5 - sq * 0.4, BODY);
  // eyes on the stalk tips
  k.ellipse(tx + 4, tip + 3.5, 5, 5, ["2", "3", "4"]);
  k.mirror();
  const eye = { open: EYE_OPEN, focus: EYE_FOCUS, shut: EYE_SHUT, hurt: EYE_HURT }[p.eyes ?? "open"];
  k.stamp(eye, tx + 1, tip + 1);
  k.stamp(eye, 64 - tx - 7, tip + 1, true);
  // face
  const fy = Math.round(hy + 1);
  k.rect(22, fy, 3, 1, "r");
  k.rect(39, fy, 3, 1, "r");
  if (p.mouth === "open") k.stamp([".eeeee.", "eRrrrRe", ".eeeee."], 29, fy + 1);
  else if (p.mouth === "wince") k.stamp(["e.e.e.e", ".e.e.e."], 29, fy + 2);
  else k.stamp(["e.....e", ".eeeee."], 29, fy + 1);
  // a slime sheen along the foot
  k.rect(12, 57, 6, 1, "L");
  k.rect(47, 57, 4, 1, "L");
  k.outline("o");
  return k.toGrid();
}

/** Seen from behind: the whole platter face, the foot below and the eye stalks peeking over the top. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const st = p.stalk ?? 0;
  const scy = 34 + bob * 0.5 + sq - lean;
  // stalks first: they rise from the hidden head behind the shell
  const tip = Math.round(scy - 32 - st + bob);
  const tx = p.droop ? 8 : 18 - Math.round(st * 0.3);
  k.tube([28, scy - 10], [25, scy - 22], [tx + 3, tip + 3], 2.4, 1.8, ["2", "3", "4"]);
  k.ellipse(tx + 3, tip + 2.5, 4, 4, ["2", "3", "4"]);
  // the foot spreading out under the shell
  k.ellipse(32, 58, 30 + sq * 1.5, 6 - sq * 0.5, BODY, [-0.4, -0.9]);
  k.mirror();
  platter(k, 32, scy, 26 - sq * 0.5, 24 - sq, -(p.spin ?? 0), !!p.lit);
  if (p.eyes === "hurt") for (const [x, y] of [[4, scy - 22], [55, scy - 24], [58, scy - 18]] as const) k.stamp(["w.w", ".w.", "w.w"], x, Math.round(y));
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Spinnail (${side})`,
    palette,
    idle: [f({ spin: 0 }), f({ spin: 1, bob: 1 }), f({ spin: 2 }), f({ spin: 3, bob: 1, eyes: "shut" })],
    anims: {
      attack: [f({ squash: 1, stalk: -4, eyes: "focus", spin: 0, lit: true }), f({ squash: -1, lean: 3, stalk: 2, eyes: "focus", mouth: "open", spin: 2, lit: true }), f({ lean: 1, mouth: "open", spin: 3, lit: true })],
      hurt: [f({ squash: 1.4, eyes: "hurt", mouth: "wince", droop: true, stalk: -2 }), f({ squash: 0.6, eyes: "hurt", mouth: "wince", droop: true })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const SPINNAIL_ART: CreatureArt = { id: "spinnail", name: "Spinnail", front: sheet("front"), back: sheet("back") };
