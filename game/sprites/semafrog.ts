import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Semafrog, the Mutex Marsh Gym's trainer creature: a marsh frog with a railway
 * signal arm planted on its head. Three lamp pips glow on its belly, one per
 * free permit of its semaphore: each idle frame it wait()s (a pip goes dark and
 * the arm drops to "stop" at zero) or signal()s (a pip relights and the arm
 * lifts). On the attack its tongue lashes out with a glowing token on the tip.
 * Original design, 64×64.
 */
const palette = {
  o: "#12081a", // outline
  1: "#1b4236", // skin ramp (marsh green), dark → light
  2: "#2c7552",
  3: "#4aa468",
  4: "#8ad088",
  p: "#8a5470", // belly ramp (dusky rose), dark → light
  P: "#c88aa0",
  q: "#f2d2d0",
  m: "#a02a7c", // spots and signal stripes (gym ramp)
  M: "#e05aa8",
  N: "#ffaedb",
  y: "#f0d040", // eye iris
  e: "#0a0a12", // pupils
  w: "#ffffff",
  h: "#2a2430", // pole, dark pips
  d: "#7a6040", // pole highlight
  G: "#ffd77a", // lit pips and token
  g: "#e89a2c",
  t: "#e0607a", // tongue
  T: "#f4a0b0",
  b: "#f0a0a0", // cheek blush
} as const;

const SKIN = ["1", "2", "3", "4"];
const BELLY = ["p", "P", "q"];

interface Pose {
  /** permits free: how many belly pips are lit (0..3) */
  pips?: number;
  /** signal arm: false = level ("stop"), true = lowered ("go") */
  open?: boolean;
  bob?: number;
  /** body squash (crouch / hurt) in px */
  squat?: number;
  /** throat/belly puff, px */
  puff?: number;
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "closed" | "open";
  /** tongue length in px (0 = none); a token rides the tip */
  tongue?: number;
  swing?: number;
}

const EYE: Record<string, Grid> = {
  open: [".yyy.", "yeeey", "yewey", "yeeey", ".yyy."],
  focus: ["yy...", ".yyy.", "yeeey", "yeeey", ".yyy."],
  shut: [".....", ".....", "eeeee", ".eee.", "....."],
  hurt: ["e...e", ".e.e.", "..e..", ".e.e.", "e...e"],
};

/** The signal: a pole, a striped arm that is level (stop) or drops 35° (go), and a lamp on its tip. */
function signal(k: PixelCanvas, x: number, base: number, top: number, open: boolean) {
  k.line(x, base, x, top, "h");
  k.line(x + 1, base, x + 1, top, "d");
  const dir = open ? 0.7 : 0;
  const len = 14;
  for (let i = 0; i <= len; i++) {
    const ax = x + 2 + i;
    const ay = Math.round(top + 1 + i * dir);
    k.px(ax, ay - 1, i % 4 < 2 ? "M" : "w");
    k.px(ax, ay, i % 4 < 2 ? "m" : "N");
    k.px(ax, ay + 1, "h");
  }
  const lx = x + 2 + len;
  const ly = Math.round(top + 1 + len * dir);
  k.ellipse(lx + 1, ly, 2.5, 2.5, open ? ["g", "G", "w"] : ["m", "M", "N"]);
  k.ellipse(x, top - 1, 2, 2, ["h", "d", "d"]);
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const squat = p.squat ?? 0;
  const puff = p.puff ?? 0;
  const pips = p.pips ?? 3;
  // hind legs: folded thighs with long webbed feet splayed out
  k.ellipse(12, 49 + squat, 8.5, 8, SKIN);
  for (let i = 0; i < 3; i++) k.rect(2 + i * 3, 58, 2, 1, "4");
  k.rect(1, 57, 11, 2, "2");
  k.mirror();
  // body and belly
  k.ellipse(32, 43 + bob + squat * 0.6, 20, 15 - squat * 0.5, SKIN);
  k.ellipse(32, 48 + bob + squat * 0.6, 12 + puff * 0.5, 9 - squat * 0.3 + puff * 0.5, BELLY);
  // front legs
  k.ellipse(17, 55, 4.5, 3.5, SKIN);
  k.ellipse(47, 55, 4.5, 3.5, SKIN);
  for (const x of [12, 15, 18]) k.px(x, 58, "4");
  for (const x of [43, 46, 49]) k.px(x, 58, "4");
  // head: wide, flat and slightly wider than the body
  const hy = 30 + bob + squat * 0.5;
  k.ellipse(32, hy, 20, 11, SKIN);
  // eye bumps
  k.ellipse(19.5, hy - 9, 6.5, 6, SKIN);
  k.ellipse(44.5, hy - 9, 6.5, 6, SKIN);
  const eye = EYE[p.eyes ?? "open"];
  const ey = Math.round(hy - 12);
  k.stamp(eye, 17, ey);
  k.stamp(eye, 42, ey, true);
  // cheeks and nostrils
  k.rect(11, Math.round(hy), 3, 1, "b");
  k.rect(50, Math.round(hy), 3, 1, "b");
  k.px(29, Math.round(hy - 6), "1");
  k.px(35, Math.round(hy - 6), "1");
  // wide mouth line (open when attacking or hurt)
  const my = Math.round(hy + 4);
  if (p.mouth === "open" || p.eyes === "hurt") {
    k.ellipse(32, my + 1, 11, 4, ["1", "1", "1"]);
    k.rect(22, my - 1, 20, 1, "o");
    k.ellipse(32, my + 3, 7, 2, ["t", "t", "T"]);
  } else {
    k.line(15, my - 1, 22, my + 1, "1");
    k.line(22, my + 1, 42, my + 1, "1");
    k.line(42, my + 1, 49, my - 1, "1");
    k.line(23, my + 2, 41, my + 2, "2");
  }
  // spots down the back
  for (const [x, y] of [[9, 40], [14, 34], [8, 47]]) k.ellipse(x, y + bob, 2, 1.6, ["m", "M"]);
  for (const [x, y] of [[55, 40], [50, 34], [56, 47]]) k.ellipse(x, y + bob, 2, 1.6, ["m", "M"]);
  // three lamp pips on the belly: lit = a free permit
  for (let i = 0; i < 3; i++) {
    const px = 24 + i * 8;
    const py = 48 + bob + squat * 0.6;
    k.ellipse(px, py, 2.6, 2.6, i < pips ? ["g", "G", "w"] : ["h", "h", "p"]);
  }
  // the tongue lashes down with a token on its tip
  if (p.tongue) {
    const ty = my + 3;
    k.rect(30, ty, 4, p.tongue, "t");
    k.rect(30, ty, 1, p.tongue, "T");
    k.ellipse(32, ty + p.tongue + 1, 4.5, 4.5, ["g", "G", "w"]);
    k.ellipse(32, ty + p.tongue + 1, 6.5, 6.5, ["g"], [0, 0]);
  }
  signal(k, 32, hy - 11, 3 + Math.round(bob), !!p.open);
  if (p.eyes === "hurt") for (const [x, y] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the spotted back, the eye bumps over the shoulders and the signal on its head. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const squat = p.squat ?? 0;
  k.ellipse(11, 50 + squat, 9, 8, SKIN);
  for (let i = 0; i < 3; i++) k.rect(2 + i * 3, 58, 2, 1, "4");
  k.rect(1, 57, 11, 2, "2");
  k.mirror();
  k.ellipse(32, 41 + bob + squat * 0.6, 21, 17 - squat * 0.5, SKIN, [-0.5, -0.9]);
  // head hump with the eye bumps peeking over the top
  k.ellipse(32, 26 + bob + squat * 0.5, 17, 10, SKIN, [-0.5, -0.9]);
  k.ellipse(19.5, 19 + bob, 6, 5.5, SKIN);
  k.ellipse(44.5, 19 + bob, 6, 5.5, SKIN);
  k.ellipse(19.5, 18 + bob, 3, 2.5, ["y", "y", "w"]);
  k.ellipse(44.5, 18 + bob, 3, 2.5, ["y", "y", "w"]);
  k.px(19, 18 + bob, "e");
  k.px(45, 18 + bob, "e");
  // back spots, a bigger pair near the spine and a lighter stripe
  for (const [x, y] of [[20, 38], [26, 47], [14, 46], [24, 32]]) k.ellipse(x, y + bob, 2.6, 2, ["m", "M", "N"]);
  for (const [x, y] of [[44, 38], [38, 47], [50, 46], [40, 32]]) k.ellipse(x, y + bob, 2.6, 2, ["m", "M", "N"]);
  k.line(32, Math.round(30 + bob), 32, Math.round(56 + bob + squat * 0.6), "4");
  if (p.tongue) for (let i = 0; i < 6; i++) k.px(32 + Math.sin(i * 1.1 + 0.4) * 22, 28 + bob + Math.cos(i * 1.1 + 0.4) * 22, i % 2 ? "G" : "g");
  signal(k, 32, 20 + bob, 3 + Math.round(bob), !!p.open);
  if (p.eyes === "hurt") for (const [x, y] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Semafrog (${side})`,
    palette,
    // wait, wait, signal, signal: the permits drain and refill, the arm follows
    idle: [f({ pips: 3, open: true, puff: 1 }), f({ pips: 2, open: true, bob: -1, eyes: "shut" }), f({ pips: 0, open: false, puff: 0 }), f({ pips: 1, open: true, bob: 1 })],
    anims: {
      attack: [f({ pips: 3, open: true, squat: 3, eyes: "focus" }), f({ pips: 3, open: false, squat: 2, eyes: "focus", mouth: "open", puff: 2 }), f({ pips: 3, open: true, eyes: "focus", mouth: "open", tongue: 12, bob: -1 })],
      hurt: [f({ pips: 0, open: false, squat: 4, eyes: "hurt" }), f({ pips: 1, open: false, squat: 2, eyes: "hurt", bob: 1 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const SEMAFROG_ART: CreatureArt = { id: "semafrog", name: "Semafrog", front: sheet("front"), back: sheet("back") };
