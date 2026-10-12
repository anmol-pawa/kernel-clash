import { GYMS, type Gym } from "@/content/gyms";
import { PixelCanvas, type Grid, type Palette, type SpriteSheet } from "@/lib/pixel";

/**
 * The region overworld: a pixel map drawn by code (seeded, so it is the same on
 * every load). Mountains up north hold the Kernel Summit, a river splits the
 * lowlands from the highlands, and a dirt road winds past all nine gyms.
 * Everything is original.
 */
export const MAP_W = 128;
export const MAP_H = 216;

/** Door position (bottom centre of the building) for each gym, in map order. */
export const GYM_SPOTS: [number, number][] = [
  [30, 206],
  [98, 188],
  [30, 168],
  [98, 148],
  [30, 132],
  [98, 86],
  [30, 70],
  [98, 52],
  [64, 24],
];
export const GYM_W = 22;
export const GYM_H = 20;

/** Allocates one palette character per distinct hex colour, so drawing code can use colours directly. */
class Pal {
  readonly palette: Palette = {};
  private byHex = new Map<string, string>();
  private pool = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+-/:;<=>?@^_~|"];
  c(hex: string): string {
    let ch = this.byHex.get(hex);
    if (!ch) {
      ch = this.pool.shift();
      if (!ch) throw new Error("palette pool exhausted");
      this.byHex.set(hex, ch);
      this.palette[ch] = hex;
    }
    return ch;
  }
}

const OUTLINE = "#1a1430";
const GRASS = ["#2f6b2a", "#3f8a34", "#58a843", "#7cc85a"];
const CANOPY = ["#163d22", "#245e2e", "#3a843a", "#64b052"];
const PINE = ["#0f3326", "#1a5038", "#2c7048", "#4e9a5c"];
const PATH = ["#7a5a32", "#b08850", "#d4b07a", "#ead2a0"];
const WATER = ["#1c3a80", "#2a5cb8", "#4a8ae0", "#a6d8ff"];
const ROCK = ["#2e2a46", "#4e4a6e", "#7a7898", "#b4b2cc"];
const SNOW = "#f2f4ff";
const WOOD = ["#4a2e1a", "#7a5030", "#a8783e"];
const WALL = ["#6e6a8e", "#a8a6c4", "#d8d6ea", "#f6f4ff"];

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** Smooth value noise in 0..1. */
function noise(x: number, y: number, cell: number, s: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const a = hash(gx, gy, s);
  const b = hash(gx + 1, gy, s);
  const c = hash(gx, gy + 1, s);
  const d = hash(gx + 1, gy + 1, s);
  const u = sm(fx);
  const v = sm(fy);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const dither = (x: number, y: number) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

/** Gym building: shaded roof in the gym's colours with an emblem, cream walls, door and windows. */
export function drawGym(k: PixelCanvas, pal: Pal, gym: Gym, ox: number, oy: number) {
  const C = (h: string) => pal.c(h);
  const [r0, r1, r2, r3] = gym.ramp.map(C);
  const w = WALL.map(C);
  // walls
  for (let y = 9; y < GYM_H; y++)
    for (let x = 2; x < GYM_W - 2; x++) {
      const shade = x < 4 ? w[3] : x > GYM_W - 5 ? w[0] : y > GYM_H - 3 ? w[0] : (y & 1) && hash(x, y, 9) < 0.15 ? w[1] : w[2];
      k.px(ox + x, oy + y, shade);
    }
  // brick courses
  for (let y = 11; y < GYM_H - 2; y += 3) for (let x = 4; x < GYM_W - 4; x++) if ((x + y) % 5 === 0) k.px(ox + x, oy + y, w[1]);
  // roof: a wide trapezoid, light top-left to dark bottom-right, eaves overhanging
  for (let y = 0; y < 10; y++) {
    const inset = Math.max(0, 4 - y);
    for (let x = inset; x < GYM_W - inset; x++) {
      const t = 1 - (x / GYM_W) * 0.6 - (y / 10) * 0.6 + (dither(ox + x, oy + y) - 0.5) * 0.25;
      k.px(ox + x, oy + y, y === 9 ? r0 : t > 0.75 ? r3 : t > 0.45 ? r2 : t > 0.2 ? r1 : r0);
    }
  }
  // ridge highlight and eave shadow line
  for (let x = 5; x < GYM_W - 5; x++) k.px(ox + x, oy + 1, r3);
  for (let x = 1; x < GYM_W - 1; x++) k.px(ox + x, oy + 10, w[0]);
  // emblem: a ring badge on the roof face in white with a gym-colour core
  k.ellipse(ox + GYM_W / 2, oy + 5, 3, 3, [C(WALL[2]), C(WALL[3])]);
  k.ellipse(ox + GYM_W / 2, oy + 5, 1.5, 1.5, [r0, r1]);
  // door with frame and step
  const dx = ox + GYM_W / 2 - 3;
  k.rect(dx - 1, oy + 12, 8, 8, C(WOOD[0]));
  k.rect(dx, oy + 13, 6, 7, C("#2a2440"));
  k.rect(dx, oy + 13, 6, 1, C("#4a4070"));
  k.rect(dx + 2, oy + 13, 2, 7, C("#3a3260"));
  // windows glow cyan
  for (const wx of [ox + 4, ox + GYM_W - 7]) {
    k.rect(wx, oy + 13, 3, 3, C("#5eead4"));
    k.px(wx, oy + 13, C("#d6fff6"));
    k.rect(wx, oy + 16, 3, 1, w[0]);
  }
}

/** Little canopy tree (10×13) with trunk. */
function tree(k: PixelCanvas, pal: Pal, x: number, y: number, pine: boolean) {
  const C = (h: string) => pal.c(h);
  // ground shadow
  for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy <= 1; dy++) if (k.get(x + dx, y + dy) !== C(OUTLINE)) k.px(x + dx, y + dy, C(GRASS[0]));
  k.rect(x - 1, y - 3, 2, 3, C(WOOD[1]));
  k.px(x - 1, y - 3, C(WOOD[2]));
  if (pine) {
    for (let t = 0; t < 3; t++) {
      const cy = y - 4 - t * 3;
      const half = 5 - t;
      for (let row = 0; row < 4; row++) {
        const hw = Math.max(0, Math.round((half * (row + 1)) / 4));
        for (let dx = -hw; dx <= hw; dx++) {
          const c = dx < -hw / 2 ? PINE[3] : dx < hw / 3 ? PINE[2] : PINE[1];
          k.px(x + dx - 0.5, cy - 3 + row, C(row === 3 && dx > 0 ? PINE[0] : c));
        }
      }
    }
  } else {
    k.ellipse(x - 0.5, y - 8, 5, 5, CANOPY.map(C));
    k.ellipse(x - 3, y - 6, 2.5, 2.5, CANOPY.map(C));
    k.ellipse(x + 2.5, y - 6, 2.5, 2.5, CANOPY.map(C), [-0.2, -0.9]);
  }
}

function buildMap(): { grid: Grid; palette: Palette } {
  const pal = new Pal();
  const C = (h: string) => pal.c(h);
  const k = new PixelCanvas(MAP_W, MAP_H);
  const g = GRASS.map(C);

  // --- masks -------------------------------------------------------------
  const blocked = Array.from({ length: MAP_H }, () => Array<boolean>(MAP_W).fill(false));
  const block = (x0: number, y0: number, w: number, h: number) => {
    for (let y = Math.max(0, y0); y < Math.min(MAP_H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(MAP_W, x0 + w); x++) blocked[y][x] = true;
  };

  const riverY = (x: number) => 101 + 4 * Math.sin(x / 11) + 2 * Math.sin(x / 4.7 + 1);
  const inRiver = (x: number, y: number) => Math.abs(y - riverY(x)) < 4.6;
  const mountainTop = (x: number) => 30 + 6 * Math.sin(x / 9 + 0.5) + 3 * Math.sin(x / 3.1);

  // road: a north–south trunk road through the middle, with a short spur to each gym door
  const path = Array.from({ length: MAP_H }, () => Array<boolean>(MAP_W).fill(false));
  const road = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.min(y0, y1) - 2; y <= Math.max(y0, y1) + 2; y++)
      for (let x = Math.min(x0, x1) - 2; x <= Math.max(x0, x1) + 2; x++) if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) path[y][x] = true;
  };
  const TRUNK = 64;
  road(TRUNK, MAP_H + 2, TRUNK, GYM_SPOTS[8][1]);
  for (const [x, y] of GYM_SPOTS.slice(0, 8)) {
    road(x, y, x, y + 4);
    road(x, y + 4, TRUNK, y + 4);
  }

  // --- ground ------------------------------------------------------------
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const n = noise(x, y, 9, 1) * 0.7 + noise(x, y, 3, 2) * 0.3 + (dither(x, y) - 0.5) * 0.18;
      k.px(x, y, n < 0.3 ? g[1] : n > 0.66 ? g[3] : g[2]);
      // grass tufts
      const t = hash(x, y, 3);
      if (t < 0.025 && y > 2) {
        k.px(x, y, g[0]);
        k.px(x - 1, y - 1, g[1]);
        k.px(x + 1, y - 1, g[1]);
      } else if (t > 0.985) k.px(x, y, g[3]);
    }

  // --- mountains (north) -------------------------------------------------
  const rk = ROCK.map(C);
  for (let x = 0; x < MAP_W; x++) {
    const top = mountainTop(x);
    for (let y = 0; y < top + 4; y++) {
      if (y > top) {
        // scree fringe
        if (hash(x, y, 5) < 0.5 - (y - top) * 0.12) k.px(x, y, rk[1]);
        continue;
      }
      blocked[y][x] = true;
    }
  }
  // peaks: shaded triangles, light west faces and dark east faces, snow caps
  const peaks: [number, number, number][] = [
    [8, -6, 26],
    [30, -2, 22],
    [100, -4, 24],
    [122, 0, 20],
    [64, 6, 14],
    [48, 2, 20],
    [80, 0, 20],
  ];
  for (let y = 0; y < 44; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (y > mountainTop(x)) continue;
      let base = rk[1];
      for (const [px, py, hw] of peaks) {
        const depth = y - py;
        if (depth < 0) continue;
        const half = depth * (hw / 30);
        if (Math.abs(x - px) > half) continue;
        const west = x < px;
        const edge = Math.abs(x - px) > half - 1;
        base = edge ? rk[0] : depth < 6 + 2 * Math.sin(x) ? C(SNOW) : west ? (dither(x, y) < 0.7 ? rk[3] : rk[2]) : dither(x, y) < 0.3 ? rk[2] : rk[1];
      }
      k.px(x, y, base);
    }
  // ridge outline along the foothills
  for (let x = 0; x < MAP_W; x++) k.px(x, Math.round(mountainTop(x)), rk[0]);
  // summit plateau for the Kernel Summit
  const [kx, ky] = GYM_SPOTS[8];
  for (let y = ky - GYM_H - 2; y <= ky + 6; y++)
    for (let x = kx - 16; x <= kx + 16; x++) {
      const edge = Math.abs(x - kx) === 16 || y === ky + 6;
      const mortar = y % 4 === 0 || (x + (y % 8 < 4 ? 0 : 3)) % 6 === 0;
      k.px(x, y, edge ? rk[0] : mortar ? rk[2] : hash(x, y, 4) < 0.15 ? rk[3] : C("#9a98b4"));
    }

  // --- river and bridge ---------------------------------------------------
  const wa = WATER.map(C);
  for (let y = 80; y < 124; y++)
    for (let x = 0; x < MAP_W; x++) {
      const d = Math.abs(y - riverY(x));
      if (d < 4.6) {
        blocked[y][x] = true;
        const ripple = hash(x >> 1, y, 7) < 0.06;
        k.px(x, y, d > 3.6 ? wa[2] : ripple ? wa[3] : d < 1.5 && dither(x, y) < 0.6 ? wa[0] : wa[1]);
      } else if (d < 5.6) {
        k.px(x, y, C("#d8c088")); // sandy bank
        blocked[y][x] = true;
      }
    }

  // --- road --------------------------------------------------------------
  const pt = PATH.map(C);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (!path[y][x]) continue;
      blocked[y][x] = true;
      if (inRiver(x, y)) continue;
      const edge = [path[y - 1]?.[x], path[y + 1]?.[x], path[y][x - 1], path[y][x + 1]].some((v) => v === false);
      const h = hash(x, y, 11);
      k.px(x, y, edge ? pt[0] : h < 0.08 ? pt[3] : h < 0.3 ? pt[1] : pt[2]);
    }
  // bridge planks where the road crosses the river
  for (let y = 80; y < 124; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (!path[y][x] || Math.abs(y - riverY(x)) >= 5.6) continue;
      const rail = !path[y][x - 1] || !path[y][x + 1];
      k.px(x, y, rail ? C(WOOD[0]) : y % 2 ? C(WOOD[1]) : C(WOOD[2]));
    }
  for (let y = 80; y < 124; y++)
    for (let x = 1; x < MAP_W - 1; x++) if (path[y][x] && Math.abs(y - riverY(x)) < 5.6 && (!path[y][x - 1] || !path[y][x + 1])) {
      // posts outside the rails
      const side = path[y][x - 1] ? 1 : -1;
      if (y % 3 === 0) k.px(x + side, y, C(WOOD[0]));
    }

  // --- gyms ----------------------------------------------------------------
  GYMS.forEach((gym, i) => {
    const [dx, dy] = GYM_SPOTS[i];
    block(dx - GYM_W / 2 - 2, dy - GYM_H - 2, GYM_W + 4, GYM_H + 5);
  });

  // --- decorations: flowers, rocks, trees ------------------------------------
  const rand = rng(42);
  const free = (x: number, y: number, r: number) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (yy < 0 || xx < 0 || yy >= MAP_H || xx >= MAP_W || blocked[yy][xx]) return false;
    return true;
  };
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * MAP_W);
    const y = 40 + Math.floor(rand() * (MAP_H - 40));
    if (!free(x, y, 1)) continue;
    const petal = C(rand() < 0.5 ? "#ff7aa8" : rand() < 0.5 ? "#ffe27a" : "#f6f4ff");
    k.px(x, y, petal);
    k.px(x + 2, y + 1, petal);
    k.px(x + 1, y + 1, C("#ffd0a0"));
  }
  for (let i = 0; i < 14; i++) {
    const x = 2 + Math.floor(rand() * (MAP_W - 4));
    const y = 44 + Math.floor(rand() * (MAP_H - 48));
    if (!free(x, y, 2)) continue;
    k.ellipse(x, y, 2, 1.5, [rk[0], rk[1], rk[2], rk[3]]);
    k.px(x - 2, y + 2, g[0]);
    k.px(x + 2, y + 2, g[0]);
  }
  // trees: denser near the edges and in the highlands; drawn back-to-front
  const trees: [number, number, boolean][] = [];
  for (let i = 0; i < 900 && trees.length < 95; i++) {
    const x = 3 + Math.floor(rand() * (MAP_W - 6));
    const y = 40 + Math.floor(rand() * (MAP_H - 38));
    const edgeBias = Math.min(x, MAP_W - x) < 14 ? 0.9 : 0.35;
    if (rand() > edgeBias) continue;
    if (!free(x, y - 6, 5)) continue;
    if (trees.some(([tx, ty]) => Math.abs(tx - x) < 7 && Math.abs(ty - y) < 6)) continue;
    trees.push([x, y, y < 96 ? rand() < 0.7 : rand() < 0.2]);
    block(x - 5, y - 12, 11, 14);
  }
  trees.sort((a, b) => a[1] - b[1]);
  const treeLayer = new PixelCanvas(MAP_W, MAP_H);
  for (const [x, y, pine] of trees) {
    const t = new PixelCanvas(MAP_W, MAP_H);
    tree(t, pal, x, y, pine);
    // outline each tree on its own layer, then composite (keeps silhouettes crisp)
    const shadowCh = C(GRASS[0]);
    t.g.forEach((row, yy) => row.forEach((ch, xx) => ch === shadowCh && (k.px(xx, yy, ch), (row[xx] = "."))));
    t.outline(C(OUTLINE));
    treeLayer.stamp(t.toGrid(), 0, 0);
  }
  k.stamp(treeLayer.toGrid(), 0, 0);

  // gym buildings last, with outlines
  GYMS.forEach((gym, i) => {
    const [dx, dy] = GYM_SPOTS[i];
    const b = new PixelCanvas(GYM_W + 2, GYM_H + 2);
    drawGym(b, pal, gym, 1, 1);
    b.outline(C(OUTLINE));
    // shadow to the south-east
    for (let y = 2; y < GYM_H + 2; y++) k.px(dx + GYM_W / 2 + 1, dy - GYM_H + y, g[0]);
    k.stamp(b.toGrid(), dx - GYM_W / 2 - 1, dy - GYM_H - 1);
  });

  return { grid: k.toGrid(), palette: pal.palette };
}

const built = buildMap();

export const OVERWORLD: SpriteSheet = { name: "Region map", palette: built.palette, idle: [built.grid] };

/** Gym building sheets for the sprite viewer. */
export const GYM_SHEETS: SpriteSheet[] = GYMS.map((gym) => {
  const pal = new Pal();
  const k = new PixelCanvas(GYM_W + 2, GYM_H + 2);
  drawGym(k, pal, gym, 1, 1);
  k.outline(pal.c(OUTLINE));
  return { name: `${gym.name} building`, palette: pal.palette, idle: [k.toGrid()] };
});

/** Badge shapes, one per gym: each is an inside-test on [-1, 1]². */
const SHAPES: ((x: number, y: number) => boolean)[] = [
  (x, y) => x * x + y * y <= 1, // round boot badge
  (x, y) => Math.abs(x) + Math.abs(y) <= 1.05, // diamond (fork)
  (x, y) => Math.max(Math.abs(x), Math.abs(y)) <= 0.95 && x * x + y * y <= 1.6, // rounded square (quantum)
  (x, y) => (y < 0.1 ? Math.abs(x) <= 0.95 : Math.abs(x) <= 0.95 - (y - 0.1) * 1.05), // shield (lock)
  (x, y) => Math.abs(x) <= 1 && Math.abs(y) <= 1 && Math.abs(x) * 0.55 + Math.abs(y) <= 1, // hexagon-ish (banker)
  (x, y) => y >= -0.95 && Math.abs(x) <= (y + 0.95) * 0.55 + 0.05, // triangle (frame)
  (x, y) => {
    const a = Math.atan2(y, x);
    const r = Math.hypot(x, y);
    return r <= 0.55 + 0.45 * Math.abs(Math.cos(2.5 * a)); // flower (victim)
  },
  (x, y) => Math.abs(x) <= 0.95 && Math.abs(y) <= 0.95 && !(Math.abs(x) < 0.3 && y < -0.3), // notched block (inode)
  (x, y) => {
    const a = Math.atan2(y, x) + Math.PI / 2;
    const r = Math.hypot(x, y);
    return r <= 0.5 + 0.5 * Math.abs(Math.cos((5 * a) / 2)) ** 1.5; // star (root)
  },
];

export const BADGES: SpriteSheet[] = GYMS.map((gym, i) => {
  const N = 14;
  const k = new PixelCanvas(N, N);
  const pal = new Pal();
  const ramp = gym.ramp.map((h) => pal.c(h));
  const shape = SHAPES[i];
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const u = ((x + 0.5) / N) * 2 - 1;
      const v = ((y + 0.5) / N) * 2 - 1;
      if (!shape(u * 1.18, v * 1.18)) continue;
      const lit = -u * 0.6 - v * 0.8 + (dither(x, y) - 0.5) * 0.4;
      k.px(x, y, lit > 0.45 ? ramp[3] : lit > -0.05 ? ramp[2] : lit > -0.55 ? ramp[1] : ramp[0]);
    }
  // shine
  k.px(4, 4, pal.c("#ffffff"));
  k.px(5, 4, pal.c("#ffffff"));
  k.px(4, 5, pal.c("#ffffff"));
  k.outline(pal.c(OUTLINE));
  return { name: gym.badge, palette: pal.palette, idle: [k.toGrid()] };
});

/** Map marker: a mini Bytling that bobs on the gym the player should take on next. */
function marker(bob: number, blink: boolean): Grid {
  const k = new PixelCanvas(14, 15);
  k.ellipse(7, 8 + bob, 5.5, 5, ["1", "2", "3", "4"]);
  k.ellipse(7, 10.5 + bob, 3, 2, ["a", "b", "c"]);
  k.px(6, 2 + bob, "g");
  k.px(7, 2 + bob, "G");
  k.px(3, 3 + bob, "y");
  k.px(11, 3 + bob, "y");
  k.px(4, 4 + bob, "s");
  k.px(10, 4 + bob, "s");
  if (blink) {
    k.rect(4, 7 + bob, 2, 1, "e");
    k.rect(9, 7 + bob, 2, 1, "e");
  } else {
    k.rect(4, 6 + bob, 2, 2, "e");
    k.rect(9, 6 + bob, 2, 2, "e");
    k.px(4, 6 + bob, "w");
    k.px(9, 6 + bob, "w");
  }
  k.outline("o");
  return k.toGrid();
}

export const MAP_MARKER: SpriteSheet = {
  name: "Map marker",
  palette: {
    o: "#170f2e",
    1: "#23336e",
    2: "#2f5fb8",
    3: "#4f95e8",
    4: "#9fd4ff",
    a: "#c79a52",
    b: "#efcf8a",
    c: "#fff1c8",
    w: "#ffffff",
    e: "#120c24",
    g: "#d22a64",
    G: "#ff5c8a",
    y: "#ffe27a",
    s: "#3a2a5c",
  },
  idle: [marker(1, false), marker(0, false), marker(1, false), marker(0, true)],
  fps: { idle: 3 },
};
