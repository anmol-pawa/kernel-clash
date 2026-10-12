import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Deadlocrab, boss of the Gridlock Gym (deadlocks): a red armoured crab whose
 * two great claws each clamp a resource, a steel drive in one and a gold
 * token in the other, while its eyestalks stare at the one it doesn't hold.
 * Its shell is marked with a two-arrow wait-for cycle, and a chain loops
 * between the claws: hold and wait, no preemption, circular wait.
 * Original design, 96×96.
 */
const palette = {
  o: "#1f0606", // outline
  1: "#6e1414", // shell ramp (gym red), dark → light
  2: "#a82a20",
  3: "#e0533a",
  4: "#ff9c7a",
  b: "#a8875a", // belly plates
  B: "#e6cf9a",
  i: "#2e3346", // steel drive + chain
  I: "#5c6681",
  J: "#99a3bd",
  q: "#e0e6f2",
  y: "#a8701a", // gold token + cycle arrows
  Y: "#f2c040",
  Z: "#fff2a0",
  e: "#101018", // eye pupils
  E: "#fffaf0", // eye whites / glints
  m: "#2a0808", // mouth, claw gap
  M: "#ff6a8a", // mouth inside
  w: "#cfe8ff", // bubbles
} as const;

const W = 96;
const SHELL = ["1", "2", "3", "4"];
const BELLY = ["b", "B"];
const GOLD = ["y", "Y", "Z"];

interface Pose {
  /** body bob */
  by?: number;
  /** body sideways shift */
  bx?: number;
  /** claw lift (positive = higher) */
  lift?: number;
  /** claws pulled toward the middle */
  pinch?: number;
  /** claw opening 0..1 */
  open?: number;
  /** claw size bonus (striking toward the viewer) */
  grow?: number;
  /** eyestalk lean */
  lean?: number;
  blink?: boolean;
  hurt?: boolean;
  mouth?: boolean;
  bubbles?: number;
}

/** A segmented walking leg: thigh up and out, then a pointed shin down to the ground. */
function leg(k: PixelCanvas, s: number, i: number, by: number, bx: number) {
  const x0 = 48 + bx + s * (16 + i * 3);
  const y0 = 66 + by + i * 2;
  const kx = 48 + bx + s * (29 + i * 5);
  const ky = 58 + by + i * 4;
  const fx = 48 + s * (30 + i * 7);
  const fy = 90 - i;
  k.tube([x0, y0], [kx - s * 3, ky - 4], [kx, ky], 4.4, 3.6, SHELL);
  k.tube([kx, ky], [kx + s * 3, ky + 10], [fx, fy], 3.4, 1.4, SHELL);
  k.px(kx, ky - 2, "4");
}

/** The resource a claw clamps: a steel drive (left) or a gold token (right). */
function resource(k: PixelCanvas, x: number, y: number, which: "steel" | "gold", g: number) {
  if (which === "steel") {
    const h = 6 + g;
    k.rect(x - h, y - h, h * 2, h * 2, "I");
    k.rect(x - h, y - h, h * 2, 2, "q");
    k.rect(x - h, y - h, 2, h * 2, "J");
    k.rect(x + h - 2, y - h + 2, 2, h * 2 - 2, "i");
    k.rect(x - h + 2, y + h - 2, h * 2 - 2, 2, "i");
    // a little disk platter on the face
    k.ellipse(x + 0.5, y + 0.5, 3.2 + g * 0.4, 3.2 + g * 0.4, ["I", "J", "q"]);
    k.px(x, y, "i");
  } else {
    k.ellipse(x, y, 6.5 + g, 6.5 + g, GOLD);
    k.ellipse(x, y, 3.5 + g * 0.5, 3.5 + g * 0.5, ["y", "Y"]);
    k.rect(x - 1, y - 3, 2, 6, "Z");
  }
}

/**
 * A big pincer claw, raised at the side. The palm sits low and two fingers
 * curve up round the resource; `open` swings them apart.
 */
function claw(k: PixelCanvas, s: number, cx: number, cy: number, open: number, g: number, holds: "steel" | "gold" | null) {
  const r = 1 + g / 10;
  // fingers first so the palm overlaps their roots
  const spread = 7 + open * 8;
  // outer (fixed) finger
  k.tube([cx + s * 6 * r, cy - 2], [cx + s * (11 + spread) * r, cy - 14 * r], [cx + s * (2 + open * 4), cy - 25 * r - open * 2], 4.2 * r, 1.8, SHELL);
  // inner (moving) finger
  k.tube([cx - s * 6 * r, cy - 2], [cx - s * (10 + spread) * r, cy - 13 * r], [cx - s * (1 + open * 6), cy - 23 * r - open * 3], 3.8 * r, 1.6, SHELL);
  // serrated inner edges
  for (let t = 0; t < 3; t++) {
    k.px(cx + s * (5 + spread * 0.6) * r - s * t, cy - 9 - t * 4, "B");
    k.px(cx - s * (5 + spread * 0.5) * r + s * t, cy - 8 - t * 4, "B");
  }
  if (holds) resource(k, cx, cy - 13 * r, holds, Math.round(g / 2));
  else if (open > 0.3) k.ellipse(cx, cy - 13 * r, 4 + open * 2, 6, ["m"]);
  // palm
  k.ellipse(cx, cy + 3, 11 * r, 9 * r, SHELL);
  k.ellipse(cx - s * 3, cy + 6, 5 * r, 3 * r, ["2", "3"]);
  // knuckle spikes
  for (const dx of [-5, 0, 5]) k.px(cx + dx, cy - 5 * r, "4");
}

function arms(k: PixelCanvas, p: Pose, by: number, bx: number, back: boolean) {
  const lift = p.lift ?? 0;
  const pinch = p.pinch ?? 0;
  const g = p.grow ?? 0;
  for (const s of [-1, 1]) {
    const cx = 48 + bx + s * (32 - pinch);
    const cy = 40 + by - lift;
    // elbow arm from the body side up to the palm
    k.tube([48 + bx + s * 20, 58 + by], [48 + bx + s * 38, 60 + by - lift * 0.3], [cx, cy + 6], 5, 5.5, SHELL);
    const holds = back ? (s < 0 ? "gold" : "steel") : s < 0 ? "steel" : "gold";
    claw(k, s, cx, cy, p.open ?? 0, g, (p.open ?? 0) > 0.6 ? null : holds);
  }
}

/** The chain looped between the two claws: each is bound to the other. */
function chain(k: PixelCanvas, p: Pose, by: number, bx: number) {
  if ((p.open ?? 0) > 0.6) return;
  const lift = p.lift ?? 0;
  const pinch = p.pinch ?? 0;
  const xl = 48 + bx - (32 - pinch) + 6;
  const xr = 48 + bx + (32 - pinch) - 6;
  const y = 46 + by - lift;
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = xl + (xr - xl) * t;
    const yy = y + Math.sin(t * Math.PI) * 9;
    if (i % 2) k.stamp([".iii.", "iq.Ji", "iJ.Ii", ".iii."], Math.round(x) - 2, Math.round(yy) - 2);
    else k.stamp(["iJJi", "iIIi"], Math.round(x) - 2, Math.round(yy) - 1);
  }
}

/** Two gold arrows chasing each other round a ring: a wait-for cycle. */
function cycleMark(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number) {
  for (let a = 0; a < 360; a += 4) {
    const half = a % 180;
    if (half > 150) continue; // gaps before each arrowhead
    const t = (a * Math.PI) / 180;
    k.px(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, half < 20 ? "y" : "Y");
    k.px(cx + Math.cos(t) * (rx - 1), cy + Math.sin(t) * (ry - 1), half < 20 ? "y" : "Z");
  }
  // arrowheads at 150° and 330°, pointing clockwise
  for (const a of [150, 330]) {
    const t = (a * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(t) * rx);
    const y = Math.round(cy + Math.sin(t) * ry);
    const d = a === 150 ? -1 : 1;
    k.stamp(d < 0 ? ["y...", "YY..", "YZY.", "YZZY", "YZY.", "YY..", "y..."] : ["...y", "..YY", ".YZY", "YZZY", ".YZY", "..YY", "...y"], x - (d < 0 ? 1 : 2), y - 3);
  }
}

function body(k: PixelCanvas, by: number, bx: number, front: boolean) {
  k.ellipse(48 + bx, 62 + by, 27, 17, SHELL);
  // shell rim ridge and spikes along the top edge
  for (let x = -22; x <= 22; x += 6) {
    const y = 62 + by - Math.round(17 * Math.sqrt(1 - (x / 27) ** 2));
    k.stamp([".4.", "434"], 48 + bx + x - 1, y - 1);
  }
  if (front) {
    // belly plates under the face
    k.ellipse(48 + bx, 70 + by, 17, 7, BELLY);
    for (const x of [-15, 15]) k.line(48 + bx + x, 67 + by, 48 + bx + x, 74 + by, "b");
    cycleMark(k, 48 + bx, 71 + by, 10, 4);
  } else {
    cycleMark(k, 48 + bx, 60 + by, 14, 8);
    k.line(48 + bx - 20, 70 + by, 48 + bx + 20, 70 + by, "1");
  }
}

function face(k: PixelCanvas, p: Pose, by: number, bx: number) {
  const lean = p.lean ?? 0;
  for (const s of [-1, 1]) {
    const ex = 48 + bx + s * 8 + lean;
    const ey = 36 + by;
    k.tube([48 + bx + s * 6, 52 + by], [48 + bx + s * 7, 44 + by], [ex, ey + 4], 2.6, 2.2, SHELL);
    k.ellipse(ex, ey, 5, 5, ["E"]);
    k.ellipse(ex - 1, ey - 1, 3.5, 3.5, ["E"]);
    if (p.hurt) k.stamp(["e...e", ".e.e.", "..e..", ".e.e.", "e...e"], Math.round(ex) - 2, Math.round(ey) - 2);
    else if (p.blink) k.rect(Math.round(ex) - 3, Math.round(ey), 6, 1, "e");
    else {
      // pupils glance at the other claw's resource
      const px = Math.round(ex) - s - 1 + Math.sign(lean);
      k.rect(px, Math.round(ey) - 1, 3, 3, "e");
      k.px(px, Math.round(ey) - 1, "E");
      // angry brow
      k.line(ex - 4, ey - 6 + (s < 0 ? 0 : 2), ex + 4, ey - 6 + (s < 0 ? 2 : 0), "1");
    }
  }
  const my = 61 + by;
  if (p.mouth || p.hurt) {
    k.ellipse(48 + bx, my, 5, 3, ["m"]);
    k.ellipse(48 + bx, my + 1, 3, 1.5, ["M"]);
  } else k.line(48 + bx - 4, my, 48 + bx + 4, my, "m");
  // mandibles
  for (const s of [-1, 1]) k.stamp(s < 0 ? ["22", ".1"] : ["22", "1."], 48 + bx + s * 6 - (s < 0 ? 1 : 0), my - 1);
  const b = p.bubbles ?? 0;
  if (b) for (const [dx, dy, r] of [[-8, -4, 1.5], [-12, -9, 2], [-9, -15, 1.2]].slice(0, b)) k.ellipse(48 + bx + dx, my + dy, r, r, ["w"]);
}

function stars(k: PixelCanvas) {
  for (const [x, y] of [[8, 10], [84, 14], [44, 4]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const bx = p.bx ?? 0;
  for (const s of [-1, 1]) for (let i = 2; i >= 0; i--) leg(k, s, i, by, bx);
  body(k, by, bx, true);
  chain(k, p, by, bx);
  face(k, p, by, bx);
  arms(k, p, by, bx, false);
  if (p.hurt) stars(k);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the broad shell with the big cycle mark, claws raised either side. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const bx = p.bx ?? 0;
  arms(k, p, by, bx, true);
  chain(k, p, by, bx);
  // eyestalk tips peek over the shell
  for (const s of [-1, 1]) {
    const ex = 48 + bx + s * 8 + (p.lean ?? 0);
    k.tube([48 + bx + s * 6, 52 + by], [48 + bx + s * 7, 44 + by], [ex, 38 + by], 2.6, 2.2, SHELL);
    k.ellipse(ex, 36 + by, 4.5, 4.5, SHELL);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) leg(k, s, i, by, bx);
  body(k, by + 2, bx, false);
  if (p.hurt) stars(k);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Deadlocrab (${side})`,
    palette,
    idle: [f({}), f({ by: 1, lift: -1, lean: 1, bubbles: 1 }), f({ by: 1, lift: 1, lean: 1, bubbles: 2 }), f({ blink: true, lean: -1, bubbles: 3 })],
    anims: {
      attack: [f({ by: -2, lift: 8, open: 1, mouth: true }), f({ by: 2, lift: -4, pinch: 12, open: 0.2, grow: 4, mouth: true }), f({ by: 1, lift: 0, pinch: 4, grow: 1 })],
      hurt: [f({ bx: -5, by: 3, lift: -6, open: 0.4, hurt: true }), f({ bx: -3, by: 2, lift: -4, open: 0.2, hurt: true })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const DEADLOCRAB_ART: CreatureArt = { id: "deadlocrab", name: "Deadlocrab", boss: true, front: sheet("front"), back: sheet("back") };
