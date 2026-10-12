import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Mutexa, boss of the Mutex Marsh Gym (synchronization): a hooded
 * lock-serpent coiled round the critical section. Its head is a padlock (a
 * steel shackle arcs over a keyhole brow), its hood is marked with keyholes,
 * and its tail ends in the one key, so only one may pass at a time.
 * Original design, 96×96.
 */
const palette = {
  o: "#1d0717", // outline
  1: "#6a1a52", // scale ramp (gym magenta), dark → light
  2: "#a02a7c",
  3: "#e05aa8",
  4: "#ffaedb",
  b: "#a8875a", // belly scutes
  B: "#dcc28c",
  n: "#fff0c8",
  i: "#2e3346", // steel shackle and plates
  I: "#5c6681",
  J: "#99a3bd",
  q: "#e0e6f2",
  y: "#a8701a", // the gold key
  Y: "#f2c040",
  Z: "#fff2a0",
  e: "#b6ff3a", // eyes
  E: "#f0ffc8",
  m: "#14040f", // mouth / keyholes
  M: "#e0405e", // tongue
  t: "#fffaf0", // fangs
} as const;

const W = 96;
const SCALE = ["1", "2", "3", "4"];
const BELLY = ["b", "B", "n"];
const STEEL = ["i", "I", "J", "q"];
const GOLD = ["y", "Y", "Z"];

type P = [number, number];

interface Pose {
  /** head offset */
  hx?: number;
  hy?: number;
  /** extra hood half-width (flare) */
  flare?: number;
  /** head radius bonus (striking toward the viewer) */
  grow?: number;
  open?: boolean;
  tongue?: boolean;
  blink?: boolean;
  hurt?: boolean;
  /** tail-key sway */
  tail?: number;
}

/** Three stacked coils, widest at the bottom, with shadowed gaps between them. */
function coils(k: PixelCanvas, back: boolean) {
  const rings: [number, number, number][] = [
    [85, 42, 9],
    [76, 35, 8.5],
    [67, 27, 7.5],
  ];
  for (const [y, rx, ry] of rings) {
    k.ellipse(48, y, rx, ry, SCALE);
    // a row of scale glints along each coil's upper curve
    for (let x = 48 - rx + 5; x < 48 + rx - 5; x += 5) {
      const dy = Math.round(-ry * 0.45 * Math.sqrt(1 - ((x - 48) / rx) ** 2));
      k.px(x, y + dy, x < 48 ? "4" : "3");
      k.px(x + 1, y + dy + 1, "2");
    }
    if (!back) k.rect(48 - Math.round(rx * 0.5), Math.round(y - ry * 0.55), Math.round(rx * 0.35), 1, "4");
    k.line(48 - rx + 4, y + ry - 1, 48 + rx - 4, y + ry - 1, "1");
  }
}

/** The tail curling out to the right and holding up a gold key. */
function tailKey(k: PixelCanvas, sway: number, flip: boolean) {
  const X = (x: number) => (flip ? 96 - x : x);
  k.tube([X(80), 86], [X(96), 82], [X(88), 66 + sway], 5.5, 2.5, SCALE);
  // key bow (a ring) gripped by the tail tip, the shaft rising from it
  const bx = X(88);
  const by = 60 + sway;
  k.rect(bx - 1, by - 22, 3, 18, "Y");
  k.rect(bx - 1, by - 22, 1, 18, "Z");
  k.rect(bx + 1, by - 22, 1, 18, "y");
  // the bit: two notched wards sticking out sideways near the top
  k.stamp(flip ? ["YYYY.", "Y.Yy.", "YYYy.", "..Yy.", "YYYy."] : [".yYYY", ".yY.Y", ".yYYY", ".yY..", ".yYYY"], flip ? bx + 2 : bx - 6, by - 21);
  k.ellipse(bx, by, 5.5, 5.5, GOLD);
  k.ellipse(bx, by, 2.2, 2.2, ["m"]);
}

/** The hood: a wide flare behind the head, painted with keyhole eyespots. */
function hood(k: PixelCanvas, hx: number, hy: number, flare: number, front: boolean) {
  k.ellipse(48 + hx * 0.5, hy + 14, 25 + flare, 21, SCALE);
  // ribbed hood edges
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.line(48 + hx * 0.5 + s * (14 + flare + i * 2), hy + 2 + i * 2, 48 + hx * 0.5 + s * (16 + flare + i * 2), hy + 26 - i * 2, "2");
  if (front) {
    k.ellipse(48 + hx * 0.5, hy + 22, 10, 15, BELLY);
    for (let y = hy + 12; y < hy + 36; y += 3) k.line(39 + hx * 0.5, y, 57 + hx * 0.5, y, "b");
  }
  for (const s of [-1, 1]) {
    const cx = Math.round(48 + hx * 0.5 + s * (16 + flare * 0.6));
    const cy = hy + 16;
    k.ellipse(cx, cy, 5.5, 6.5, STEEL);
    k.stamp([".mm.", "mmmm", "mmmm", ".mm.", ".mm.", "mmmm"], cx - 2, cy - 3);
  }
}

/** A padlock head: steel shackle over a keyhole brow plate, slit eyes, fangs. */
function head(k: PixelCanvas, p: Pose, hx: number, hy: number) {
  const g = p.grow ?? 0;
  const x = 48 + hx;
  const y = hy;
  const r = 13 + g;
  // shackle arcs over the skull
  k.tube([x - r * 0.6, y - r * 0.3], [x, y - r * 3], [x + r * 0.6, y - r * 0.3], 3, 3, STEEL);
  // a dark rim parts the head from the hood behind it
  k.ellipse(x, y + 1, r + 1.5, r * 0.85 + 1.5, ["1"]);
  k.ellipse(x, y, r, r * 0.85, SCALE);
  // jaw
  if (p.open) {
    k.ellipse(x, y + r * 0.75, r * 0.7, r * 0.55, ["m"]);
    k.ellipse(x, y + r * 0.9, r * 0.38, r * 0.25, ["M"]);
    k.ellipse(x, y + r * 1.25, r * 0.66, r * 0.28, SCALE);
    for (const dx of [-0.42, 0.42]) {
      const fx = Math.round(x + dx * r) - (dx < 0 ? 0 : 1);
      k.rect(fx, Math.round(y + r * 0.42), 2, Math.round(r * 0.45), "t");
      k.px(fx + (dx < 0 ? 1 : 0), Math.round(y + r * 0.42 + r * 0.45), "t");
    }
  } else {
    k.ellipse(x, y + r * 0.5, r * 0.75, r * 0.38, SCALE);
    k.line(x - r * 0.5, y + r * 0.72, x + r * 0.5, y + r * 0.72, "m");
    if (p.tongue) k.stamp(["..M..", "..M..", ".M.M.", "M...M"], Math.round(x) - 2, Math.round(y + r * 0.78));
  }
  // steel brow plate with a keyhole
  k.rect(Math.round(x - r * 0.55), Math.round(y - r * 0.62), Math.round(r * 1.1), Math.round(r * 0.45), "I");
  k.rect(Math.round(x - r * 0.55), Math.round(y - r * 0.62), Math.round(r * 1.1), 1, "q");
  k.stamp(["m", "m"], Math.round(x), Math.round(y - r * 0.55));
  // nostrils
  k.px(x - 2, y + r * 0.35, "m");
  k.px(x + 2, y + r * 0.35, "m");
  // eyes: slit pupils under the plate
  for (const s of [-1, 1]) {
    const cx = Math.round(x + s * r * 0.5);
    const ey = Math.round(y - r * 0.08);
    if (p.hurt) k.stamp(["m..m", ".mm.", ".mm.", "m..m"], cx - 2, ey - 1);
    else if (p.blink) k.rect(cx - 2, ey + 1, 4, 1, "m");
    else k.stamp(s < 0 ? ["mEEe", "eEme", "eeme", "eeme", ".em."] : ["eEEm", "eEme", "eeme", "eeme", ".me."], cx - 2, ey - 1);
  }
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const hx = p.hx ?? 0;
  const hy = 28 + (p.hy ?? 0);
  tailKey(k, p.tail ?? 0, false);
  coils(k, false);
  // the neck rising from the top coil in an S-curve
  const neck: [P, P, P] = [[40, 70], [64, 58], [48 + hx * 0.5, hy + 20]];
  k.tube(...neck, 8, 7, SCALE);
  hood(k, hx, hy, p.flare ?? 0, true);
  head(k, p, hx, hy);
  if (p.hurt) for (const [x, y] of [[6, 14], [84, 10]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the back of the hood carries a chain of steel links down to the coils. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const hx = p.hx ?? 0;
  const hy = 30 + (p.hy ?? 0);
  tailKey(k, p.tail ?? 0, true);
  coils(k, true);
  k.tube([56, 70], [32, 58], [48 + hx * 0.5, hy + 20], 9, 8, SCALE);
  hood(k, hx, hy, (p.flare ?? 0) + 2, false);
  // chain of links down the hood's back
  for (let i = 0; i < 5; i++) {
    const cx = Math.round(48 + hx * 0.5 * (1 - i / 5));
    const cy = hy + 8 + i * 7;
    if (i % 2) k.stamp(["..qJJ..", ".J...I.", "J.....I", ".I...i.", "..III.."], cx - 3, cy - 1);
    else k.stamp([".qJ.", "qJJI", "JJII", "JIIi", "JIIi", "IIii", ".ii."], cx - 2, cy - 1);
  }
  // back of the head and the shackle from behind
  const x = 48 + hx;
  const r = 13 + (p.grow ?? 0);
  k.tube([x - r * 0.6, hy - r * 0.3], [x, hy - r * 3], [x + r * 0.6, hy - r * 0.3], 3, 3, STEEL);
  k.ellipse(x, hy, r, r * 0.85, SCALE);
  k.rect(Math.round(x - r * 0.5), Math.round(hy - r * 0.2), Math.round(r), 1, "2");
  k.rect(Math.round(x - r * 0.4), Math.round(hy + r * 0.2), Math.round(r * 0.8), 1, "2");
  // jaw corners show when it strikes
  if (p.open) for (const s of [-1, 1]) k.stamp(["t.", "tm", "mm"], Math.round(x + s * (r + 1)) - (s < 0 ? 1 : 0), hy + 3);
  if (p.hurt) for (const [x0, y0] of [[6, 14], [84, 10]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x0, y0);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Mutexa (${side})`,
    palette,
    idle: [
      f({}),
      f({ hx: 1, hy: 1, flare: 1, tail: 1 }),
      f({ hx: 2, hy: 1, flare: 1, tongue: true, tail: 1 }),
      f({ hx: 1, blink: true }),
    ],
    anims: {
      attack: [f({ hy: -4, flare: 4, open: true, tail: -1 }), f({ hy: 6, flare: 3, open: true, grow: 3, tail: -2 }), f({ hy: 2, flare: 1, grow: 1 })],
      hurt: [f({ hx: -6, hy: -2, flare: -2, hurt: true, tail: 2 }), f({ hx: -4, hy: 0, flare: -1, hurt: true, tail: 1 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const MUTEXA_ART: CreatureArt = { id: "mutexa", name: "Mutexa", boss: true, front: sheet("front"), back: sheet("back") };
