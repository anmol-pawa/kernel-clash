import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Swaploth, the Swapwood Gym's trainer creature: a drowsy sloth that keeps
 * its working set in its lap, a stack of page cards. Every beat it swaps the
 * top card out (lifts it away) and a fresh one slides in: the victim page
 * going to disk. Its heavy lids are the only part that never page-faults.
 * On the attack it flings the whole stack; hurt, it flinches and drops them.
 * Original design, 64×64.
 */
const palette = {
  o: "#12081f", // outline
  1: "#3a1c6e", // fur ramp (gym purple), dark → light
  2: "#5e32a8",
  3: "#9466e0",
  4: "#d2b8ff",
  n: "#8a6a4a", // face mask / belly, dark → light
  N: "#c9a574",
  B: "#f0dcb4",
  e: "#0c0c14", // pupils, nose
  w: "#ffffff",
  p: "#f4f0ff", // page cards
  q: "#b9a8e0", // page edge
  r: "#7a62b8", // page text lines
  g: "#3f7a2a", // moss, dark → light
  G: "#7cc050",
  t: "#5a3e26", // log
  T: "#8c6a42",
} as const;

const FUR = ["1", "2", "3", "4"];
const SKIN = ["n", "N", "B"];

interface Pose {
  bob?: number;
  /** body squash (crouch / hurt) in px */
  squat?: number;
  /** lap-stack beat: how far the top card is lifted out, in px */
  lift?: number;
  /** 0 = cards in the lap, 1 = flung up and out */
  fling?: number;
  eyes?: "droop" | "open" | "wide" | "hurt";
}

function log(k: PixelCanvas) {
  k.rect(0, 58, 64, 4, "t");
  k.rect(0, 58, 64, 1, "T");
  for (const x of [8, 26, 44, 58]) k.rect(x, 60, 3, 1, "o");
}

/** One page card: pale sheet, edge shading, two text lines. */
function card(k: PixelCanvas, x: number, y: number) {
  k.rect(x, y, 11, 8, "q");
  k.rect(x + 1, y + 1, 9, 6, "p");
  k.rect(x + 2, y + 2, 6, 1, "r");
  k.rect(x + 2, y + 4, 4, 1, "r");
}

function moss(k: PixelCanvas, x: number, y: number) {
  k.stamp([".G.G.", "GGgGG", ".ggg."], x, y);
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const squat = p.squat ?? 0;
  const y = (p.bob ?? 0) + squat * 0.5;
  const fling = p.fling ?? 0;
  log(k);
  // body, with a pale belly where the lap stack rests
  k.ellipse(32, 45 + y, 17, 14 - squat * 0.5, FUR);
  k.ellipse(32, 49 + y, 10, 8, SKIN);
  // legs and feet on the log
  for (const s of [-1, 1]) {
    k.ellipse(32 + s * 12, 55, 6, 4, FUR);
    for (const dx of [-3, 0, 3]) k.rect(32 + s * 12 + dx - 1, 57, 1, 2, "B");
  }
  // the lap stack: three cards, the top one lifted out on the beat
  if (fling === 0) {
    card(k, 21, 50 + y);
    card(k, 25, 47 + y);
    card(k, 28, 44 + y - (p.lift ?? 0));
  } else {
    card(k, 8, 24 - fling * 6);
    card(k, 45, 20 - fling * 6);
    card(k, 27, 6 + (1 - fling) * 4);
  }
  // long arms with hooked claws
  for (const s of [-1, 1]) {
    const reach = fling * 8;
    k.tube([32 + s * 16, 36 + y], [32 + s * (21 + reach), 44 + y - reach], [32 + s * (15 + reach), 54 + y - reach * 1.6], 3, 3, FUR);
    const hx = 32 + s * (15 + reach);
    for (const dx of [-2, 0, 2]) k.rect(hx + dx, 56 + y - reach * 1.6, 1, 3, "B");
  }
  // head: round, a cream face mask, dark eye patches
  const hy = 21 + y;
  k.ellipse(32, hy, 13, 11, FUR);
  k.ellipse(32, hy + 2, 9, 7, SKIN);
  for (const s of [-1, 1]) {
    const x = 32 + s * 6;
    k.ellipse(x, hy, 3.5, 3, ["1", "2"]);
    if (p.eyes === "hurt") {
      k.line(x - 2, hy - 2, x + 2, hy + 2, "w");
      k.line(x - 2, hy + 2, x + 2, hy - 2, "w");
    } else if (p.eyes === "droop") {
      k.rect(x - 1, hy, 3, 1, "w");
      k.px(x, hy, "e");
      k.rect(x - 2, hy - 1, 5, 1, "1");
    } else {
      const r = p.eyes === "wide" ? 2.4 : 1.8;
      k.ellipse(x, hy, r, r, ["w"]);
      k.px(x, hy, "e");
      k.px(x, hy + 1, "e");
    }
  }
  // nose and a small sleepy smile
  k.rect(31, hy + 4, 3, 2, "e");
  k.line(29, hy + 7, 31, hy + 8, "o");
  k.line(31, hy + 8, 34, hy + 8, "o");
  k.line(34, hy + 8, 36, hy + 7, "o");
  // moss growing on the crown and one shoulder
  moss(k, 28, hy - 14);
  moss(k, 12, 37 + y);
  if (p.eyes === "hurt") for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

/** From behind: a round furry back, a satchel strap, cards poking out. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const squat = p.squat ?? 0;
  const y = (p.bob ?? 0) + squat * 0.5;
  const fling = p.fling ?? 0;
  log(k);
  k.ellipse(32, 42 + y, 19, 18 - squat * 0.5, FUR);
  // head over the shoulder, ears of moss
  k.ellipse(32, 18 + y, 11, 9, FUR, [-0.5, -0.9]);
  moss(k, 28, 5 + y);
  // satchel on the back, its flap and strap
  k.rect(22, 36 + y, 20, 14, "t");
  k.rect(22, 36 + y, 20, 2, "T");
  k.rect(22, 44 + y, 20, 1, "o");
  k.rect(31, 40 + y, 2, 3, "T");
  k.line(24, 28 + y, 40, 36 + y, "t");
  k.line(24, 29 + y, 40, 37 + y, "T");
  // page cards peeking out of the satchel, one lifted on the beat
  if (fling === 0) {
    card(k, 23, 30 + y - (p.lift ?? 0) * 0.5);
    card(k, 30, 31 + y);
  } else {
    card(k, 10, 20 - fling * 6);
    card(k, 43, 16 - fling * 6);
  }
  for (const s of [-1, 1]) {
    k.ellipse(32 + s * 15, 56, 5, 3, FUR);
    for (const dx of [-1, 1]) k.rect(32 + s * 15 + dx, 58, 1, 1, "B");
  }
  if (p.eyes === "hurt") for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Swaploth (${side})`,
    palette,
    // the top card lifts out (swap-out) and settles back, with a slow breath
    idle: [f({ eyes: "droop" }), f({ lift: 3, bob: -1, eyes: "droop" }), f({ lift: 6, eyes: "open" }), f({ lift: 3, bob: 1, eyes: "droop" })],
    anims: {
      attack: [f({ squat: 4, lift: 4, eyes: "wide" }), f({ fling: 0.6, bob: -2, eyes: "wide" }), f({ fling: 1, bob: -4, eyes: "wide" })],
      hurt: [f({ squat: 4, eyes: "hurt" }), f({ squat: 2, bob: 1, eyes: "hurt" })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const SWAPLOTH_ART: CreatureArt = { id: "swaploth", name: "Swaploth", front: sheet("front"), back: sheet("back") };
