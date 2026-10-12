import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Chronogolem, boss of the Clocktower Gym (CPU scheduling): a mossy stone
 * golem built round a clock. The dial in its chest ticks out time slices,
 * brass gears turn in its shoulders, and a bell tower crowns its head to ring
 * the end of every quantum. Original design, 96×96.
 */
const palette = {
  o: "#1a0f08", // outline
  s: "#3b3530", // stone ramp, dark → light
  S: "#625850",
  d: "#8f8478",
  D: "#c4baa8",
  1: "#7a3d0c", // bronze ramp (gym amber)
  2: "#b8641a",
  3: "#e89a2c",
  4: "#ffd77a",
  f: "#d9cba6", // clock face
  F: "#fffaf0",
  h: "#2a1a10", // clock hands and numerals
  e: "#3fd8ff", // eyes
  E: "#d8fbff",
  m: "#120a06", // deep shadow / sockets
  g: "#4f6e24", // moss
  G: "#8fb84a",
} as const;

const W = 96;
const STONE = ["s", "S", "d", "D"];
const BRONZE = ["1", "2", "3", "4"];
const MOSS = ["g", "G"];

interface Pose {
  /** body vertical offset (negative = up) */
  oy?: number;
  /** clock hand angles in ticks (minute hand / 60, hour hand / 12) */
  min?: number;
  hour?: number;
  /** gear rotation phase in radians */
  turn?: number;
  /** fists: 0 at sides, 1 raised overhead, -1 slammed forward */
  arms?: number;
  blink?: boolean;
  hurt?: boolean;
  /** eyes blaze white */
  blaze?: boolean;
}

/** A brass gear: teeth round the rim, a shaded wheel, a hub and an axle hole. */
function gear(k: PixelCanvas, cx: number, cy: number, r: number, teeth: number, phase: number) {
  for (let i = 0; i < teeth; i++) {
    const a = phase + (i * Math.PI * 2) / teeth;
    k.ellipse(cx + Math.cos(a) * (r + 0.5), cy + Math.sin(a) * (r + 0.5), 1.6, 1.6, ["2", "3"]);
  }
  k.ellipse(cx, cy, r, r, BRONZE);
  k.ellipse(cx, cy, r * 0.55, r * 0.55, ["1", "2"]);
  k.ellipse(cx, cy, Math.max(1, r * 0.22), Math.max(1, r * 0.22), ["m"]);
}

/** The chest dial: brass rim, 12 tick marks and two hands. */
function dial(k: PixelCanvas, cx: number, cy: number, r: number, p: Pose) {
  k.ellipse(cx, cy, r + 2, r + 2, BRONZE);
  k.ellipse(cx, cy, r, r, ["f", "f", "F"]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const big = i % 3 === 0;
    k.px(cx + Math.sin(a) * (r - 1.5), cy - Math.cos(a) * (r - 1.5), "h");
    if (big) k.px(cx + Math.sin(a) * (r - 2.5), cy - Math.cos(a) * (r - 2.5), "h");
  }
  if (p.hurt) {
    // the glass cracks
    k.line(cx - r + 3, cy - 3, cx - 2, cy + 1, "s");
    k.line(cx - 2, cy + 1, cx + 3, cy - 4, "s");
    k.line(cx + 3, cy - 4, cx + r - 3, cy + 2, "s");
  }
  const am = ((p.min ?? 0) / 60) * Math.PI * 2;
  const ah = ((p.hour ?? 4) / 12) * Math.PI * 2;
  k.line(cx, cy, cx + Math.sin(am) * (r - 3), cy - Math.cos(am) * (r - 3), "h");
  k.line(cx, cy, cx + Math.sin(ah) * (r - 6), cy - Math.cos(ah) * (r - 6), "h");
  k.line(cx + 1, cy, cx + 1 + Math.sin(ah) * (r - 7), cy - Math.cos(ah) * (r - 7), "h");
  k.ellipse(cx, cy, 1.5, 1.5, ["2", "4"]);
}

/** A stone fist with a bronze knuckle band and finger seams. */
function fist(k: PixelCanvas, x: number, y: number, r: number) {
  k.ellipse(x, y, r, r * 0.9, STONE);
  k.rect(Math.round(x - r + 2), Math.round(y - 2), Math.round(r * 2 - 3), 2, "2");
  k.rect(Math.round(x - r + 3), Math.round(y - 2), Math.round(r - 2), 1, "3");
  for (const dx of [-3, 1, 5]) k.line(x + dx - 2, y + 2, x + dx - 2, y + r * 0.6, "S");
}

/** Arm and fist on the left side (mirrored for the right). A slam's fists are drawn later, in front. */
function arm(k: PixelCanvas, oy: number, arms: number) {
  if (arms > 0) {
    // raised: stamp the tube from the fist down so the lit upper edges stay visible
    k.tube([17, 12 + oy], [4, 26 + oy], [18, 38 + oy], 6, 6.5, STONE);
    fist(k, 17, 10 + oy, 9.5);
  } else if (arms < 0) k.tube([18, 38 + oy], [8, 56 + oy], [26, 70 + oy], 6.5, 6, STONE);
  else {
    k.tube([18, 38 + oy], [4, 50 + oy], [11, 64 + oy], 6.5, 6, STONE);
    fist(k, 11, 64 + oy, 9.5);
  }
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const oy = p.oy ?? 0;
  const arms = p.arms ?? 0;
  // legs and bronze-capped feet
  k.ellipse(32, 80 + oy * 0.5, 10, 11, STONE);
  k.ellipse(30, 90, 12, 5, STONE);
  k.rect(20, 89, 18, 2, "2");
  k.rect(21, 89, 8, 1, "3");
  // torso, then shoulders and arms
  k.ellipse(48, 54 + oy, 30, 25, STONE);
  if (arms <= 0) arm(k, oy, arms);
  // head: a little bell tower with a bronze dome
  k.ellipse(48, 9 + oy, 8, 6, BRONZE);
  k.rect(47, 1 + oy, 3, 3, "2");
  k.px(48, 1 + oy, "4");
  k.ellipse(48, 24 + oy, 15, 12, STONE);
  // shoulder gear pauldron
  gear(k, 18, 34 + oy, 10, 9, p.turn ?? 0);
  if (arms > 0) arm(k, oy, arms);
  // moss on the shoulder ledge and brow
  for (const [x, y, w] of [[26, 31, 6], [28, 30, 3], [36, 14, 5]] as const) k.rect(x, y + oy, w, 1, MOSS[(x + y) & 1]);
  k.mirror();

  // bell under the dome arch
  k.ellipse(48, 11 + oy, 3, 3, ["1", "2", "3"]);
  k.rect(45, 7 + oy, 7, 1, "m");
  // eyes: a visor slit glowing cyan
  k.rect(36, 23 + oy, 25, 6, "m");
  for (const s of [-1, 1]) {
    const cx = 48 + s * 6;
    if (p.hurt) k.stamp(["e...e", ".e.e.", "..e..", ".e.e."], cx - 2, 23 + oy);
    else if (p.blink) k.rect(cx - 3, 26 + oy, 6, 1, "e");
    else if (p.blaze) k.stamp(["eEEEe", "EEEEE", "EEEEE", "eEEEe"], cx - 2, 24 + oy);
    else k.stamp([".eee.", "eEEee", "eeeee", ".eee."], cx - 2, 24 + oy);
  }
  // stone brow and jaw grille
  k.rect(34, 21 + oy, 29, 2, "d");
  k.rect(35, 21 + oy, 10, 1, "D");
  for (let x = 41; x <= 55; x += 3) k.rect(x, 31 + oy, 1, 3, "S");
  // chest dial
  dial(k, 48, 52 + oy, 12, p);
  // stone block seams and cracks
  for (const [x0, y0, x1, y1] of [[26, 66, 38, 68], [58, 68, 70, 66], [24, 46, 30, 48], [44, 73, 52, 73]] as const) k.line(x0, y0 + oy, x1, y1 + oy, "S");
  k.rect(28, 40 + oy, 6, 1, "D");
  k.rect(27, 42 + oy, 3, 1, "D");
  if (arms < 0) {
    fist(k, 30, 76 + oy, 12);
    fist(k, 66, 76 + oy, 12);
    for (const [x, y] of [[14, 88], [78, 88]]) k.stamp(["d.D.d", ".D.D.", "d.D.d"], x, y);
  }
  if (p.hurt) {
    k.line(64, 38 + oy, 70, 50 + oy, "m");
    k.line(70, 50 + oy, 66, 58 + oy, "m");
    for (const [x, y] of [[4, 6], [86, 10]]) k.stamp(["4.4", ".3.", "4.4"], x, y);
  }
  k.outline("o");
  return k.toGrid();
}

/** From behind: the back panel opens on turning gears and a swinging pendulum. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const oy = p.oy ?? 0;
  const arms = p.arms ?? 0;
  const turn = p.turn ?? 0;
  k.ellipse(30, 82 + oy * 0.5, 11, 11, STONE);
  k.ellipse(28, 91, 12, 4, STONE);
  k.ellipse(48, 54 + oy, 33, 27, STONE);
  if (arms <= 0) arm(k, oy, arms);
  k.ellipse(48, 10 + oy, 9, 7, BRONZE);
  k.rect(47, 1 + oy, 3, 3, "2");
  k.ellipse(48, 24 + oy, 16, 12, STONE);
  gear(k, 16, 34 + oy, 11, 9, turn);
  if (arms > 0) arm(k, oy, arms);
  for (const [x, y, w] of [[24, 30, 6], [34, 13, 6], [22, 74, 5]] as const) k.rect(x, y + oy, w, 1, MOSS[(x + y) & 1]);
  k.mirror();

  // open back panel: three meshing gears turning against each other
  k.ellipse(48, 52 + oy, 20, 18, ["m", "s"]);
  gear(k, 40, 46 + oy, 8, 8, turn);
  gear(k, 57, 50 + oy, 6, 7, -turn * 1.3 + 0.3);
  gear(k, 45, 61 + oy, 5, 6, -turn * 1.6);
  // panel rim and rivets
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    k.px(48 + Math.cos(a) * 21, 52 + oy + Math.sin(a) * 19, i % 2 ? "3" : "1");
  }
  // pendulum swinging beneath the panel
  const sw = Math.sin(turn * 2) * 5;
  k.line(48, 66 + oy, 48 + sw, 76 + oy, "1");
  k.ellipse(48 + sw, 78 + oy, 4, 4, BRONZE);
  // the back of the head: stone with a bronze vent
  k.rect(41, 22 + oy, 15, 2, "1");
  k.rect(41, 26 + oy, 15, 2, "1");
  k.rect(42, 22 + oy, 6, 1, "3");
  k.rect(26, 40 + oy, 6, 1, "D");
  if (arms < 0) {
    fist(k, 30, 76 + oy, 12);
    fist(k, 66, 76 + oy, 12);
  }
  if (p.hurt) for (const [x, y] of [[4, 6], [86, 10]]) k.stamp(["4.4", ".3.", "4.4"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  const T = Math.PI / 9; // one gear-tooth step
  return {
    name: `Chronogolem (${side})`,
    palette,
    idle: [
      f({ min: 0, turn: 0 }),
      f({ min: 15, turn: T * 0.5, oy: 1 }),
      f({ min: 30, turn: T, oy: 1 }),
      f({ min: 45, turn: T * 1.5, blink: true }),
    ],
    anims: {
      attack: [
        f({ min: 50, hour: 2, turn: T * 2, arms: 1, oy: -3, blaze: true }),
        f({ min: 5, hour: 5, turn: T * 3, arms: 1, oy: -4, blaze: true }),
        f({ min: 20, hour: 8, turn: T * 4, arms: -1, oy: 2 }),
      ],
      hurt: [f({ min: 37, hour: 9, hurt: true, oy: 2 }), f({ min: 33, hour: 1, hurt: true, oy: 1, turn: T * 0.3 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const CHRONOGOLEM_ART: CreatureArt = { id: "chronogolem", name: "Chronogolem", boss: true, front: sheet("front"), back: sheet("back") };
