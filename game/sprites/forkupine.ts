import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Forkupine, the Fork Grove Gym's trainer creature: a grove porcupine whose
 * quills split in two at the tip, like a process tree after fork(). A brass
 * PID tag hangs from its collar, and when it bristles the forked tips light
 * up in the gym's teal before it looses a volley. Original design, 64×64.
 */
const palette = {
  o: "#0b1a17", // outline
  1: "#16332d", // fur ramp (deep forest), dark → light
  2: "#245247",
  3: "#357a64",
  4: "#5aa886",
  q: "#7d6c4c", // quill ramp (bone), dark → light
  Q: "#cdbb8e",
  n: "#fff4d6",
  m: "#7a4a2c", // muzzle ramp
  M: "#b57a4a",
  N: "#e8b483",
  e: "#0a0a12", // eyes / nose
  w: "#ffffff",
  b: "#ff8f8f", // cheek blush
  k: "#b7801c", // brass PID tag
  K: "#ffd45e",
  g: "#3cc9b5", // forked tips glowing teal (gym ramp)
  G: "#9af2e2",
  c: "#4a2e1c", // claws
} as const;

const FUR = ["1", "2", "3", "4"];
const MUZZLE = ["m", "M", "N"];

interface Pose {
  /** quill sway in radians (idle breathing) */
  sway?: number;
  /** quill length multiplier: 1 normal, >1 bristling, <1 flattened */
  bristle?: number;
  /** quills drooping downward (radians) when hurt */
  droop?: number;
  /** body offset in px (+ = toward the viewer / down the screen) */
  lean?: number;
  bob?: number;
  eyes?: "open" | "focus" | "shut" | "hurt";
  /** forked tips glow teal (charging an attack) */
  glow?: boolean;
  /** a volley of forked quills flying out */
  volley?: boolean;
}

const EYE: Record<string, Grid> = {
  open: [".eee.", "ewwee", "ewwee", "eeeee", ".eee."],
  focus: ["e....", ".ee..", "eweee", "eeeee", ".eee."],
  shut: [".....", ".....", "eeeee", ".eee.", "....."],
  hurt: ["e...e", ".e.e.", "..e..", ".e.e.", "e...e"],
};

/**
 * One forked quill growing out of the mound at angle `a` (screen coords, y
 * down): a two-tone stem that splits into two branches with pale tips.
 */
function quill(k: PixelCanvas, cx: number, cy: number, a: number, r0: number, len: number, glow: boolean) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const bx = cx + dx * r0;
  const by = cy + dy * r0;
  const fx = bx + dx * len;
  const fy = by + dy * len;
  // shaded stem: the lit side faces the top-left light
  k.line(Math.round(bx), Math.round(by), Math.round(fx), Math.round(fy), "q");
  const sx = dy < -0.3 ? 1 : 0;
  const sy = dy < -0.3 ? 0 : -1;
  k.line(Math.round(bx + sx), Math.round(by + sy), Math.round(fx + sx), Math.round(fy + sy), "Q");
  // the fork: two branches at ±0.5 rad
  const blen = Math.max(2, len * 0.45);
  for (const s of [-0.5, 0.5]) {
    const ex = fx + Math.cos(a + s) * blen;
    const ey = fy + Math.sin(a + s) * blen;
    k.line(Math.round(fx), Math.round(fy), Math.round(ex), Math.round(ey), "Q");
    k.px(Math.round(ex), Math.round(ey), glow ? "G" : "n");
    if (glow) k.px(Math.round(ex - Math.cos(a + s)), Math.round(ey - Math.sin(a + s)), "g");
  }
}

/** A flying forked quill (the attack's volley), pointing along angle `a`. */
function dart(k: PixelCanvas, x: number, y: number, a: number) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  k.line(Math.round(x - dx * 5), Math.round(y - dy * 5), Math.round(x), Math.round(y), "Q");
  for (const s of [-0.6, 0.6]) {
    const ex = x + Math.cos(a + s) * 3;
    const ey = y + Math.sin(a + s) * 3;
    k.line(Math.round(x), Math.round(y), Math.round(ex), Math.round(ey), "g");
    k.px(Math.round(ex), Math.round(ey), "G");
  }
}

/** The left half's quills: a back row standing out of the mound and a front row lying over it. */
function quills(k: PixelCanvas, cx: number, cy: number, p: Pose, row: "back" | "front", back = false) {
  const b = p.bristle ?? 1;
  const sway = p.sway ?? 0;
  const droop = p.droop ?? 0;
  const glow = !!p.glow;
  if (row === "back") {
    const n = back ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // from just below the left flank (0.92π) round to straight up (1.5π)
      const a = Math.PI * (0.92 + 0.58 * t) + sway * (1 - t) + droop * (1 - t * 0.7);
      quill(k, cx, cy, a, 15, (7 + 2 * Math.sin(t * Math.PI)) * b, glow);
    }
  } else {
    const n = back ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = Math.PI * (1.04 + 0.4 * t) + sway * 0.6 + droop * 0.6;
      quill(k, cx, cy - 2, a, back ? 6 + i : 9, (6 + i) * b * (back ? 1.1 : 1), glow);
    }
  }
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const lean = p.lean ?? 0;
  const oy = lean + (p.bob ?? 0);
  const cx = 32;
  const cy = 37 + oy;
  quills(k, cx, cy, p, "back");
  // the furry mound, ears and paws
  k.ellipse(cx, cy, 20 + lean * 0.3, 17, FUR);
  quills(k, cx, cy, p, "front");
  k.ellipse(19, cy - 1, 3.5, 3.5, ["m", "M"]);
  k.ellipse(19.5, cy - 0.5, 1.6, 1.6, ["b"]);
  k.ellipse(24, 55 + oy * 0.5, 4.5, 3, FUR);
  for (let i = 0; i < 3; i++) k.px(21 + i * 2, Math.round(57 + oy * 0.5), "c");
  // the face: a tan muzzle peeking out of the quills
  k.ellipse(cx, cy + 6, 12, 9.5, MUZZLE);
  k.mirror();
  const hy = Math.round(cy + 3);
  const eye = EYE[p.eyes ?? "open"];
  k.stamp(eye, 23, hy - 2);
  k.stamp(eye, 36, hy - 2, true);
  // cheeks, nose and mouth
  k.rect(21, hy + 4, 3, 1, "b");
  k.rect(40, hy + 4, 3, 1, "b");
  k.stamp([".eee.", "eewee", ".eee."], 30, hy + 3);
  if (p.eyes === "hurt" || p.volley) k.stamp(["e...e", ".eee."], 30, hy + 8);
  else k.stamp(["e...e", ".e.e."], 30, hy + 7);
  // the brass PID tag on its collar, a little off-centre
  const ty = Math.round(cy + 15);
  k.line(33, ty - 1, 37, ty - 1, "k");
  k.stamp(["kKKKk", "KKkKK", "KkkKK", "KKkKK", ".kkk."], 36, ty);
  if (p.volley)
    for (const [x, y, a] of [[8, 14, -2.4], [56, 12, -0.7], [12, 50, 2.6], [54, 48, 0.5]] as const) dart(k, x, y, a);
  if (p.eyes === "hurt") for (const [x, y] of [[5, 9], [55, 7]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: a dome of forked quills, the ears, the hind feet and a stubby tail. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const oy = -(p.lean ?? 0) + (p.bob ?? 0);
  const cx = 32;
  const cy = 37 + oy;
  quills(k, cx, cy, p, "back", true);
  k.ellipse(cx, cy, 21, 18, FUR, [-0.5, -0.9]);
  k.ellipse(21, 56 + oy * 0.5, 5, 3, ["1", "2", "3"]);
  k.ellipse(17, cy - 6, 3.5, 3.5, ["m", "M"]);
  quills(k, cx, cy, p, "front", true);
  // rows of short forked quills thatching the back, each pointing away from the dome's centre
  const b = p.bristle ?? 1;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const bx = 14 + c * 6 + (r & 1) * 3;
      const by = cy - 6 + r * 6;
      const a = Math.atan2(by - (cy + 10), bx - cx) + (p.droop ?? 0) * 0.5;
      quill(k, bx, by, a, 0, 4 * b, !!p.glow);
    }
  k.mirror();
  // a stubby tail tuft and the collar's cord round the neck
  k.ellipse(32, cy + 15, 4, 3, ["q", "Q", "n"]);
  for (let x = 22; x <= 42; x++) {
    const d = Math.abs(x - 32);
    k.px(x, Math.round(cy - 13 + (d * d) / 40), "k");
  }
  if (p.volley) for (const [x, y, a] of [[10, 8, -2.2], [32, 3, -1.57], [54, 8, -0.9]] as const) dart(k, x, y, a);
  if (p.eyes === "hurt") for (const [x, y] of [[5, 10], [55, 8]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Forkupine (${side})`,
    palette,
    idle: [f({}), f({ sway: 0.05, bob: -1 }), f({}), f({ sway: -0.05, bob: 1, eyes: "shut" })],
    anims: {
      attack: [f({ bristle: 1.25, eyes: "focus", bob: -1 }), f({ bristle: 1.35, lean: 2, eyes: "focus", glow: true }), f({ bristle: 0.9, lean: 3, eyes: "focus", glow: true, volley: true })],
      hurt: [f({ bristle: 0.75, droop: 0.35, lean: -2, eyes: "hurt" }), f({ bristle: 0.85, droop: 0.2, lean: -1, eyes: "hurt" })],
    },
    fps: { idle: 4, attack: 6, hurt: 6 },
  };
}

export const FORKUPINE_ART: CreatureArt = { id: "forkupine", name: "Forkupine", front: sheet("front"), back: sheet("back") };
