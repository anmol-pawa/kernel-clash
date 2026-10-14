import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Syscallow, the Bootstrap Gym's trainer creature: a courier swallow that
 * carries requests across the user/kernel boundary. It holds a sealed letter
 * (the system-call number stamped on the wax) in its beak, wears a brass
 * ring-0 band on one leg, and its forked tail streams out like the two sides
 * of a mode switch. Original design, 64×64.
 */
const palette = {
  o: "#0d0f24", // outline
  1: "#1b2452", // feather ramp (midnight blue), dark → light
  2: "#2f4192",
  3: "#4f6fd0",
  4: "#93b4ff",
  a: "#c8b896", // belly ramp
  b: "#efe4c6",
  d: "#fffaf0",
  r: "#8a2a1c", // rust throat ramp
  R: "#d0542e",
  S: "#ff9a5c",
  k: "#c78a1e", // beak / brass band
  K: "#ffd25a",
  e: "#0a0a16", // eyes
  w: "#ffffff",
  p: "#d7d2e6", // envelope paper
  P: "#8f88aa",
  x: "#b81d3a", // wax seal
  X: "#ff6a7a",
  g: "#7dffe6", // glow when the call is dispatched
  f: "#ff9a5c", // feet
} as const;

const FEATHER = ["1", "2", "3", "4"];
const BELLY = ["a", "b", "d"];
const THROAT = ["r", "R", "S"];

interface Pose {
  /** wingtip height: -1 up, 0 level, 1 down */
  flap?: number;
  /** body offset in px (+ = toward the viewer / down the screen) */
  lean?: number;
  /** a slower body bob for idle breathing */
  bob?: number;
  eyes?: "open" | "focus" | "shut" | "hurt";
  /** the letter: held in the beak, flung forward (attack) or dropped (hurt) */
  letter?: "held" | "thrown" | "none";
  /** wings swept back for a dive */
  dive?: boolean;
}

const EYE: Record<string, Grid> = {
  open: [".eee.", "ewwee", "ewwee", "eeeee", ".eee."],
  focus: ["ee...", ".eee.", "eweee", "eeeee", ".eee."],
  shut: [".....", ".....", "eeeee", ".eee.", "....."],
  hurt: ["e...e", ".e.e.", "..e..", ".e.e.", "e...e"],
};

/** One wing on the left half: a shaded arm from the shoulder plus a fan of primaries. */
function wing(k: PixelCanvas, oy: number, flap: number, dive: boolean) {
  const sx = 21;
  const sy = 33 + oy;
  const tip: [number, number] = dive ? [9, 22 + oy] : [3, 30 + oy + flap * 10];
  const mid: [number, number] = dive ? [13, 24 + oy] : [11, 27 + oy + flap * 6];
  k.tube([sx, sy], mid, tip, 6, 2, FEATHER);
  // primaries: long dark feathers trailing below the arm
  for (let i = 0; i < 4; i++) {
    const t = 0.35 + i * 0.2;
    const bx = Math.round(sx + (tip[0] - sx) * t);
    const by = Math.round(sy + (tip[1] - sy) * t);
    const len = dive ? 5 + i : 6 + i * 2;
    k.line(bx, by + 2, bx - (dive ? 1 : 2) - i, by + 2 + len, "1");
    k.line(bx + 1, by + 2, bx - (dive ? 0 : 1) - i, by + 2 + len, "2");
  }
}

function tail(k: PixelCanvas, oy: number, flap: number, long: number) {
  // two long streamers forking out from under the body
  k.tube([30, 48 + oy], [27, 56 + oy], [24 - flap, 63 - long], 3, 1, ["1", "2", "3"]);
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const lean = p.lean ?? 0;
  const bob = p.bob ?? 0;
  const oy = lean + bob;
  const flap = p.flap ?? 0;
  tail(k, oy, flap, 0);
  wing(k, oy, flap, !!p.dive);
  // body, belly and head
  k.ellipse(32, 42 + oy, 13 + lean * 0.3, 14, FEATHER);
  k.ellipse(32, 46 + oy, 8.5, 10, BELLY);
  k.ellipse(32, 21 + oy * 1.2, 12 + lean * 0.4, 11, FEATHER);
  // the dark cap, with a sheen
  k.ellipse(32, 15 + oy * 1.2, 10, 5, ["1", "2"], [-0.6, -0.8]);
  // feet
  k.line(25, 55 + oy, 24, 58 + oy, "f");
  k.line(22, 58 + oy, 25, 58 + oy, "f");
  k.mirror();
  const hy = Math.round(21 + oy * 1.2);
  // rust throat bib and cheek blaze
  k.ellipse(32, hy + 7, 7, 4, THROAT);
  k.rect(21, hy - 1, 3, 1, "4");
  k.rect(40, hy - 1, 3, 1, "4");
  // eyes
  const eye = EYE[p.eyes ?? "open"];
  k.stamp(eye, 23, hy - 4);
  k.stamp(eye, 36, hy - 4, true);
  // beak
  const open = p.letter === "thrown" || p.eyes === "hurt";
  k.stamp(open ? ["kKKKk", ".kKk.", ".....", ".kkk.", "..k.."] : ["kKKKk", ".kKk.", "..k.."], 30, hy + 2);
  // belly chevrons: the three rings between user and kernel
  for (let i = 0; i < 3; i++) {
    const cy = Math.round(44 + oy + i * 4);
    k.line(29, cy, 32, cy + 2, "a");
    k.line(35, cy, 32, cy + 2, "a");
  }
  // brass ring-0 band on the left leg
  k.rect(24, 55 + oy, 3, 2, "K");
  k.px(24, 56 + oy, "k");
  // the letter
  if (p.letter !== "none") {
    const thrown = p.letter === "thrown";
    const lx = thrown ? 23 : 25;
    const ly = thrown ? hy + 13 : hy + 4;
    const w = thrown ? 18 : 14;
    const h = thrown ? 12 : 9;
    if (thrown) k.rect(lx - 2, ly - 2, w + 4, h + 4, "g");
    k.rect(lx, ly, w, h, "p");
    k.rect(lx, ly + h - 1, w, 1, "P");
    k.rect(lx + w - 1, ly, 1, h, "P");
    // the flap's V
    const half = w >> 1;
    for (let i = 0; i < half; i++) {
      const vy = ly + Math.round((i * (h - 3)) / half);
      k.px(lx + i, vy, "P");
      k.px(lx + w - 1 - i, vy, "P");
    }
    const sx = lx + half - 2;
    const sy = ly + Math.round(h / 2) - 1;
    k.stamp([".xx.", "xXXx", "xXxx", ".xx."], sx, sy);
  }
  if (p.eyes === "hurt") for (const [x, y] of [[6, 8], [52, 10]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the dark mantle, both wings, the forked tail streaming down and the letter's corner under the chin. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const oy = -(p.lean ?? 0) + (p.bob ?? 0);
  const flap = p.flap ?? 0;
  tail(k, oy - 2, flap, -2);
  wing(k, oy, flap, !!p.dive);
  k.ellipse(32, 43 + oy, 15, 15, FEATHER, [-0.5, -0.9]);
  k.ellipse(32, 22 + oy, 13, 12, ["1", "1", "2", "3"], [-0.5, -0.6]);
  k.mirror();
  // the rust collar where the throat wraps round the nape
  const ny = Math.round(32 + oy);
  for (let x = 21; x <= 43; x++) {
    const d = Math.abs(x - 32);
    const y = ny - Math.round((d * d) / 60);
    k.px(x, y, d > 8 ? "r" : "R");
    k.px(x, y + 1, "r");
  }
  // the mantle: rows of scalloped feather edges between the wings
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3 - (r & 1); c++) {
      const x = 23 + c * 7 + (r & 1) * 3;
      const y = Math.round(37 + oy + r * 5);
      k.stamp(["2....2", ".2222."], x, y);
    }
  // primaries' white wing bars
  k.line(14, Math.round(36 + oy), 20, Math.round(38 + oy), "4");
  k.line(50, Math.round(36 + oy), 44, Math.round(38 + oy), "4");
  // the letter's corner held under the chin when it isn't thrown
  if ((p.letter ?? "held") === "held") k.stamp(["pppppp", "pPPPPp"], 13, Math.round(25 + oy));
  if (p.letter === "thrown") k.stamp(["gggggg", "gppppg", "gpxxpg", "gggggg"], 29, Math.max(0, Math.round(2 + oy)));
  if (p.eyes === "hurt") for (const [x, y] of [[6, 10], [53, 8]]) k.stamp(["w.w", ".w.", "w.w"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Syscallow (${side})`,
    palette,
    idle: [f({ flap: 0 }), f({ flap: -1, bob: -1 }), f({ flap: 0 }), f({ flap: 1, bob: 1, eyes: "shut" })],
    anims: {
      attack: [f({ flap: -1, bob: -2, eyes: "focus" }), f({ dive: true, lean: 3, eyes: "focus" }), f({ dive: true, lean: 4, eyes: "focus", letter: "thrown" })],
      hurt: [f({ flap: 1, lean: -2, eyes: "hurt", letter: "none" }), f({ flap: 0, lean: -1, eyes: "hurt", letter: "none" })],
    },
    fps: { idle: 4, attack: 6, hurt: 6 },
  };
}

export const SYSCALLOW_ART: CreatureArt = { id: "syscallow", name: "Syscallow", front: sheet("front"), back: sheet("back") };
