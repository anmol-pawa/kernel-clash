import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Kernelord, final boss of the Kernel Summit (the interview gauntlet): a
 * towering indigo owl-king, the interviewer who has heard every answer. It
 * wears a crown of concentric privilege rings with a ring-0 jewel at the
 * centre, a gold monocle on a chain, and grips a clipboard of checkboxes in
 * one wing. When it strikes, it spreads its wings and throws question marks.
 * Original design, 96×96.
 */
const palette = {
  o: "#120c1e", // outline
  1: "#5a4410", // gold ramp (gym gold), dark → light
  2: "#9a7418",
  3: "#d8a828",
  4: "#fff0a0",
  n: "#1e1c40", // plumage ramp, dark → light
  N: "#34306a",
  m: "#5650a0",
  M: "#8a86d0",
  w: "#c8bca0", // facial disk / bib
  W: "#f4ecd8",
  a: "#e07018", // eyes
  A: "#ffd060",
  e: "#0a0810",
  t: "#ffffff",
  i: "#4a4a5a", // beak and talons
  I: "#9a9aae",
  u: "#7a4a20", // clipboard
  j: "#40e0ff", // ring-0 jewel
  R: "#d83030", // red ink
} as const;

const W = 96;
const PLUME = ["n", "N", "m", "M"];
const IVORY = ["w", "W"];

interface Pose {
  by?: number;
  bx?: number;
  /** head tilt, px */
  tilt?: number;
  /** wing spread 0 (folded) … 1 (fully spread) */
  spread?: number;
  blink?: boolean;
  hurt?: boolean;
  glow?: boolean;
  /** question marks thrown */
  quiz?: boolean;
  /** jewel sparkle */
  sparkle?: boolean;
  /** clipboard tap */
  tap?: number;
}

/** A wing: a long shaded oval with rows of scalloped feather edges. */
function wing(k: PixelCanvas, cx: number, cy: number, rx: number, ry: number, s: number) {
  k.ellipse(cx, cy, rx, ry, PLUME);
  for (let r = 0; r < 4; r++) {
    const y = cy - ry * 0.4 + r * ry * 0.35;
    for (let x = -rx + 3 + (r % 2) * 2; x <= rx - 3; x += 5) {
      const xx = cx + x;
      const dy = (xx - cx) / rx;
      if (dy * dy + ((y - cy) / ry) ** 2 > 0.75) continue;
      k.stamp(["n...n", "Mn.nM", ".MMM."], Math.round(xx) - 2, Math.round(y));
    }
  }
  // long flight feathers at the wing tip
  for (let f = 0; f < 3; f++) k.line(cx + s * (rx * 0.3 + f * 2), cy + ry * 0.6, cx + s * (rx * 0.5 + f * 3), cy + ry + 3, "n");
}

/** A wing raised and spread: a broad arm sweeping up and out, with fanned flight feathers. */
function spreadWing(k: PixelCanvas, cx: number, cy: number, sp: number, s: number) {
  const tip: [number, number] = [cx + s * (30 + sp * 12), cy - 26 - sp * 14];
  for (let f = 0; f < 5; f++) {
    const fx = cx + s * (22 + f * 5 + sp * 6);
    k.tube([fx, cy - 18 - sp * 10 + f * 2], [fx + s * 3, cy - 2 + f * 3], [fx + s * (6 + f), cy + 10 + f * 2], 3.5, 2, ["n", "N", "m"]);
  }
  k.tube([cx + s * 16, cy - 2], [cx + s * 24, cy - 20], tip, 9, 5, PLUME);
  for (let t = 0.25; t < 0.9; t += 0.2) {
    const x = cx + s * 16 + (tip[0] - cx - s * 16) * t;
    const y = cy - 2 + (tip[1] - cy + 2) * t;
    k.stamp(["n...n", "Mn.nM", ".MMM."], Math.round(x) - 2, Math.round(y));
  }
}

function crown(k: PixelCanvas, cx: number, top: number, sparkle: boolean) {
  k.stamp(
    [
      "4........4........4",
      "34......343......34",
      "343....33433....343",
      "3433..3344433..3343",
      "3443333444443333443",
      "3333333333333333333",
      "2424242424242424242",
      "2222222222222222222",
      "1111111111111111111",
    ],
    cx - 9,
    top,
  );
  // the ring-0 jewel, set in two concentric privilege rings
  k.stamp(["..222..", ".2444 2", "24.j.42", "24jjj42", "24.j.42", ".24442.", "..222.."].map((r) => r.replace(" ", ".")), cx - 3, top + 1);
  if (sparkle) k.stamp(["..t..", "..t..", "tt.tt", "..t..", "..t.."], cx + 5, top - 5);
}

function eyes(k: PixelCanvas, p: Pose, cx: number, ey: number) {
  for (const s of [-1, 1]) {
    const ex = cx + s * 9;
    k.ellipse(ex, ey, 10, 10, IVORY);
    // feathered rim of the facial disk
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      k.px(ex + Math.cos(ang) * 9.5, ey + Math.sin(ang) * 9.5, "w");
    }
    if (p.hurt) {
      k.stamp(["e...e", ".e.e.", "..e..", ".e.e.", "e...e"], Math.round(ex) - 2, ey - 2);
      continue;
    }
    if (p.blink) {
      k.line(ex - 5, ey, ex + 5, ey, "e");
      k.line(ex - 4, ey - 1, ex + 4, ey - 1, "N");
      continue;
    }
    k.ellipse(ex, ey, 5.5, 5.5, ["a", "A"]);
    if (p.glow) k.ellipse(ex, ey, 2, 2, ["t"]);
    else {
      k.ellipse(ex, ey + 0.5, 2.5, 2.5, ["e"]);
      k.px(ex - 2, ey - 2, "t");
    }
    // a stern brow
    k.line(ex - 6 * s, ey - 9, ex + 5 * s, ey - 6, "n");
  }
  // the monocle over the right eye, on a gold chain
  if (!p.hurt) {
    const mx = cx + 9;
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      k.px(mx + Math.cos(ang) * 7, ey + Math.sin(ang) * 7, a < 20 ? "2" : "3");
    }
    k.px(mx - 3, ey - 4, "t");
    k.line(mx + 6, ey + 4, mx + 10, ey + 18, "3");
  }
}

/** The gold chain of office: beads round the neck and a medallion stamped with the privilege rings. */
function chain(k: PixelCanvas, cx: number, y: number, medal: boolean) {
  for (let a = 0; a <= 14; a++) {
    const t = a / 14;
    const x = cx - 17 + t * 34;
    const yy = y + Math.sin(t * Math.PI) * 8;
    k.stamp(a % 2 ? ["3"] : ["43", "32"], x, yy);
  }
  if (medal) k.stamp([".222.", "23332", "23j32", "23332", ".222."], cx - 2, y + 8);
}

function clipboard(k: PixelCanvas, x: number, y: number) {
  k.rect(x, y, 15, 19, "u");
  k.rect(x + 2, y + 2, 11, 16, "W");
  k.stamp(["13331", ".111."], x + 5, y - 1);
  for (let r = 0; r < 4; r++) {
    const ly = y + 5 + r * 3;
    k.rect(x + 3, ly, 2, 2, "i");
    k.line(x + 6, ly + 1, x + 11, ly + 1, "I");
    if (r < 3) k.stamp([".R", "R."], x + 3, ly - 1);
  }
}

function quiz(k: PixelCanvas) {
  const Q = [".333.", "3...3", "...3.", "..3..", "..3..", ".....", "..3.."];
  for (const [x, y] of [[4, 8], [84, 14], [10, 46], [80, 52], [70, 2]]) k.stamp(Q, x, y);
}

function feathers(k: PixelCanvas) {
  for (const [x, y] of [[6, 10], [86, 22], [12, 70], [82, 64]]) k.stamp(["..M", ".mM", "mm.", "N.."], x, y);
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const cx = 48 + (p.bx ?? 0);
  const sp = p.spread ?? 0;
  // wings: folded at the sides, or raised and spread like a cloak
  for (const s of [-1, 1]) {
    if (sp > 0) spreadWing(k, cx, 56 + by, sp, s);
    else wing(k, cx + s * 24, 62 + by, 12, 26, s);
  }
  // body and bib with chevron marks
  k.ellipse(cx, 64 + by, 26, 28, PLUME);
  k.ellipse(cx, 66 + by, 15, 20, IVORY);
  for (let r = 0; r < 5; r++) for (let c = -2; c <= 2; c++) if (Math.abs(c) + r < 6) k.stamp(["N.N", ".N."], cx + c * 5 - 1, 54 + by + r * 6 + Math.abs(c));
  chain(k, cx, 44 + by, true);
  // talons
  for (const s of [-1, 1]) k.stamp(["i.i.i", "I.I.I", "I.I.I"], cx + s * 8 - 2, 91);
  // head with ear tufts and crown
  const hx = cx + (p.tilt ?? 0);
  const hy = 30 + by;
  for (const s of [-1, 1]) k.tube([hx + s * 12, hy - 8], [hx + s * 18, hy - 16], [hx + s * 22, hy - 24], 4, 1.5, PLUME);
  k.ellipse(hx, hy, 23, 18, PLUME);
  eyes(k, p, hx, hy + 1);
  // hooked beak
  k.stamp(["iIIi", "iIIi", ".ii.", ".i.."], hx - 2, hy + 8);
  crown(k, hx, hy - 25, !!p.sparkle);
  // the clipboard, gripped in the left wing (out of the way when the wings spread)
  if (sp < 0.5) clipboard(k, cx - 34, 58 + by + (p.tap ?? 0));
  if (p.hurt) {
    // the monocle pops off and spins away
    k.stamp([".333.", "3...3", "3.t.3", "3...3", ".333."], cx + 34, 14);
    feathers(k);
  }
  if (p.quiz) quiz(k);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the tufted head and the back of the crown, a cape-like back with gold privilege rings. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const cx = 48 + (p.bx ?? 0);
  const sp = p.spread ?? 0;
  for (const s of [-1, 1]) {
    if (sp > 0) spreadWing(k, cx, 58 + by, sp, s);
    else wing(k, cx + s * 25, 64 + by, 13, 27, s);
  }
  // tail feathers
  for (let f = -2; f <= 2; f++) k.tube([cx + f * 3, 82 + by], [cx + f * 4, 88], [cx + f * 5, 94], 3, 2, PLUME);
  k.ellipse(cx, 64 + by, 27, 28, PLUME);
  // the privilege rings, embroidered in gold down the back
  for (const [r, c] of [[16, "2"], [11, "3"], [6, "3"]] as const)
    for (let a = 0; a < 80; a++) {
      const ang = (a / 80) * Math.PI * 2;
      k.px(cx + Math.cos(ang) * r, 66 + by + Math.sin(ang) * r * 0.9, c);
    }
  k.ellipse(cx, 66 + by, 2.5, 2.5, ["j", "t"]);
  // broad shoulders hunched up round the neck
  k.ellipse(cx, 46 + by, 26, 11, PLUME);
  // head from behind: tufts, a dark nape and the crown's back
  const hx = cx + (p.tilt ?? 0);
  const hy = 30 + by;
  for (const s of [-1, 1]) k.tube([hx + s * 12, hy - 8], [hx + s * 18, hy - 16], [hx + s * 22, hy - 24], 4, 1.5, PLUME);
  k.ellipse(hx, hy + 2, 22, 17, PLUME);
  for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) k.stamp(["n...n", "Mn.nM", ".MMM."], hx + c * 7 - 2 + (r % 2) * 3, hy + 4 + r * 4);
  chain(k, cx, hy + 14, false);
  k.stamp(
    ["4........4........4", "34......343......34", "343....33433....343", "3433..3343433..3343", "3333333333333333333", "2424242424242424242", "2222222222222222222", "1111111111111111111"],
    hx - 9,
    hy - 24,
  );
  // the clipboard's edge at its side
  if (sp < 0.5) {
    k.rect(cx + 32, 60 + by + (p.tap ?? 0), 4, 18, "u");
    k.rect(cx + 32, 60 + by + (p.tap ?? 0), 1, 18, "W");
  }
  if (p.hurt) feathers(k);
  if (p.quiz) quiz(k);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Kernelord (${side})`,
    palette,
    idle: [f({}), f({ by: 1, tilt: 1, tap: 1 }), f({ by: 1, tilt: 1, sparkle: true }), f({ blink: true, tap: 1 })],
    anims: {
      attack: [f({ by: -1, spread: 0.6, glow: true }), f({ by: -2, spread: 1, glow: true, sparkle: true }), f({ by: 1, spread: 0.8, glow: true, quiz: true })],
      hurt: [f({ bx: -5, by: 2, tilt: -2, hurt: true }), f({ bx: -3, by: 1, tilt: -1, hurt: true })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const KERNELORD_ART: CreatureArt = { id: "kernelord", name: "Kernelord", boss: true, front: sheet("front"), back: sheet("back") };
