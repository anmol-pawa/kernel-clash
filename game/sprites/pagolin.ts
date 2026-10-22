import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Pagolin, the Heap Harbor Gym's trainer creature: a pangolin whose armour is
 * a page table, a tiled plate of square scales (pages). One scale at a time
 * glows gold, the page the CPU is translating now, and each beat the glow
 * hops to the next. Its belly is soft, tan and unmapped. On the attack it
 * rolls and fans its plates; hurt, it flinches and every plate goes dull.
 * Original design, 64×64.
 */
const palette = {
  o: "#08142a", // outline
  1: "#173c78", // plate ramp (gym blue), dark → light
  2: "#2a62b8",
  3: "#4f93e8",
  4: "#a6d0ff",
  s: "#0f2a58", // plate seams
  n: "#7a5a3a", // skin / snout, dark → light
  N: "#b88c5a",
  B: "#e6c898",
  y: "#a8701a", // the glowing mapped page
  Y: "#f2c040",
  Z: "#fff2a0",
  e: "#0c0c14", // pupils
  w: "#ffffff",
  t: "#6a5238", // dock planks
  T: "#9a7a52",
} as const;

const PLATE = ["1", "2", "3", "4"];
const SKIN = ["n", "N", "B"];

interface Pose {
  /** which plate is glowing, 0–5 */
  lit?: number;
  bob?: number;
  /** body squash (crouch / hurt) in px */
  squat?: number;
  /** 0 = plates flat, 1 = fanned out */
  fan?: number;
  eyes?: "open" | "focus" | "hurt";
}

/** The tiled armour: staggered rows of square plates inside a body ellipse. */
function plates(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, lit: number, dull: boolean) {
  k.ellipse(cx, cy, rx, ry, PLATE);
  let n = 0;
  for (let row = 0; row < 5; row++) {
    const y = Math.round(cy - ry + 4 + row * 6);
    const off = row % 2 ? 4 : 0;
    for (let col = -3; col <= 3; col++) {
      const x = Math.round(cx + col * 8 + off - 4);
      const dx = (x + 4 - cx) / rx;
      const dy = (y + 2 - cy) / ry;
      if (dx * dx + dy * dy > 0.82) continue;
      const mapped = !dull && n % 7 === lit % 7;
      n++;
      if (mapped) {
        k.rect(x + 1, y + 1, 6, 4, "Y");
        k.rect(x + 1, y + 1, 6, 1, "Z");
        k.rect(x + 1, y + 4, 6, 1, "y");
      } else {
        k.rect(x + 1, y + 1, 6, 1, "4");
        k.rect(x + 1, y + 2, 6, 2, "3");
        k.rect(x + 1, y + 4, 6, 1, "2");
      }
      k.rect(x, y, 8, 1, "s");
      k.rect(x, y, 1, 6, "s");
    }
  }
}

function dock(k: PixelCanvas) {
  k.rect(0, 59, 64, 3, "t");
  k.rect(0, 59, 64, 1, "T");
  for (const x of [10, 30, 50]) k.rect(x, 60, 1, 2, "o");
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const squat = p.squat ?? 0;
  const fan = p.fan ?? 0;
  const y = bob + squat * 0.5;
  dock(k);
  // tail curling up behind the left flank
  k.tube([14, 56], [4, 46 + y], [8, 30 + y + fan * -4], 3, 2, PLATE);
  // body with its page-table armour
  plates(k, 32, 42 + y, 18 + fan * 2, 18 - squat * 0.5, p.lit ?? 0, p.eyes === "hurt");
  // soft belly patch where the plates stop
  k.ellipse(32, 54 + y, 9, 5, SKIN);
  // arms with claws
  for (const s of [-1, 1]) {
    const x = 32 + s * 17;
    k.ellipse(x, 50 + y, 4, 6, SKIN);
    for (const dx of [-2, 0, 2]) k.rect(x + dx, 55 + y, 1, 3, "B");
  }
  // head: skin ramp, a long snout pointing at us, small ears
  const hy = 22 + y;
  k.ellipse(32, hy, 12, 10, SKIN);
  for (const s of [-1, 1]) k.ellipse(32 + s * 10, hy - 7, 3, 3, SKIN);
  k.ellipse(32, hy + 7, 5, 5, SKIN);
  k.rect(31, hy + 9, 2, 2, "e");
  // eyes
  for (const s of [-1, 1]) {
    const x = 32 + s * 6;
    if (p.eyes === "hurt") {
      k.line(x - 2, hy - 3, x + 2, hy + 1, "e");
      k.line(x - 2, hy + 1, x + 2, hy - 3, "e");
    } else {
      k.ellipse(x, hy - 1, 2.4, p.eyes === "focus" ? 1.6 : 2.4, ["w"]);
      k.px(x, hy - 1, "e");
      k.px(x, hy, "e");
    }
  }
  // a short row of plates across the crown
  for (let i = -2; i <= 2; i++) k.rect(32 + i * 4 - 1, hy - 11 + Math.abs(i), 3, 2, i === 0 ? "4" : "3");
  if (p.eyes === "hurt") for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the whole tiled shell and the tail hanging down the middle. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const squat = p.squat ?? 0;
  const fan = p.fan ?? 0;
  const y = bob + squat * 0.5;
  dock(k);
  plates(k, 32, 40 + y, 19 + fan * 2, 19 - squat * 0.5, p.lit ?? 0, p.eyes === "hurt");
  // head peeking over the shoulder
  k.ellipse(32, 20 + y, 10, 8, SKIN, [-0.5, -0.9]);
  for (const s of [-1, 1]) k.ellipse(32 + s * 9, 14 + y, 3, 3, SKIN);
  for (let i = -2; i <= 2; i++) k.rect(32 + i * 4 - 1, 11 + y + Math.abs(i), 3, 2, "3");
  // tail curling out below the shell
  k.tube([32, 54 + y], [40, 58], [50, 52], 3, 2, PLATE);
  for (const s of [-1, 1]) {
    k.ellipse(32 + s * 15, 56, 4, 3, SKIN);
    for (const dx of [-1, 1]) k.rect(32 + s * 15 + dx, 58, 1, 2, "B");
  }
  if (p.eyes === "hurt") for (const [x, yy] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, yy);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Pagolin (${side})`,
    palette,
    // the mapped page hops one plate each beat, with a small bob
    idle: [f({ lit: 0 }), f({ lit: 1, bob: -1 }), f({ lit: 2 }), f({ lit: 3, bob: 1 })],
    anims: {
      attack: [f({ lit: 4, squat: 4, eyes: "focus" }), f({ lit: 5, fan: 0.6, bob: -2, eyes: "focus" }), f({ lit: 6, fan: 1, bob: -4, eyes: "focus" })],
      hurt: [f({ lit: 0, squat: 4, eyes: "hurt" }), f({ lit: 0, squat: 2, bob: 1, eyes: "hurt" })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const PAGOLIN_ART: CreatureArt = { id: "pagolin", name: "Pagolin", front: sheet("front"), back: sheet("back") };
