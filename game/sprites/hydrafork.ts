import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Hydrafork, boss of the Fork Grove Gym (processes and threads): a teal hydra
 * rooted like a grove tree. One parent neck rises from the trunk and forks
 * into two smaller child heads, a process tree you can see. Original
 * design, 96×96.
 */
const palette = {
  o: "#0a1d1b", // outline
  1: "#0f5a55", // scale ramp (gym teal), dark → light
  2: "#178f84",
  3: "#3cc9b5",
  4: "#9af2e2",
  b: "#9c7f4a", // belly plates
  B: "#d4b977",
  n: "#f4e6ad",
  w: "#3d2414", // bark roots
  W: "#6e4526",
  x: "#a06a3a",
  l: "#2f7d3a", // leaf crests
  L: "#69c04f",
  G: "#c6f27a",
  e: "#ff9a1f", // eyes
  E: "#fff1b8",
  m: "#2a0812", // mouth
  M: "#c23b5e", // tongue
  t: "#fffaf0", // teeth
} as const;

const W = 96;
const SCALE = ["1", "2", "3", "4"];
const BELLY = ["b", "B", "n"];
const BARK = ["w", "W", "x"];
const LEAF = ["l", "L", "G"];

type P = [number, number];

interface Head {
  /** head centre */
  at: P;
  /** where the neck leaves its parent */
  from: P;
  /** neck control point */
  via: P;
  r: number;
}

interface Pose {
  /** per-head offset [main, left child, right child] */
  sway?: [P, P, P];
  open?: boolean;
  blink?: boolean;
  hurt?: boolean;
  /** extra head radius (lunging toward the viewer) */
  grow?: number;
  oy?: number;
}

function heads(p: Pose): Head[] {
  const [s0, s1, s2] = p.sway ?? [[0, 0], [0, 0], [0, 0]];
  const oy = p.oy ?? 0;
  const g = p.grow ?? 0;
  const main: P = [48 + s0[0], 22 + s0[1] + oy];
  return [
    { at: main, from: [48, 62 + oy], via: [46, 42 + oy], r: 13 + g },
    { at: [18 + s1[0], 32 + s1[1] + oy], from: [46, 52 + oy], via: [28, 54 + oy], r: 10 + g * 0.5 },
    { at: [78 + s2[0], 28 + s2[1] + oy], from: [50, 48 + oy], via: [70, 50 + oy], r: 10 + g * 0.5 },
  ];
}

/** A head seen from the front: skull, snout, eyes, leaf crest and jaw. */
function faceHead(k: PixelCanvas, h: Head, p: Pose) {
  const [x, y] = h.at;
  const r = h.r;
  // leaf crest fanning up from the skull
  for (const dx of [-0.55, 0, 0.55]) k.tube([x + dx * r * 0.6, y - r * 0.4], [x + dx * r * 1.1, y - r * 1.1], [x + dx * r * 1.4, y - r * 1.5], r * 0.22, r * 0.08, LEAF);
  // finned cheek frills
  for (const sd of [-1, 1]) k.tube([x + sd * r * 0.6, y + r * 0.1], [x + sd * r * 1.05, y - r * 0.05], [x + sd * r * 1.3, y - r * 0.45], r * 0.25, r * 0.07, LEAF);
  k.ellipse(x, y, r, r * 0.82, SCALE);
  // lower jaw drops open to bite
  const jaw = p.open ? r * 0.55 : 0;
  if (p.open) {
    k.ellipse(x, y + r * 0.62 + jaw * 0.5, r * 0.62, r * 0.42 + jaw * 0.5, ["m"]);
    k.ellipse(x, y + r * 0.75 + jaw, r * 0.38, r * 0.22, ["M"]);
    k.ellipse(x, y + r * 0.95 + jaw, r * 0.6, r * 0.25, SCALE);
    for (const dx of [-0.4, 0.4]) k.rect(Math.round(x + dx * r) - (dx < 0 ? 0 : 1), Math.round(y + r * 0.5), 2, Math.max(2, Math.round(r * 0.3)), "t");
  }
  // snout
  k.ellipse(x, y + r * 0.45, r * 0.78, r * 0.42, SCALE);
  k.ellipse(x, y + r * 0.58, r * 0.5, r * 0.18, BELLY);
  const nx = Math.round(r * 0.25);
  k.px(x - nx, y + r * 0.3, "m");
  k.px(x + nx, y + r * 0.3, "m");
  if (!p.open) k.line(x - r * 0.55, y + r * 0.72, x + r * 0.55, y + r * 0.72, "m");
  // eyes
  const ex = Math.round(r * 0.48);
  const ey = Math.round(y - r * 0.15);
  for (const s of [-1, 1]) {
    const cx = Math.round(x + s * ex);
    if (p.hurt) k.stamp(["m.m", ".m.", "m.m"], cx - 1, ey - 1);
    else if (p.blink) k.rect(cx - 1, ey, 3, 1, "m");
    else {
      k.stamp(r >= 12 ? ["eEEe", "eemE", "emme", ".ee."] : ["eEe", "eme", "eme"], cx - (r >= 12 ? (s < 0 ? 2 : 1) : 1), ey - 1);
      // brow ridge scowling inward
      k.line(cx - 2 * s, ey - 3, cx + 1 * s, ey - 2, "1");
    }
  }
}

/** A head seen from behind: back of the skull, crest and spine leaves. */
function backHead(k: PixelCanvas, h: Head) {
  const [x, y] = h.at;
  const r = h.r;
  for (const dx of [-0.55, 0, 0.55]) k.tube([x + dx * r * 0.6, y - r * 0.2], [x + dx * r * 1.1, y - r * 1.0], [x + dx * r * 1.4, y - r * 1.4], r * 0.24, r * 0.08, LEAF);
  k.ellipse(x, y, r * 0.95, r * 0.85, SCALE);
  // scale rows on the back of the head
  for (let i = -1; i <= 1; i++) k.line(x - r * 0.5, y + i * r * 0.3 + 1, x + r * 0.5, y + i * r * 0.3 + 1, "2");
  k.px(x - Math.round(r * 0.4), y - r * 0.5, "4");
}

/** Bark roots splayed under the trunk. */
function roots(k: PixelCanvas, oy: number, lift: number) {
  const r: [P, P, P][] = [
    [[34, 78], [22, 82], [12, 92]],
    [[42, 82], [36, 90], [30, 94]],
    [[54, 82], [60, 90], [66, 94]],
    [[62, 78], [74, 82], [84, 92]],
  ];
  r.forEach(([a, b, c], i) => k.tube([a[0], a[1] + oy], [b[0], b[1] + oy * 0.5], [c[0], c[1] - (i % 2 ? lift : 0)], 4.5, 2, BARK));
}

function front(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const oy = p.oy ?? 0;
  const hs = heads(p);
  roots(k, oy, p.open ? 1 : 0);
  // trunk body and belly
  k.ellipse(48, 68 + oy, 25, 17, SCALE);
  k.ellipse(48, 72 + oy, 14, 11, BELLY);
  for (let i = 0; i < 4; i++) k.line(38, 66 + oy + i * 4, 58, 66 + oy + i * 4, "b");
  // child necks first, then the parent neck over the fork
  for (const h of [hs[1], hs[2], hs[0]]) {
    const end: P = [h.at[0], h.at[1] + h.r * 0.6];
    k.tube(h.from, h.via, end, h === hs[0] ? 9 : 6.5, h === hs[0] ? 6.5 : 4.5, SCALE);
    k.tube([h.from[0], h.from[1] - 4], h.via, [end[0], end[1] + 3], h === hs[0] ? 4.5 : 2.5, h === hs[0] ? 3 : 1.8, BELLY);
  }
  // belly plate seams up the parent neck
  for (let y = hs[0].at[1] + 14; y < 58 + oy; y += 4) for (let x = 0; x < 96; x++) if (k.g[y]?.[x] === "B" || k.g[y]?.[x] === "n") k.g[y][x] = "b";
  for (const h of [hs[1], hs[2], hs[0]]) faceHead(k, h, p);
  k.outline("o");
  return k.toGrid();
}

/** From behind: the trunk's leafy spine ridge, three necks rising, crests on every head. */
function back(p: Pose): Grid {
  const k = new PixelCanvas(W, W);
  const oy = p.oy ?? 0;
  const hs = heads(p).map((h) => ({ ...h, at: [h.at[0], h.at[1] + 4] as P, r: h.r * 1.05 }));
  roots(k, oy, p.open ? 1 : 0);
  // tail curling round the roots
  k.tube([62, 82 + oy], [86, 84], [86, 70], 5, 2, SCALE);
  k.ellipse(48, 70 + oy, 28, 19, SCALE);
  for (const h of [hs[1], hs[2], hs[0]]) {
    const end: P = [h.at[0], h.at[1] + h.r * 0.4];
    k.tube([h.from[0], h.from[1] + 4], [h.via[0], h.via[1] + 4], end, h === hs[0] ? 10 : 7, h === hs[0] ? 7 : 5, SCALE);
  }
  // spine leaves down the back of the parent neck and trunk
  for (let i = 0; i < 7; i++) {
    const y = hs[0].at[1] + 12 + i * 7;
    const x = 48 + (i < 3 ? (hs[0].at[0] - 48) * (1 - i / 3) : 0);
    k.stamp(["..G..", ".LGL.", "lLGLl", ".lLl.", "..l.."], Math.round(x) - 2, Math.round(y));
  }
  // bark-like scale rings on the trunk
  for (const [x, y, w] of [[30, 64, 10], [56, 64, 10], [34, 72, 8], [54, 72, 8], [40, 79, 16]]) k.rect(x, y + oy, w, 1, "2");
  for (const h of [hs[1], hs[2], hs[0]]) backHead(k, h);
  if (p.hurt) for (const [x, y] of [[4, 10], [86, 8]]) k.stamp(["e.e", ".E.", "e.e"], x, y);
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? front : back;
  return {
    name: `Hydrafork (${side})`,
    palette,
    idle: [
      f({}),
      f({ sway: [[0, 1], [-1, -1], [1, 1]] }),
      f({ sway: [[1, 1], [0, -2], [1, 0]] }),
      f({ sway: [[0, 0], [-1, 0], [0, -1]], blink: true }),
    ],
    anims: {
      attack: [
        f({ sway: [[0, -3], [-3, -2], [3, -3]], open: true }),
        f({ sway: [[0, 5], [4, 4], [-4, 5]], open: true, grow: 2 }),
        f({ sway: [[0, 3], [3, 2], [-3, 3]], grow: 1 }),
      ],
      hurt: [f({ sway: [[0, -3], [-4, -3], [4, -4]], hurt: true }), f({ sway: [[2, -2], [-3, -1], [3, -2]], hurt: true, oy: 1 })],
    },
    fps: { idle: 3, attack: 6, hurt: 6 },
  };
}

export const HYDRAFORK_ART: CreatureArt = { id: "hydrafork", name: "Hydrafork", boss: true, front: sheet("front"), back: sheet("back") };
