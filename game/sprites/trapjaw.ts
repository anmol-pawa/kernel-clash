import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Trapjaw, boss of the Bootstrap Gym (OS basics): a squat gatekeeper whose
 * whole face is a hinged trap. An iron helmet stamped with a keyhole guards
 * the kernel; spring-coil hinges snap the jaw shut on any illegal
 * instruction. Original design, 96×96.
 */
const palette = {
  o: "#140b24", // outline
  1: "#2b1d55", // hide ramp (gym violet), dark → light
  2: "#4a378f",
  3: "#7562c8",
  4: "#b4a6f4",
  i: "#2c3245", // iron helmet ramp
  I: "#566079",
  J: "#929cb6",
  q: "#d5dbeb",
  y: "#b0741c", // brass (keyhole, hinges, rivets)
  Y: "#f0c04a",
  Z: "#fff0a8",
  m: "#1c0713", // mouth
  M: "#7c1d3c", // tongue
  t: "#cfc6b0", // teeth / claws
  T: "#fffaf0",
  e: "#ffcc33", // eyes
  E: "#fff6c6",
} as const;

const W = 96;
const HIDE = ["1", "2", "3", "4"];
const IRON = ["i", "I", "J", "q"];
const BRASS = ["y", "Y", "Z"];

interface Pose {
  /** body vertical offset (negative = up) */
  oy?: number;
  /** mouth gap height in px */
  gap?: number;
  blink?: boolean;
  hurt?: boolean;
  /** spring horns flex outward */
  flex?: number;
  /** front feet lift (stomp) */
  lift?: number;
}

/** A coiled brass spring hinge. */
function coil(k: PixelCanvas, cx: number, cy: number) {
  k.ellipse(cx, cy, 5.5, 6.5, BRASS);
  for (const dy of [-3, 0, 3]) k.line(cx - 4, cy + dy + 1, cx + 4, cy + dy - 1, "y");
  k.px(cx - 2, cy - 4, "Z");
}

/** Interlocking teeth along the lips; `y0` is the upper lip, `y1` the lower lip. */
function teeth(k: PixelCanvas, y0: number, y1: number, lip: (x: number) => number) {
  for (let x = 20; x <= 72; x += 7) {
    const u = y0 + lip(x + 2);
    k.stamp(["tTTt", ".tT.", ".tt.", "..t."], x, u);
    const l = y1 + lip(x + 5);
    k.stamp([".t..", ".tt.", ".Tt.", "tTTt"], x + 3, l - 3);
  }
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const oy = p.oy ?? 0;
  const gap = p.gap ?? 2;
  const flex = p.flex ?? 0;
  const lift = p.lift ?? 0;
  // back legs, then spring horns behind the helmet
  k.ellipse(20, 78, 9, 10, ["1", "2", "3"]);
  k.tube([28, 30 + oy], [12 - flex, 20 + oy], [16 - flex, 7 + oy], 3.5, 1.6, IRON);
  k.ellipse(16 - flex, 6 + oy, 2.5, 2.5, BRASS);
  for (const [x, y] of [[21, 25], [15, 18], [14, 12]]) k.rect(x - flex - 2, y + oy, 5, 1, "Y");
  // body and jaw hinge
  k.ellipse(48, 62 + oy, 39, 25, HIDE);
  coil(k, 11, 61 + oy);
  // front legs with claws
  k.ellipse(30, 84 - lift, 10, 9, HIDE);
  k.stamp(["T.T.T", "t.t.t"], 25, 92 - lift);
  // iron helmet (the upper jaw)
  k.ellipse(48, 42 + oy, 32, 21, IRON, [-0.35, -0.6]);
  k.mirror();

  // mouth: a wide grin-shaped gap between helmet and lower jaw
  const lip = (x: number) => Math.round(((x - 48) / 32) ** 2 * -5);
  const mouthTop = 57 + oy;
  for (let x = 16; x <= 80; x++) {
    const top = mouthTop + lip(x);
    const g = Math.max(1, Math.round(gap * (1 - ((x - 48) / 34) ** 2)));
    k.rect(x, top, 1, g, "m");
    if (gap > 6 && Math.abs(x - 48) < 14) k.rect(x, top + g - 4, 1, 3, "M");
  }
  if (gap > 6) k.rect(42, mouthTop + gap - 4, 12, 1, "3"); // tongue shine
  teeth(k, mouthTop, mouthTop + gap, lip);

  // helmet rim, rivets and keyhole plate
  for (let x = 20; x <= 76; x++) k.px(x, mouthTop - 2 + lip(x), "i");
  for (const x of [22, 34, 62, 74]) {
    k.px(x, mouthTop - 4 + lip(x), "Y");
    k.px(x + 1, mouthTop - 4 + lip(x), "y");
  }
  k.ellipse(48, 28 + oy, 7, 7.5, BRASS);
  k.stamp([".mmm.", "mmmmm", "mmmmm", ".mmm.", "..m..", ".mmm.", ".mmm.", "mmmmm"], 46, 24 + oy);
  k.rect(44, 21 + oy, 2, 1, "Z");
  // helmet shine
  k.rect(27, 30 + oy, 5, 1, "q");
  k.rect(25, 32 + oy, 3, 1, "q");

  // eyes under a scowling brow
  const eye: Grid = p.hurt
    ? ["mmmmmmm", "me...em", "mme.emm", "mmmemmm", "mme.emm", "me...em", ".mmmmm."]
    : p.blink
      ? ["mmmmmmm", "mmmmmmm", "mmmmmmm", "meeeeem", "mmeeemm", "mmmmmmm", ".mmmmm."]
      : ["mmmmmmm", "mmEEeem", "mEEeeem", "meemeem", "meemeem", "mmeeemm", ".mmmmm."];
  k.stamp(eye, 30, 42 + oy);
  k.stamp(eye, 59, 42 + oy, true);
  k.line(28, 40 + oy, 38, 43 + oy, "i");
  k.line(28, 39 + oy, 38, 42 + oy, "i");
  k.line(68, 40 + oy, 58, 43 + oy, "i");
  k.line(68, 39 + oy, 58, 42 + oy, "i");

  // belly plates under the jaw
  for (const [x, w] of [[38, 20], [41, 14]] as const) k.rect(x, 74 + oy + (x - 38), w, 1, "2");
  if (p.hurt) for (const [x, y] of [[6, 30], [84, 26]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the helmet's keyhole lock plate, coil tail and four planted legs. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const oy = p.oy ?? 0;
  const flex = p.flex ?? 0;
  const lift = p.lift ?? 0;
  k.tube([30, 34 + oy], [14 - flex, 22 + oy], [18 - flex, 8 + oy], 4, 1.8, IRON);
  k.ellipse(18 - flex, 7 + oy, 3, 3, BRASS);
  for (const [x, y] of [[23, 28], [17, 20], [16, 13]]) k.rect(x - flex - 2, y + oy, 6, 1, "Y");
  k.ellipse(48, 60 + oy, 42, 28, HIDE);
  k.ellipse(22, 86 - lift, 11, 8, HIDE);
  k.ellipse(48, 42 + oy, 34, 24, IRON, [-0.35, -0.6]);
  k.mirror();
  // jaw corners visible past the helmet when it opens to bite
  if ((p.gap ?? 2) > 6)
    for (const x of [7, 83]) {
      k.rect(x, 52 + oy, 6, 5, "m");
      k.stamp(["T.T", "t.t"], x + 1, 52 + oy);
    }
  coil(k, 9, 58 + oy);
  coil(k, 87, 58 + oy);
  // the big lock plate
  k.ellipse(48, 40 + oy, 13, 14, BRASS);
  k.stamp(["..mmmm..", ".mmmmmm.", "mmmmmmmm", "mmmmmmmm", ".mmmmmm.", "..mmmm..", "...mm...", "..mmmm..", "..mmmm..", ".mmmmmm.", ".mmmmmm."], 44, 33 + oy);
  k.rect(41, 30 + oy, 3, 1, "Z");
  for (const [x, y] of [[22, 38], [74, 38], [30, 26], [66, 26], [26, 52], [70, 52]]) {
    k.px(x, y + oy, "Y");
    k.px(x + 1, y + oy, "y");
  }
  k.rect(24, 30 + oy, 6, 1, "q");
  k.rect(22, 32 + oy, 3, 1, "q");
  // coil tail
  for (let i = 0; i < 4; i++) k.ellipse(48, 80 + oy + i * 3, 6 - i, 2.5, BRASS);
  // hide ridges between helmet and tail
  for (const [x, y, w] of [[34, 68, 8], [54, 68, 8], [38, 72, 5], [53, 72, 5]]) k.rect(x, y + oy, w, 1, "2");
  if (p.hurt) for (const [x, y] of [[4, 20], [86, 16]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Trapjaw (${side})`,
    palette,
    idle: [f({}), f({ oy: 1, gap: 3 }), f({ oy: 1, gap: 3, flex: 1 }), f({ blink: true })],
    anims: {
      attack: [f({ oy: -3, gap: 13, flex: 3, lift: 2 }), f({ oy: -2, gap: 16, flex: 4, lift: 3 }), f({ oy: 2, gap: 1, flex: -1 })],
      hurt: [f({ hurt: true, oy: 2, gap: 5, flex: -2 }), f({ hurt: true, oy: 1, gap: 4, flex: 2 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const TRAPJAW_ART: CreatureArt = { id: "trapjaw", name: "Trapjaw", boss: true, front: sheet("front"), back: sheet("back") };
