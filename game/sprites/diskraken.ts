import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Diskraken, boss of the Platter Peak Gym (storage): a moss-green kraken
 * squatting on the spindle of a giant disk platter. The platter spins under
 * it (a bright sector sweeps round the tracks), and one tentacle ends in a
 * steel read/write head that seeks from track to track like a disk arm on a
 * SCAN sweep. Original design, 96×96.
 */
const palette = {
  o: "#0c160a", // outline
  1: "#2c4a14", // hide ramp (gym green), dark → light
  2: "#4a7a1e",
  3: "#7cb83a",
  4: "#c4ec7a",
  i: "#3a4256", // platter steel ramp
  I: "#6e7a94",
  J: "#aab4c8",
  K: "#e8eef8",
  p: "#a04a6a", // suckers
  P: "#f0a0c0",
  y: "#b88a10", // eyes
  Y: "#ffe060",
  e: "#0a0a10",
  t: "#fffaf0",
  R: "#ff4040", // read-head LED
  Z: "#fff6c0", // sparks
} as const;

const W = 96;
const HIDE = ["1", "2", "3", "4"];

type Pt = [number, number];

interface Pose {
  by?: number;
  bx?: number;
  /** platter rotation, in quarter turns */
  spin?: number;
  /** read/write head track, 0 (inner) … 1 (outer) */
  seek?: number;
  /** tentacle sway */
  sway?: number;
  /** tentacles raised for a slam (0..1), or slammed down (−1) */
  rear?: number;
  blink?: boolean;
  hurt?: boolean;
  glare?: boolean;
  sparks?: boolean;
}

function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

/** A tapering tentacle with a row of suckers along its underside. */
function tentacle(k: PixelCanvas, p0: Pt, p1: Pt, p2: Pt, r0: number, r1: number, side: number) {
  k.tube(p0, p1, p2, r0, r1, HIDE);
  for (let i = 2; i < 10; i++) {
    const t = i / 10;
    const [x, y] = quad(p0, p1, p2, t);
    const [x2, y2] = quad(p0, p1, p2, t + 0.01);
    const len = Math.hypot(x2 - x, y2 - y) || 1;
    // normal to the curve, on the chosen side
    const nx = (-(y2 - y) / len) * side;
    const ny = ((x2 - x) / len) * side;
    const r = (r0 + (r1 - r0) * t) * 0.6;
    k.px(x + nx * r, y + ny * r, i % 2 ? "P" : "p");
  }
}

/** The platter in perspective: a steel rim, concentric tracks and a bright sector that sweeps round. */
function platter(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, spin: number, cracked: boolean) {
  k.ellipse(cx, cy + 3, rx, ry, ["i"]);
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      let a = Math.atan2(dy, dx) / (Math.PI * 2) - spin / 4;
      a -= Math.floor(a);
      let c = r > 0.94 ? "K" : "J";
      if (r < 0.94 && [0.38, 0.55, 0.72, 0.87].some((t) => Math.abs(r - t) < 0.022)) c = "I";
      if (r > 0.3 && r < 0.94 && a < 0.12) c = c === "I" ? "J" : "K";
      if (r > 0.3 && r < 0.94 && a >= 0.5 && a < 0.6) c = "I";
      k.px(x, y, c);
    }
  // spindle hub
  k.ellipse(cx, cy, 6, 2.5, ["i", "I"]);
  k.px(cx - 2, cy - 1, "K");
  if (cracked) k.stamp(["e.....", ".e....", ".ee...", "...e..", "...ee.", ".....e"], cx - 30, cy - 4);
}

/** The steel read/write head gripped in a tentacle tip, with its red LED. */
function head(k: PixelCanvas, tip: Pt) {
  k.stamp(["iiiiiii", "iIJJJKi", "iIIJJJi", "iiIIIii", "..iRi..", "...R..."], Math.round(tip[0]) - 3, Math.round(tip[1]) - 5);
}

/** The read/write arm: a tentacle from the body out over the platter, its tip gripping a steel head. */
function arm(k: PixelCanvas, root: Pt, cx: number, cy: number, rx: number, ry: number, seek: number) {
  const r = 0.4 + seek * 0.5;
  const tip: Pt = [cx - r * rx * 0.75, cy + r * ry * 0.65];
  tentacle(k, root, [root[0] - 4, root[1] + 14], [tip[0] + 4, tip[1] - 6], 5, 2.5, -1);
  head(k, tip);
}

function eyes(k: PixelCanvas, p: Pose, cx: number, ey: number) {
  for (const s of [-1, 1]) {
    const ex = cx + s * 9;
    k.ellipse(ex, ey, 7, 6, ["1", "2"]);
    if (p.hurt) {
      k.ellipse(ex, ey, 4, 3.5, ["t"]);
      k.stamp(["e...e", ".e.e.", "..e..", ".e.e.", "e...e"], Math.round(ex) - 2, ey - 2);
      continue;
    }
    if (p.blink) {
      // closed lids: a dark crease with lashes
      k.ellipse(ex, ey, 5.5, 5, ["2", "3"]);
      k.line(ex - 5, ey, ex + 5, ey, "e");
      k.px(ex - 4, ey + 1, "e");
      k.px(ex + 4, ey + 1, "e");
      continue;
    }
    k.ellipse(ex, ey, 5.5, 5, ["y", "Y"]);
    // a horizontal slit pupil, narrowed to a glare when it strikes
    k.rect(Math.round(ex) - 3, ey, 6, 1, "e");
    if (!p.glare) k.rect(Math.round(ex) - 2, ey - 1, 4, 3, "e");
    k.stamp(["tt", "t."], Math.round(ex) - 3, ey - 4);
    if (p.glare)
      // a heavy brow slammed down into a scowl
      for (let x = -6; x <= 6; x++) {
        const y = Math.round(ey - 4 + (x * s) / 3);
        k.px(ex + x, y, "1");
        k.px(ex + x, y - 1, "1");
        k.px(ex + x, y - 2, "2");
      }
  }
}

function sparks(k: PixelCanvas) {
  for (const [x, y] of [[12, 60], [82, 62], [26, 54], [70, 52]]) k.stamp([".Z.", "ZYZ", ".Z."], x, y);
}

function stars(k: PixelCanvas) {
  for (const [x, y] of [[8, 6], [84, 12], [72, 2]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const bx = p.bx ?? 0;
  const cx = 48 + bx;
  const sw = p.sway ?? 0;
  const rear = p.rear ?? 0;
  const up = Math.max(0, rear);
  const down = Math.max(0, -rear);
  // side tentacles curling up behind the platter (raised high for a slam)
  for (const s of [-1, 1]) {
    const tip: Pt = [cx + s * (40 - up * 4 + down * 4), 30 + by - up * 22 + down * 40 + sw * s];
    tentacle(k, [cx + s * 14, 60 + by], [cx + s * 34, 56 + by - up * 10], tip, 6.5, 2.5, s);
    if (!down) k.ellipse(tip[0] - s * 2, tip[1] + 2, 2.5, 2.5, HIDE); // curled tip
  }
  platter(k, 48 + bx * 0.5, 74, 42, 13, p.spin ?? 0, !!p.hurt);
  // mantle: a tall, lumpy head with fins and paler "sector" spots
  for (const s of [-1, 1]) {
    k.ellipse(cx + s * 19, 18 + by + sw * 0.5, 8, 5, HIDE);
    k.stamp(["3.3.3", ".3.3."], cx + s * 19 - 2, 17 + by);
  }
  k.ellipse(cx, 58 + by, 20, 10, HIDE);
  k.ellipse(cx, 34 + by, 22, 25, HIDE);
  for (const [x, y, r] of [[-10, 18, 3], [6, 12, 2.5], [12, 24, 2], [-4, 8, 2], [-14, 30, 2]] as const) k.ellipse(cx + x, by + y, r, r, ["3", "4"]);
  k.line(cx - 12, 44 + by, cx + 12, 44 + by, "2");
  eyes(k, p, cx, 46 + by);
  // a beak-like siphon under the eyes
  k.stamp([".1.", "121", ".1."], cx - 1, 53 + by);
  // front tentacles draped over the platter rim
  for (const s of [-1, 1]) {
    const tip: Pt = [cx + s * (22 + sw), 92 - up * 30 + down * 2];
    tentacle(k, [cx + s * 8, 62 + by], [cx + s * 26, 70 + by - up * 20], tip, 7, 2.5, -s);
  }
  if (!up) arm(k, [cx + 12, 62 + by], 48 + bx * 0.5, 74, 42, 13, p.seek ?? 0.5);
  if (p.sparks) sparks(k);
  if (p.hurt) stars(k);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the back of the mantle looms close, with tentacles spread over the platter beyond it. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const bx = p.bx ?? 0;
  const cx = 48 + bx;
  const sw = p.sway ?? 0;
  const rear = p.rear ?? 0;
  const up = Math.max(0, rear);
  const down = Math.max(0, -rear);
  platter(k, 48 + bx * 0.5, 56, 44, 14, p.spin ?? 0, !!p.hurt);
  // tentacles reaching out over the platter
  for (const s of [-1, 1]) {
    const tip: Pt = [cx + s * (42 - up * 8), 40 + by - up * 26 + down * 30 + sw * s];
    tentacle(k, [cx + s * 10, 62 + by], [cx + s * (34 + up * 8), 56 + by - up * 6], tip, 6.5, 2.5, s);
    if (!down) k.ellipse(tip[0] - s * 2, tip[1] + 2, 2.5, 2.5, HIDE);
    tentacle(k, [cx + s * 8, 72 + by], [cx + s * 28, 78 + by], [cx + s * (40 + sw), 90], 6.5, 2.5, -s);
  }
  if (!up) {
    // the read/write arm, far side of the platter
    const r = 0.4 + (p.seek ?? 0.5) * 0.5;
    const tip: Pt = [48 + bx * 0.5 + r * 44 * 0.7, 56 - r * 14 * 0.7];
    tentacle(k, [cx + 10, 58 + by], [cx + 18, 44 + by], tip, 4, 2, 1);
    head(k, tip);
  }
  // the mantle's back, big and close, with spots and a ridge
  for (const s of [-1, 1]) k.ellipse(cx + s * 20, 56 + by + sw * 0.5, 8, 5, HIDE);
  k.ellipse(cx, 76 + by, 23, 26, HIDE);
  for (const [x, y, r] of [[-9, 62, 3], [8, 66, 2.5], [-6, 76, 2], [12, 80, 2], [-13, 86, 2]] as const) k.ellipse(cx + x, by + y, r, r, ["3", "4"]);
  // the edges of the eyes peeking round the sides
  for (const s of [-1, 1]) k.ellipse(cx + s * 22, 68 + by, 2.5, 3.5, p.hurt ? ["1"] : ["y", "Y"]);
  if (p.sparks) sparks(k);
  if (p.hurt) stars(k);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Diskraken (${side})`,
    palette,
    // idle: the platter spins a quarter turn per frame while the head seeks outward on a SCAN sweep
    idle: [f({ spin: 0, seek: 0 }), f({ spin: 1, seek: 0.33, sway: 1, by: 1 }), f({ spin: 2, seek: 0.66, sway: 2, by: 1 }), f({ spin: 3, seek: 1, sway: 1, blink: true })],
    anims: {
      attack: [f({ spin: 0, rear: 0.5, by: -2, glare: true }), f({ spin: 1, rear: 1, by: -3, glare: true }), f({ spin: 2, rear: -1, by: 2, glare: true, sparks: true })],
      hurt: [f({ spin: 0, bx: -5, by: 2, hurt: true, sway: -2 }), f({ spin: 0, bx: -3, by: 1, hurt: true, sway: -1 })],
    },
    fps: { idle: 4, attack: 6, hurt: 6 },
  };
}

export const DISKRAKEN_ART: CreatureArt = { id: "diskraken", name: "Diskraken", boss: true, front: sheet("front"), back: sheet("back") };
