import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Tortick, the Clocktower Gym's trainer creature: a slow brass-shelled
 * tortoise whose shell is a clock face cut into four coloured time slices.
 * Its hand moves one slice per tick, and the slice it points at lights up in
 * the gym's amber: that process has the CPU, the rest wait their turn (Round
 * Robin with four jobs). A pendulum swings from its tail. Original design, 64×64.
 */
const palette = {
  o: "#1a1008", // outline
  1: "#4a2a10", // shell ramp (bronze), dark → light
  2: "#7a4a1c",
  3: "#a86c2a",
  4: "#d49a4a",
  r: "#3a2a1e", // shell rim band, dark → light
  R: "#6a5038",
  f: "#d8c8a0", // clock face (cream), dark → light
  F: "#f0e4c0",
  n: "#fffaf0",
  x: "#5aa0c8", // the four time slices
  y: "#d070a0",
  z: "#70b860",
  v: "#9a80d8",
  s: "#3e5a3a", // skin ramp (sage), dark → light
  S: "#6a8e58",
  T: "#a8c488",
  e: "#0a0a12", // eyes
  w: "#ffffff",
  h: "#2a2430", // clock hand and ticks
  g: "#e89a2c", // the running slice / glow (gym ramp)
  G: "#ffd77a",
  c: "#5a4030", // claws
  b: "#f0a0a0", // cheek blush
} as const;

const SHELL = ["1", "2", "3", "4"];
const RIM = ["r", "R"];
const SKIN = ["s", "S", "T"];
const SLICES = ["x", "y", "z", "v"];

interface Pose {
  /** which quarter the clock hand points at (0 = 12–3 o'clock, clockwise) */
  tick?: number;
  /** head offset in px (+ = out of the shell, toward the viewer) */
  lean?: number;
  /** head pulled into the shell (hurt), 0..1 */
  tuck?: number;
  bob?: number;
  /** pendulum swing (back view), radians */
  swing?: number;
  eyes?: "open" | "focus" | "shut" | "hurt";
  /** the clock face glows and the hand blurs round (charging an attack) */
  glow?: boolean;
  /** a burst of amber tick marks flying off the face */
  burst?: boolean;
}

const EYE: Record<string, Grid> = {
  open: [".eee.", "ewwee", "ewwee", "eeeee", ".eee."],
  focus: ["ee...", ".eee.", "ewwee", "eeeee", ".eee."],
  shut: [".....", ".....", "eeeee", ".eee.", "....."],
  hurt: ["e...e", ".e.e.", "..e..", ".e.e.", "e...e"],
};

/**
 * The clock face: a cream dial whose outer ring is cut into four coloured
 * slices (the slice under the hand burns amber), twelve tick marks, and the
 * hand. `glow` lights the whole ring and adds blur arcs behind the hand.
 */
function clock(k: PixelCanvas, cx: number, cy: number, r: number, p: Pose) {
  const tick = (((p.tick ?? 0) % 4) + 4) % 4;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      // clockwise from 12 o'clock
      const a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
      const slice = Math.floor(a / (Math.PI / 2)) % 4;
      if (d > r - 3) {
        const lit = p.glow || slice === tick;
        k.px(x, y, lit ? (d > r - 1.5 ? "g" : "G") : SLICES[slice]);
      } else k.px(x, y, d < r * 0.35 ? "n" : dx + dy < 0 ? "F" : "f");
    }
  // slice dividers and twelve ticks
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    const long = i % 3 === 0;
    const r0 = long ? r - 5.5 : r - 4.5;
    k.line(Math.round(cx + sx * r0), Math.round(cy + sy * r0), Math.round(cx + sx * (r - (long ? 0.5 : 3.5))), Math.round(cy + sy * (r - (long ? 0.5 : 3.5))), "h");
  }
  // the hand points into the middle of its slice
  const ha = (tick + 0.5) * (Math.PI / 2);
  const hx = Math.sin(ha);
  const hy = -Math.cos(ha);
  if (p.glow)
    for (const back of [0.5, 1]) {
      const ba = ha - back;
      k.line(Math.round(cx), Math.round(cy), Math.round(cx + Math.sin(ba) * (r - 4)), Math.round(cy - Math.cos(ba) * (r - 4)), "G");
    }
  k.line(Math.round(cx), Math.round(cy), Math.round(cx + hx * (r - 3)), Math.round(cy + hy * (r - 3)), "h");
  k.line(Math.round(cx + 1), Math.round(cy), Math.round(cx + 1 + hx * (r - 6)), Math.round(cy + hy * (r - 6)), "h");
  k.rect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, "g");
  k.px(Math.round(cx) - 1, Math.round(cy) - 1, "G");
}

/**
 * Scute seams on the left half of the shell (mirrored later): dark spokes from
 * the dial's bezel out towards the rim, each with a brass rivet, and a lit
 * ridge beside each seam.
 */
function scutes(k: PixelCanvas, dial: [number, number], r0: number, shell: [number, number], rx: number, ry: number) {
  for (const a of [Math.PI * 1.12, Math.PI * 1.32, Math.PI * 1.55, Math.PI * 1.78]) {
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    const x0 = Math.round(dial[0] + sx * r0);
    const y0 = Math.round(dial[1] + sy * r0);
    const x1 = Math.round(shell[0] + sx * rx * 0.9);
    const y1 = Math.round(shell[1] + sy * ry * 0.86);
    k.line(x0, y0 - 1, x1, y1 - 1, "4");
    k.line(x0, y0, x1, y1, "1");
    k.px(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2) + 1, "G");
  }
}

/** A dark bezel with a brass ring round the dial, and the winding key on top. */
function bezel(k: PixelCanvas, cx: number, cy: number, r: number, wind = 0) {
  const top = Math.round(cy - r - 2);
  k.stamp(wind ? [".GGg.", "GgggG", ".gGg.", "..h..", ".hhh."] : ["GG.gg", "Gg.gg", ".ggg.", "..h..", ".hhh."], Math.round(cx) - 2, top - 5);
  k.ellipse(cx, cy, r + 2.5, r + 2.5, ["r", "R", "4"]);
  k.ellipse(cx, cy, r + 1, r + 1, ["h"]);
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const lean = p.lean ?? 0;
  const tuck = p.tuck ?? 0;
  // stumpy front legs splayed under the shell
  k.ellipse(14, 52 + bob * 0.5, 6.5, 7, SKIN);
  for (let i = 0; i < 3; i++) k.rect(10 + i * 3, Math.round(58 + bob * 0.5), 2, 1, "c");
  // the shell: a rim band, then the bronze dome with its seams
  k.ellipse(32, 31 + bob, 27, 18, RIM);
  k.ellipse(32, 28 + bob, 25, 17, SHELL);
  scutes(k, [32, 23 + bob], 14, [32, 28 + bob], 25, 17);
  k.mirror();
  bezel(k, 32, 23 + bob, 12, (p.tick ?? 0) & 1);
  clock(k, 32, 23 + bob, 12, p);
  // the head pokes out from under the rim (further when it lunges, half hidden when it tucks)
  const hy = 48 + bob * 0.5 + lean - tuck * 5;
  const hr = 12.5 + lean * 0.4 - tuck * 2;
  k.ellipse(32, hy + 1, hr - 3, 6, ["s", "S"]);
  k.ellipse(32, hy, hr, 9.5 - tuck * 2.5, SKIN);
  const eye = EYE[p.eyes ?? "open"];
  const ey = Math.round(hy - 3);
  k.stamp(eye, 23, ey);
  k.stamp(eye, 36, ey, true);
  k.rect(22, ey + 6, 3, 1, "b");
  k.rect(39, ey + 6, 3, 1, "b");
  // a beaked mouth (open on the attack and when hurt)
  const my = ey + 7;
  if (p.burst || p.eyes === "hurt") k.stamp(["e...e", ".eee.", "..e.."], 30, my);
  else k.stamp(["e...e", ".eee."], 30, my);
  if (p.burst)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.3;
      const [sx, sy] = [Math.sin(a), -Math.cos(a)];
      for (let d = 15; d <= 19; d++) k.px(32 + sx * d * 1.35, 23 + bob + sy * d, d > 17 ? "G" : "g");
    }
  if (p.eyes === "hurt") for (const [x, y] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the dial on the shell's crown, the hind legs, and a pendulum swinging from the tail. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const lean = -(p.lean ?? 0) * 0.5;
  k.ellipse(13, 53 + bob * 0.5, 7, 6.5, SKIN);
  for (let i = 0; i < 3; i++) k.rect(9 + i * 3, Math.round(58 + bob * 0.5), 2, 1, "c");
  k.ellipse(32, 32 + bob + lean, 28, 20, RIM);
  k.ellipse(32, 29 + bob + lean, 26, 19, SHELL, [-0.5, -0.9]);
  scutes(k, [32, 26 + bob + lean], 16, [32, 29 + bob + lean], 26, 19);
  k.mirror();
  // the pendulum hangs from a short tail below the rim
  const swing = p.swing ?? 0;
  const ty = Math.round(49 + bob + lean);
  k.ellipse(32, ty, 3, 2.5, SKIN);
  const px = 32 + Math.sin(swing) * 10;
  const py = ty + Math.cos(swing) * 10;
  k.line(32, ty, Math.round(px), Math.round(py), "h");
  k.ellipse(px, py, 3.5, 3.5, ["g", "G", "n"]);
  bezel(k, 32, 26 + bob + lean, 14, (p.tick ?? 0) & 1);
  clock(k, 32, 26 + bob + lean, 14, p);
  if (p.burst)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.3;
      const [sx, sy] = [Math.sin(a), -Math.cos(a)];
      for (let d = 17; d <= 21; d++) k.px(32 + sx * d * 1.3, 26 + bob + sy * d, d > 19 ? "G" : "g");
    }
  if (p.eyes === "hurt") for (const [x, y] of [[4, 6], [56, 4]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Tortick (${side})`,
    palette,
    // one quarter per frame, so the hand goes round once per idle loop
    idle: [f({ tick: 0, swing: 0.35 }), f({ tick: 1, swing: 0, bob: -1 }), f({ tick: 2, swing: -0.35 }), f({ tick: 3, swing: 0, bob: 1, eyes: "shut" })],
    anims: {
      attack: [f({ tick: 0, tuck: 0.4, eyes: "focus", swing: 0.5 }), f({ tick: 1, eyes: "focus", glow: true, swing: -0.5 }), f({ tick: 2, lean: 3, eyes: "focus", glow: true, burst: true, swing: 0.6 })],
      hurt: [f({ tick: 3, tuck: 1, eyes: "hurt", bob: 1, swing: 0.7 }), f({ tick: 3, tuck: 0.6, eyes: "hurt", swing: -0.4 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const TORTICK_ART: CreatureArt = { id: "tortick", name: "Tortick", front: sheet("front"), back: sheet("back") };
