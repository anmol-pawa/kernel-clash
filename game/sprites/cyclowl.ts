import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Cyclowl, the Gridlock Gym's trainer creature: a round brown owl whose big
 * eyes each hold a ring of wait-for arrows chasing each other round and round
 * (circular wait). One talon clamps a gold key it will not release while the
 * other reaches for the next one (hold and wait). The idle frames turn the
 * arrow ring a notch each beat; on the attack it flares its wings and the
 * rings spin up. Original design, 64×64.
 */
const palette = {
  o: "#1f0606", // outline
  1: "#4a2418", // feather ramp (warm brown), dark → light
  2: "#7a4128",
  3: "#b06a40",
  4: "#e0a070",
  r: "#6e1414", // gym red markings, dark → light
  R: "#a82a20",
  S: "#e0533a",
  c: "#a8875a", // belly and face disc, dark → light
  C: "#e6cf9a",
  W: "#fff4dc",
  y: "#a8701a", // gold key and lit arrows
  Y: "#f2c040",
  Z: "#fff2a0",
  e: "#101018", // pupils
  w: "#ffffff",
  k: "#f0a030", // beak
  K: "#ffd070",
  t: "#5c4a38", // branch and talons
  T: "#8a7050",
} as const;

const FEATHER = ["1", "2", "3", "4"];
const FACE = ["c", "C", "W"];
const GOLD = ["y", "Y", "Z"];

interface Pose {
  /** how far the arrow rings have turned, in eighths of a turn */
  spin?: number;
  bob?: number;
  /** body squash (crouch / hurt) in px */
  squat?: number;
  /** 0 = wings folded, 1 = flared out */
  flare?: number;
  eyes?: "open" | "focus" | "hurt";
  /** raise the free talon, reaching for the next lock */
  reach?: boolean;
}

/** One eye: a face disc with a ring of eight arrow pips, three lit and led by a bright head. */
function eye(k: PixelCanvas, cx: number, cy: number, spin: number, mode: Pose["eyes"]) {
  k.ellipse(cx, cy, 8, 8, FACE);
  if (mode === "hurt") {
    k.line(cx - 3, cy - 3, cx + 3, cy + 3, "e");
    k.line(cx - 3, cy + 3, cx + 3, cy - 3, "e");
    return;
  }
  const rad = mode === "focus" ? 5 : 4.5;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x = Math.round(cx + Math.cos(a) * rad);
    const y = Math.round(cy + Math.sin(a) * rad);
    const d = (((spin - i) % 8) + 8) % 8; // 0 = the arrow head, then its tail behind it
    k.px(x, y, d === 0 ? "w" : d === 1 ? "Z" : d === 2 ? "Y" : "r");
  }
  k.ellipse(cx, cy, 1.6, 1.6, ["e"]);
}

/** A talon on the branch: three toes, optionally clamping the gold key. */
function foot(k: PixelCanvas, x: number, y: number, key: boolean) {
  k.rect(x - 1, y, 3, 3, "T");
  for (const dx of [-3, 0, 3]) k.rect(x + dx, y + 3, 2, 2, "t");
  if (key) {
    k.ellipse(x + 1, y - 2, 3, 3, GOLD);
    k.px(x + 1, y - 2, "o");
    k.rect(x + 1, y + 1, 5, 2, "Y");
    k.px(x + 5, y + 3, "y");
  }
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const squat = p.squat ?? 0;
  const flare = p.flare ?? 0;
  const spin = p.spin ?? 0;
  const y = bob + squat * 0.5;
  // branch
  k.rect(0, 59, 64, 3, "t");
  k.rect(0, 59, 64, 1, "T");
  // left wing (mirrored), reaching further out when flared
  k.ellipse(12 - flare * 6, 42 + y - flare * 6, 8 + flare * 3, 17 - flare * 2, FEATHER, [-0.8, -0.5]);
  for (let i = 0; i < 3; i++) k.px(8 - flare * 7 + i * 2, 56 + y - flare * 8, "1");
  k.mirror();
  // body and belly with chevron feathers
  k.ellipse(32, 42 + y, 17, 18 - squat * 0.5, FEATHER);
  k.ellipse(32, 46 + y, 11, 13 - squat * 0.4, FACE);
  for (const [x, yy] of [[28, 41], [36, 41], [32, 46], [26, 49], [38, 49], [32, 53]]) {
    k.line(x - 2, yy + y, x, yy + 2 + y, "c");
    k.line(x, yy + 2 + y, x + 2, yy + y, "c");
  }
  // red mantle stripe across the chest
  k.line(22, 36 + y, 42, 36 + y, "R");
  k.line(23, 37 + y, 41, 37 + y, "r");
  // head and ear tufts
  const hy = 22 + y;
  k.ellipse(32, hy, 19, 14, FEATHER);
  for (const s of [-1, 1]) {
    const x = 32 + s * 14;
    k.line(x, hy - 10, x + s * 3, hy - 17, "2");
    k.line(x + s, hy - 10, x + s * 4, hy - 17, "3");
    k.line(x - s, hy - 9, x + s * 2, hy - 16, "1");
    k.px(x + s * 3, hy - 17, "4");
  }
  // eyes with their wait-for rings
  eye(k, 22, hy + 1, spin, p.eyes);
  eye(k, 42, hy + 1, spin, p.eyes);
  // beak between them
  k.stamp([".kk.", "kKKk", ".kk.", "..k."], 30, Math.round(hy + 2));
  // talons: one holds the key, the other reaches for the next
  foot(k, 24, 54, true);
  foot(k, 40, p.reach ? 51 : 54, false);
  if (p.eyes === "hurt") for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

/** From behind: folded wings with a red stripe, the tufts and a fan of tail feathers. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const squat = p.squat ?? 0;
  const flare = p.flare ?? 0;
  const y = bob + squat * 0.5;
  k.rect(0, 59, 64, 3, "t");
  k.rect(0, 59, 64, 1, "T");
  k.ellipse(12 - flare * 6, 42 + y - flare * 6, 8 + flare * 3, 17 - flare * 2, FEATHER, [-0.8, -0.5]);
  k.mirror();
  // tail feathers fanned under the body
  for (let i = -2; i <= 2; i++) k.line(32 + i * 3, 54, 32 + i * 4, 58, i % 2 ? "2" : "1");
  k.ellipse(32, 42 + y, 17, 18 - squat * 0.5, FEATHER, [-0.5, -0.9]);
  // wing seams and a back stripe
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.line(32 + s * (5 + i * 3), 40 + y, 32 + s * (6 + i * 3), 52 + y, i % 2 ? "2" : "3");
  k.line(32, 36 + y, 32, 52 + y, "R");
  const hy = 22 + y;
  k.ellipse(32, hy, 19, 14, FEATHER, [-0.5, -0.9]);
  for (const s of [-1, 1]) {
    const x = 32 + s * 14;
    k.line(x, hy - 10, x + s * 3, hy - 17, "2");
    k.line(x + s, hy - 10, x + s * 4, hy - 17, "3");
    k.line(x - s, hy - 9, x + s * 2, hy - 16, "1");
  }
  // the ring of arrows glows on the nape too: a faint collar
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + (p.spin ?? 0) * (Math.PI / 4);
    k.px(32 + Math.cos(a) * 9, hy + 9 + Math.sin(a) * 3, i % 3 === 0 ? "Y" : "R");
  }
  foot(k, 24, 54, true);
  foot(k, 40, 54, false);
  if (p.eyes === "hurt") for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Cyclowl (${side})`,
    palette,
    // the arrow rings turn a quarter each beat; a blink-bob in between
    idle: [f({ spin: 0 }), f({ spin: 2, bob: -1 }), f({ spin: 4 }), f({ spin: 6, bob: 1, reach: true })],
    anims: {
      attack: [f({ spin: 1, squat: 3, eyes: "focus" }), f({ spin: 3, flare: 0.6, bob: -2, eyes: "focus", reach: true }), f({ spin: 5, flare: 1, bob: -4, eyes: "focus", reach: true })],
      hurt: [f({ spin: 7, squat: 4, eyes: "hurt" }), f({ spin: 7, squat: 2, bob: 1, eyes: "hurt" })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const CYCLOWL_ART: CreatureArt = { id: "cyclowl", name: "Cyclowl", front: sheet("front"), back: sheet("back") };
