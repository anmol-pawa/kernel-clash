import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Heapotamus, boss of the Heap Harbor Gym (memory management): a huge blue
 * river-horse that carries the heap on its back, a stack of allocated
 * blocks in three colours with free gaps left between them (external
 * fragmentation). Its yawn swallows whole blocks; its tusks are page-aligned.
 * Original design, 96×96.
 */
const palette = {
  o: "#08142a", // outline
  1: "#173c78", // hide ramp (gym blue), dark → light
  2: "#2a62b8",
  3: "#4f93e8",
  4: "#a6d0ff",
  p: "#a85a7e", // muzzle / belly pink
  P: "#e8a2bf",
  y: "#a8701a", // allocated blocks: gold, green, steel
  Y: "#f2c040",
  Z: "#fff2a0",
  g: "#2a7a3a",
  G: "#5cc46a",
  i: "#2e3346",
  I: "#5c6681",
  J: "#99a3bd",
  m: "#1a0612", // mouth
  M: "#d8506e", // tongue
  t: "#fffaf0", // tusks / eye whites
  e: "#0c0c14", // pupils
  w: "#cfe8ff", // water drops
} as const;

const W = 96;
const HIDE = ["1", "2", "3", "4"];
const PINK = ["p", "P"];
const BLOCK: Record<string, [string, string, string]> = { y: ["y", "Y", "Z"], g: ["g", "G", "G"], i: ["i", "I", "J"] };

interface Pose {
  by?: number;
  bx?: number;
  /** jaw gape 0..1 */
  gape?: number;
  /** heap jiggle */
  jig?: number;
  blink?: boolean;
  hurt?: boolean;
  /** ear flick */
  ear?: number;
  drops?: boolean;
}

/** One allocated block: lit top-left edge, shadowed bottom-right. */
function block(k: PixelCanvas, x: number, y: number, w: number, h: number, kind: string) {
  const [d, m, l] = BLOCK[kind];
  k.rect(x, y, w, h, m);
  k.rect(x, y, w, 1, l);
  k.rect(x, y, 1, h, l);
  k.rect(x + w - 1, y + 1, 1, h - 1, d);
  k.rect(x + 1, y + h - 1, w - 1, 1, d);
}

/**
 * The heap: rows of blocks of uneven sizes with free gaps between them.
 * Widths per row, "." entries are free holes.
 */
const ROWS: [number, string][][] = [
  [[8, "g"], [5, "."], [10, "y"], [4, "."], [7, "i"]],
  [[12, "y"], [3, "."], [6, "i"], [9, "g"], [4, "."]],
  [[6, "i"], [10, "g"], [5, "."], [8, "y"], [5, "i"]],
];

function heap(k: PixelCanvas, cx: number, top: number, jig: number, knocked: boolean, mirror: boolean, sc = 1.4) {
  const rh = 7;
  // the steel tray the heap sits on
  const tw = Math.round(48 * sc);
  k.rect(Math.round(cx - tw / 2), top + rh * 3, tw, 3, "I");
  k.rect(Math.round(cx - tw / 2), top + rh * 3, tw, 1, "J");
  k.rect(Math.round(cx - tw / 2), top + rh * 3 + 2, tw, 1, "i");
  ROWS.forEach((row0, r) => {
    const row = row0.map(([w, kind]) => [Math.round(w * sc), kind] as [number, string]);
    const total = row.reduce((s, [w]) => s + w + 1, -1);
    let x = Math.round(cx - total / 2) + (r === 0 ? jig : r === 1 ? -jig : 0);
    const y = top + r * rh;
    const cells = mirror ? [...row].reverse() : row;
    cells.forEach(([w, kind], j) => {
      if (kind !== "." && !(knocked && r === 0 && j === 2)) block(k, x, y, w, rh, kind);
      else if (kind === ".") k.rect(x, y + rh - 1, w, 1, "i"); // the hole shows the hide below
      x += w + 1;
    });
  });
  if (knocked) {
    // the knocked-off block tumbling away
    k.stamp(["..yYZ", ".yYYY", "yYYYy", "YYYy.", "YYy.."], cx + 30, top - 8);
  }
}

function legs(k: PixelCanvas, by: number, bx: number) {
  for (const s of [-1, 1]) {
    const x = 48 + bx + s * 26;
    k.ellipse(x, 82 + by * 0.5, 9, 9, HIDE);
    k.rect(Math.round(x) - 8, 88, 17, 3, "2");
    for (const d of [-5, 0, 5]) k.stamp(["44", "PP"], Math.round(x) + d - 1, 89);
  }
}

function eyes(k: PixelCanvas, p: Pose, hx: number, hy: number) {
  for (const s of [-1, 1]) {
    const ex = hx + s * 11;
    const ey = hy - 9;
    // eye bump on the skull, ear behind it
    k.ellipse(ex + s * 7, ey - 6 - (p.ear ?? 0) * (s > 0 ? 1 : 0), 4, 5, HIDE);
    k.ellipse(ex + s * 7, ey - 5 - (p.ear ?? 0) * (s > 0 ? 1 : 0), 2, 3, PINK);
    k.ellipse(ex, ey, 6.5, 6, HIDE);
    if (p.hurt) {
      k.ellipse(ex, ey, 3.5, 3.5, ["t"]);
      k.stamp(["e...e", ".e.e.", "..e..", ".e.e.", "e...e"], Math.round(ex) - 2, Math.round(ey) - 2);
    } else if (p.blink) k.rect(Math.round(ex) - 3, Math.round(ey), 7, 1, "e");
    else {
      k.ellipse(ex, ey + 0.5, 3.5, 3.5, ["t"]);
      k.rect(Math.round(ex) - (s < 0 ? 0 : 1), Math.round(ey) - 1, 2, 3, "e");
      k.px(Math.round(ex) - (s < 0 ? 0 : 1), Math.round(ey) - 1, "t");
      // heavy lid
      k.line(ex - 4, ey - 3, ex + 4, ey - 3, "1");
    }
  }
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const bx = p.bx ?? 0;
  const gape = p.gape ?? 0;
  
  // body, its hump rising behind the head to carry the heap
  k.ellipse(48 + bx, 62 + by, 38, 24, HIDE);
  k.ellipse(48 + bx, 40 + by, 34, 16, HIDE);
  heap(k, 48 + bx, 4 + Math.max(by, -1), p.jig ?? 0, !!p.hurt, false, 1.25);
  legs(k, by, bx);
  // head
  const hx = 48 + bx;
  const hy = 46 + by - gape * 6;
  k.ellipse(hx, hy, 22, 15, HIDE);
  eyes(k, p, hx, hy);
  // muzzle: upper jaw lifts, lower jaw drops when it yawns
  const my = 62 + by;
  if (gape > 0) {
    const open = Math.round(gape * 16);
    k.ellipse(hx, my + open * 0.5, 22, 8 + open * 0.6, ["m"]);
    k.ellipse(hx, my + open * 0.9 + 2, 13, 4 + open * 0.2, ["M", "P"]);
    // lower jaw
    k.ellipse(hx, my + open + 6, 24, 7, HIDE);
    k.ellipse(hx, my + open + 8, 18, 4, PINK);
    // tusks up from the lower jaw, pegs down from the upper
    for (const s of [-1, 1]) {
      k.stamp(["t.", "tt", "tt", "tt", "tt"], hx + s * 14 - 1, my + open - 2);
      k.stamp(["tt", "tt", ".t"], hx + s * 8 - 1, my - 4 - gape * 2);
    }
    // the upper lip and nostrils
    k.ellipse(hx, my - 6 - gape * 3, 25, 7, HIDE);
    k.ellipse(hx, my - 3 - gape * 3, 20, 3, PINK);
    for (const s of [-1, 1]) k.stamp(["mm", "m."], hx + s * 8 - 1, Math.round(my - 9 - gape * 3));
  } else {
    k.ellipse(hx, my, 26, 13, HIDE);
    k.ellipse(hx, my + 9, 15, 3.5, PINK);
    // a long, smug mouth line that curls up at the corners
    for (let x = -20; x <= 20; x++) k.px(hx + x, my + 4 - Math.round((x / 20) ** 4 * 4), "m");
    for (const s of [-1, 1]) {
      // tusk tips peeking over the lip
      k.stamp(["t", "t"], hx + s * 13, my + 2);
      // nostrils and whisker dots
      k.stamp([".mm", "mm.", "m.."], hx + s * 9 - 1, my - 7);
      for (const d of [0, 3]) k.px(hx + s * (15 + d), my - 2 + d, "1");
    }
  }
  if (p.drops) for (const [x, y] of [[20, 40], [76, 44], [14, 52]]) k.stamp([".w.", "www", ".w."], x + bx, y + by);
  if (p.hurt) for (const [x, y] of [[6, 14], [86, 30], [70, 6]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the broad back carries the whole heap; ears and eye bumps peek over the far end. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const by = p.by ?? 0;
  const bx = p.bx ?? 0;
  const gape = p.gape ?? 0;
  // head on the far side, rearing up when it yawns
  const hy = 26 + by - gape * 6;
  for (const s of [-1, 1]) {
    k.ellipse(48 + bx + s * 18, hy - 6 - (p.ear ?? 0) * (s < 0 ? 1 : 0), 4, 5, HIDE);
    k.ellipse(48 + bx + s * 11, hy - 1, 6, 5, HIDE);
  }
  k.ellipse(48 + bx, hy + 6, 22, 10, HIDE);
  if (gape > 0.5) for (const s of [-1, 1]) k.stamp(["mt", "mt", "m."], 48 + bx + s * 23 - (s < 0 ? 1 : 0), hy + 8);
  legs(k, by, bx);
  k.ellipse(48 + bx, 62 + by, 40, 27, HIDE);
  // spine ridge highlight and a stubby tail
  k.line(48 + bx - 22, 50 + by, 48 + bx + 22, 50 + by, "4");
  k.ellipse(48 + bx, 86 + by, 4, 3, HIDE);
  k.stamp(["1.1", ".1."], 48 + bx - 1, 88 + by);
  heap(k, 48 + bx, 38 + by, p.jig ?? 0, !!p.hurt, true, 1.45);
  if (p.drops) for (const [x, y] of [[14, 40], [80, 46]]) k.stamp([".w.", "www", ".w."], x + bx, y + by);
  if (p.hurt) for (const [x, y] of [[6, 14], [86, 30], [70, 6]]) k.stamp(["Y.Y", ".Z.", "Y.Y"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Heapotamus (${side})`,
    palette,
    idle: [f({}), f({ by: 1, jig: 1, ear: 1 }), f({ by: 1, jig: 0, ear: 2, drops: true }), f({ blink: true, jig: -1 })],
    anims: {
      attack: [f({ by: -2, gape: 0.5, jig: 1 }), f({ by: -3, gape: 1, jig: 2 }), f({ by: 2, jig: -1 })],
      hurt: [f({ bx: -5, by: 2, hurt: true, jig: 2 }), f({ bx: -3, by: 1, hurt: true, jig: -1 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const HEAPOTAMUS_ART: CreatureArt = { id: "heapotamus", name: "Heapotamus", boss: true, front: sheet("front"), back: sheet("back") };
