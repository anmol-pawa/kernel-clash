import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Bytling: the starter and title-screen mascot, a round little process-sprite
 * with a program-counter gem on its forehead, two antenna "pins", stubby arms
 * and circuit traces on its flanks. Its back carries a heat-sink vent and a
 * status LED. Original design.
 */
const palette = {
  o: "#170f2e", // outline
  1: "#23336e", // body ramp, dark → light
  2: "#2f5fb8",
  3: "#4f95e8",
  4: "#9fd4ff",
  a: "#c79a52", // belly ramp
  b: "#efcf8a",
  c: "#fff1c8",
  w: "#ffffff",
  e: "#120c24", // pupil / mouth
  r: "#ff7aa8", // blush / tongue
  g: "#d22a64", // gem ramp
  G: "#ff5c8a",
  H: "#ffd0dd",
  y: "#e8a52a", // antenna tip
  Y: "#ffe27a",
  s: "#3a2a5c", // stalk
  f: "#1b2552", // feet
  F: "#2a3d80",
  t: "#7ff0d8", // circuit trace glow
} as const;

const EYE_OPEN: Grid = ["..ww..", ".wwwww", "wwweee", "wweeee", "wweewe", ".weee.", "..ee.."];
const EYE_FOCUS: Grid = ["......", "eeeee.", "wwwwee", "wwweee", ".weee.", "......", "......"];
const EYE_SHUT: Grid = ["......", "......", "......", "eeeeee", ".eeee.", "......", "......"];
const EYE_HURT: Grid = ["e.....", ".ee...", "...ee.", ".....e", "...ee.", ".ee...", "e....."];
const GEM: Grid = ["...H...", "..HGG..", ".HGGGG.", "HGGGGGg", ".GGGgg.", "..ggg..", "...g..."];
const GEM_LIT: Grid = ["...w...", "..wHH..", ".wHHHH.", "wHHHHHG", ".HHHGG.", "..GGG..", "...G..."];
const TIP: Grid = ["..yy..", ".yYYy.", "yYYYyy", "yYYyyy", ".yyyy.", "..yy.."];
const TIP_LIT: Grid = ["..YY..", ".YwwY.", "YwwwYY", "YwwYYy", ".YYYy.", "..YY.."];
/** circuit trace with a pad, drawn on the left flank (mirrored later) */
const TRACE: Grid = ["t....", "1....", "1....", "1111t"];

interface Pose {
  bob?: number; // 0..1 breathing
  squash?: number; // + wider/shorter, - taller/thinner
  lean?: number; // px forward (front: down toward the viewer)
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "smile" | "open" | "wince";
  lit?: boolean; // gem + antenna tips charged
  arms?: number; // arm raise in px
}

function frontFrame(p: Pose): Grid {
  const S = 64;
  const k = new PixelCanvas(S, S);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const ry = 19 - sq * 2 + bob * 0.6;
  const rx = 23 + sq * 2 - bob * 0.4;
  const cy = 58 - ry - 3 + (p.lean ?? 0);
  const top = cy - ry;
  // antenna stalks + tips (first, so the head overlaps their roots)
  k.line(23, top + 4, 15, top - 7, "s");
  k.line(24, top + 4, 16, top - 7, "s");
  k.stamp(p.lit ? TIP_LIT : TIP, 10, Math.round(top - 13));
  // feet
  k.ellipse(19, 58, 7, 3.4, ["f", "F"]);
  // arms: little nubs on the sides
  k.ellipse(9.5, cy + 4 - (p.arms ?? 0), 4.5, 4, ["1", "2", "3"]);
  // body
  k.ellipse(32, cy, rx, ry, ["1", "2", "3", "4"]);
  // belly
  k.ellipse(32, cy + ry * 0.38, rx * 0.56, ry * 0.42, ["a", "b", "c"]);
  k.stamp(TRACE, 13, Math.round(cy - 2));
  k.mirror();
  // face (after mirroring so the highlights stay top-left)
  const ey = Math.round(cy - ry * 0.42);
  const eye = { open: EYE_OPEN, focus: EYE_FOCUS, shut: EYE_SHUT, hurt: EYE_HURT }[p.eyes ?? "open"];
  k.stamp(eye, 19, ey);
  k.stamp(eye, 39, ey, true);
  k.rect(17, ey + 8, 4, 1, "r");
  k.rect(43, ey + 8, 4, 1, "r");
  const my = ey + 8;
  if (p.mouth === "open") k.stamp([".eeeee.", "eerrree", ".eeeee."], 29, my);
  else if (p.mouth === "wince") k.stamp(["e.e.e.e", ".e.e.e."], 29, my + 1);
  else k.stamp(["e.....e", ".eeeee."], 29, my);
  k.stamp(p.lit ? GEM_LIT : GEM, 29, Math.round(top + 2));
  k.outline("o");
  return k.toGrid();
}

/** Seen from behind: no face, a heat-sink vent and a status LED on its back. */
function backFrame(p: Pose): Grid {
  const S = 64;
  const k = new PixelCanvas(S, S);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const ry = 21 - sq * 2 + bob * 0.6;
  const rx = 25 + sq * 2 - bob * 0.4;
  const cy = 61 - ry - (p.lean ?? 0);
  const top = cy - ry;
  k.line(23, top + 5, 14, top - 7, "s");
  k.line(24, top + 5, 15, top - 7, "s");
  k.stamp(p.lit ? TIP_LIT : TIP, 9, Math.round(top - 13));
  k.ellipse(8, cy + 2 - (p.arms ?? 0), 5, 4.5, ["1", "2", "3"]);
  k.ellipse(32, cy, rx, ry, ["1", "2", "3", "4"]);
  k.mirror();
  // heat-sink vent: slats with a lit top edge
  const vy = Math.round(cy - 2);
  for (let i = 0; i < 4; i++) {
    k.rect(25, vy + i * 3, 14, 1, "1");
    k.rect(26, vy + i * 3 + 1, 12, 1, "3");
  }
  k.rect(24, vy - 1, 1, 12, "1");
  k.rect(39, vy - 1, 1, 12, "1");
  // status LED (lit = charged)
  k.stamp(p.lit ? [".Y.", "YwY", ".Y."] : [".t.", "t4t", ".t."], 30, Math.round(top + 5));
  // circuit traces round the flanks
  k.stamp(TRACE, 12, Math.round(cy - 1));
  k.stamp(TRACE, 47, Math.round(cy - 1), true);
  if (p.eyes === "hurt") for (const [x, y] of [[10, top + 2], [53, top + 4], [56, top + 9]] as const) k.stamp(["w.w", ".w.", "w.w"], x, Math.round(y));
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Bytling (${side})`,
    palette,
    idle: [f({}), f({ bob: 1 }), f({}), f({ bob: 1, eyes: "shut" })],
    anims: {
      attack: [f({ squash: 1.2, eyes: "focus", arms: 2 }), f({ squash: -1, lean: 3, eyes: "focus", mouth: "open", lit: true, arms: 5 }), f({ lean: 1, mouth: "open", lit: true, arms: 3 })],
      hurt: [f({ squash: 1.5, eyes: "hurt", mouth: "wince" }), f({ squash: 0.6, eyes: "hurt", mouth: "wince" })],
    },
    fps: { idle: 2.5, attack: 6, hurt: 6 },
  };
}

export const BYTLING_ART: CreatureArt = { id: "bytling", name: "Bytling", front: sheet("front"), back: sheet("back") };
/** Front sheet, used by the title screen. */
export const BYTLING = BYTLING_ART.front;
