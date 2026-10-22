import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Seekmole, the Platter Peak Gym's trainer creature: a burrowing mole that
 * carries a spinning disk platter against its belly. A red read-head arm
 * sweeps in and out across the rings (a seek), and the mole follows it with
 * its blind, twitching snout. On the attack it flings the platter spinning
 * overhead; hurt, it flinches and the head skips a track.
 * Original design, 64×64.
 */
const palette = {
  o: "#101a08", // outline
  1: "#2c4a14", // fur ramp (gym green), dark → light
  2: "#4a7a1e",
  3: "#7cb83a",
  4: "#c4ec7a",
  n: "#d98a8a", // snout / paws, dark → light
  N: "#f0b4b4",
  B: "#ffe0e0",
  e: "#0c0c14", // pupils
  w: "#ffffff",
  s: "#2a3340", // platter slate ramp, dark → light
  S: "#4a5870",
  l: "#8496b0",
  L: "#c8d6ea",
  h: "#d8382c", // read head
  H: "#ff8a70",
  c: "#f0e0b8", // claws
  d: "#5a4020", // dirt
  D: "#8a6a3c",
} as const;

const FUR = ["1", "2", "3", "4"];
const SKIN = ["n", "N", "B"];

interface Pose {
  bob?: number;
  /** body squash (crouch / hurt) in px */
  squat?: number;
  /** read-head position along the radius, 0 = hub, 1 = rim */
  seek?: number;
  /** 0 = platter at the belly, 1 = flung up and out */
  fling?: number;
  /** platter width squash while it spins (1 = face-on) */
  spin?: number;
  hurt?: boolean;
}

function mound(k: PixelCanvas) {
  k.ellipse(32, 62, 30, 6, ["d", "D", "D"]);
  for (const x of [10, 24, 40, 52]) k.px(x, 58, "o");
}

/** The platter: concentric tracks around a hub, with the read head resting at `seek`. */
function platter(k: PixelCanvas, cx: number, cy: number, r: number, spin: number, seek: number) {
  const rx = Math.max(2, r * spin);
  k.ellipse(cx, cy, rx, r, ["s", "S", "S"]);
  const rings: [number, string[]][] = [[0.82, ["S", "l", "l"]], [0.64, ["s", "S", "S"]], [0.46, ["S", "l", "l"]], [0.28, ["l", "L", "L"]]];
  for (const [f, ramp] of rings) k.ellipse(cx, cy, Math.max(1, rx * f), r * f, ramp);
  k.px(cx, cy, "o");
  // the read-head arm: a thin red bar from the rim in to `seek`, with a bright tip
  if (spin > 0.5) {
    const tx = cx + Math.round(rx * (0.2 + 0.7 * seek));
    const ty = cy - Math.round(r * (0.2 + 0.7 * seek) * 0.4);
    k.line(cx + Math.round(rx * 0.95), cy - Math.round(r * 0.55), tx, ty, "h");
    k.px(tx, ty, "H");
  }
}

function claws(k: PixelCanvas, x: number, y: number) {
  for (const dx of [-2, 0, 2]) k.rect(x + dx, y, 1, 3, "c");
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const squat = p.squat ?? 0;
  const y = (p.bob ?? 0) + squat * 0.5;
  const fling = p.fling ?? 0;
  mound(k);
  // round body
  k.ellipse(32, 44 + y, 17, 15 - squat * 0.5, FUR);
  // stubby legs
  for (const s of [-1, 1]) k.ellipse(32 + s * 11, 56, 6, 3.5, FUR);
  // the platter on its belly, or flung overhead and spinning edge-on
  if (fling === 0) platter(k, 32, 47 + y, 11, 1, p.seek ?? 0.5);
  else platter(k, 32, 9 + (1 - fling) * 22, 9, 0.55, 0.5);
  // big digging arms, claws out
  for (const s of [-1, 1]) {
    const reach = fling * 10;
    k.tube([32 + s * 15, 38 + y], [32 + s * (21 + reach * 0.4), 44 + y - reach * 0.8], [32 + s * (19 + reach * 0.5), 52 + y - reach * 2], 3, 4, FUR);
    k.ellipse(32 + s * (19 + reach * 0.5), 53 + y - reach * 2, 4, 3, SKIN);
    claws(k, 32 + s * (19 + reach * 0.5), 55 + y - reach * 2);
  }
  // head: round, a long pink snout, tiny buried eyes, twitching whiskers
  const hy = 22 + y + (p.hurt ? 2 : 0);
  k.ellipse(32, hy, 12, 10, FUR);
  k.ellipse(32, hy + 4, 6, 5, SKIN);
  k.ellipse(32, hy + 5, 2.4, 1.8, ["n", "n", "N"]);
  for (const s of [-1, 1]) {
    const x = 32 + s * 7;
    if (p.hurt) {
      k.line(x - 1, hy - 3, x + 1, hy - 1, "w");
      k.line(x - 1, hy - 1, x + 1, hy - 3, "w");
    } else {
      k.rect(x - 1, hy - 2, 3, 2, "w");
      k.px(x, hy - 1, "e");
    }
    k.line(32 + s * 5, hy + 6, 32 + s * 10, hy + 5 + s, "o");
  }
  // tufts of fur on the crown
  k.stamp([".4.4.", "4343.", ".3.3."], 28, hy - 13);
  if (p.hurt) for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

/** From behind: a furry back with the platter strapped on like a shell. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const squat = p.squat ?? 0;
  const y = (p.bob ?? 0) + squat * 0.5;
  const fling = p.fling ?? 0;
  mound(k);
  k.ellipse(32, 42 + y, 19, 17 - squat * 0.5, FUR);
  k.ellipse(32, 19 + y, 11, 9, FUR, [-0.5, -0.9]);
  k.stamp([".4.4.", "4343.", ".3.3."], 28, 6 + y);
  for (const s of [-1, 1]) {
    k.ellipse(32 + s * 11, 28 + y, 3, 4, SKIN);
    claws(k, 32 + s * 11, 32 + y);
  }
  // platter on its back, strap across the shoulders
  if (fling === 0) platter(k, 32, 42 + y, 12, 1, p.seek ?? 0.5);
  else platter(k, 32, 10 + (1 - fling) * 22, 9, 0.55, 0.5);
  k.line(18, 30 + y, 46, 30 + y, "d");
  k.line(18, 31 + y, 46, 31 + y, "D");
  for (const s of [-1, 1]) {
    k.ellipse(32 + s * 14, 57, 5, 3, FUR);
    for (const dx of [-1, 1]) k.rect(32 + s * 14 + dx, 58, 1, 1, "c");
  }
  if (p.hurt) for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Seekmole (${side})`,
    palette,
    // the read head seeks in and out across the tracks while the mole bobs
    idle: [f({ seek: 0.1 }), f({ seek: 0.5, bob: -1 }), f({ seek: 0.95 }), f({ seek: 0.5, bob: 1 })],
    anims: {
      attack: [f({ squat: 4, seek: 0.95 }), f({ fling: 0.6, bob: -2 }), f({ fling: 1, bob: -4 })],
      hurt: [f({ squat: 4, hurt: true, seek: 1 }), f({ squat: 2, bob: 1, hurt: true, seek: 0 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const SEEKMOLE_ART: CreatureArt = { id: "seekmole", name: "Seekmole", front: sheet("front"), back: sheet("back") };
