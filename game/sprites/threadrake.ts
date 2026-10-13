import type { CreatureArt } from "@/lib/creature";
import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Threadrake: Bytling's evolved form, a process grown into a small upright
 * drake. The program-counter gem still sits on its brow, its antenna pins
 * have become swept-back horns, and its tail splits into three braided
 * threads that glow as it schedules work. Its back carries a ridge of
 * heat-sink plates. Original design.
 */
const palette = {
  o: "#170f2e", // outline
  1: "#1d2a62", // body ramp, dark → light
  2: "#2f5fb8",
  3: "#4f95e8",
  4: "#9fd4ff",
  a: "#c79a52", // belly ramp
  b: "#efcf8a",
  c: "#fff1c8",
  w: "#ffffff",
  e: "#120c24", // pupil / mouth
  r: "#ff7aa8", // blush / tongue
  g: "#d22a64", // gem ramp
  G: "#ff5c8a",
  H: "#ffd0dd",
  y: "#e8a52a", // horn tips / claws
  Y: "#ffe27a",
  s: "#3a2a5c", // horn base
  S: "#5d4a8a",
  t: "#7ff0d8", // thread glow
  T: "#2fb8a0",
} as const;

const BODY = ["1", "2", "3", "4"];
const BELLY = ["a", "b", "c"];

const EYE_OPEN: Grid = ["ee.....", ".eeww..", "ewwwee.", "wwweeee", "wweewee", ".weeee.", "..ee..."];
const EYE_FOCUS: Grid = ["eee....", ".eeeee.", "wwwweee", "wwweee.", ".weee..", ".......", "......."];
const EYE_SHUT: Grid = [".......", ".......", ".......", "eeeeeee", ".eeeee.", ".......", "......."];
const EYE_HURT: Grid = ["e......", ".ee....", "...ee..", ".....ee", "...ee..", ".ee....", "e......"];
const GEM: Grid = ["...H...", "..HGG..", ".HGGGG.", "HGGGGGg", ".GGGgg.", "..ggg..", "...g..."];
const GEM_LIT: Grid = ["...w...", "..wHH..", ".wHHHH.", "wHHHHHG", ".HHHGG.", "..GGG..", "...G..."];
const TIP: Grid = [".yY.", "yYYy", "yYyy", ".yy."];
const TIP_LIT: Grid = [".Yw.", "YwwY", "YwYy", ".YY."];
const CLAW: Grid = ["y.y.y", "Y.Y.Y"];
/** circuit trace with a pad, on the left flank (mirrored later) */
const TRACE: Grid = ["t...", "T...", "T...", "TTTt"];

interface Pose {
  bob?: number; // 0..1 breathing
  squash?: number; // + wider/shorter, - taller/thinner
  lean?: number; // px forward
  eyes?: "open" | "focus" | "shut" | "hurt";
  mouth?: "smile" | "open" | "wince";
  lit?: boolean; // gem, horn tips and threads charged
  arms?: number; // arm raise in px
  tail?: number; // tail sway, -1..1
}

/** Draw `src` underneath `k`: only where `k` is still empty. */
function under(k: PixelCanvas, src: PixelCanvas) {
  for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) if (k.g[y][x] === "." && src.g[y][x] !== ".") k.g[y][x] = src.g[y][x];
}

/** The three-thread tail, curling out to the right. */
function tail(sway: number, lit: boolean, rootX: number, rootY: number): PixelCanvas {
  const t = new PixelCanvas(64, 64);
  const tipX = 60 + sway;
  const tipY = rootY - 18 - sway * 2;
  t.tube([rootX, rootY], [58, rootY + 2], [tipX, tipY + 6], 5, 2.5, BODY);
  // three braided threads fanning off the end
  const glow = lit ? ["T", "t", "w"] : ["1", "T", "t"];
  t.tube([tipX, tipY + 7], [tipX + 1, tipY + 2], [tipX - 2, tipY - 4], 1.8, 1.2, glow);
  t.tube([tipX, tipY + 7], [tipX + 3, tipY + 4], [tipX + 3, tipY - 1], 1.6, 1, glow);
  t.tube([tipX - 1, tipY + 7], [tipX - 4, tipY + 3], [tipX - 6, tipY - 1], 1.6, 1, glow);
  // braid marks along the tail
  for (let i = 0; i < 4; i++) t.px(rootX + 4 + i * 3, rootY + 1 - i, lit ? "t" : "T");
  return t;
}

function frontFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const arms = p.arms ?? 0;
  const tcy = 44 - sq + bob * 0.5 + lean * 0.5; // torso centre
  const hcy = 24 + sq * 1.2 - bob * 0.4 + lean; // head centre
  // feet and stocky legs
  k.ellipse(21, 59, 7, 3.5, ["1", "2"]);
  k.stamp(CLAW, 16, 60);
  k.ellipse(23, 53, 6.5, 6.5, BODY);
  // arms (behind the torso at the shoulder), claws up when attacking
  const hx = 9 - arms * 0.3;
  const hy = tcy + 3 - arms;
  k.tube([19, tcy - 7], [11, tcy - 2], [hx, hy], 4, 3.2, BODY);
  k.stamp(["y.y", "YyY"], Math.round(hx) - 2, Math.round(hy) - 4 + (arms > 3 ? 0 : 6));
  // torso and belly plate with circuit traces
  k.ellipse(32, tcy, 16 + sq, 15.5 - sq * 0.5, BODY);
  k.ellipse(32, tcy + 3, 9.5 + sq * 0.5, 11, BELLY);
  for (let i = 0; i < 4; i++) k.rect(26, Math.round(tcy - 4 + i * 4), 6, 1, "a");
  k.stamp(TRACE, 18, Math.round(tcy - 3));
  // swept-back horns (the old antenna pins), then the head over their roots
  k.tube([24, hcy - 7], [16, hcy - 15], [11, hcy - 19], 3.6, 1.8, ["s", "S", "S"]);
  k.stamp(p.lit ? TIP_LIT : TIP, 8, Math.round(hcy - 23));
  // cheek fins
  k.ellipse(15, hcy + 3, 4, 5, ["1", "2", "3"]);
  k.ellipse(32, hcy, 15.5 + sq * 0.5, 12 - sq * 0.4, BODY);
  // snout
  k.ellipse(32, hcy + 6, 8, 5, ["2", "3", "4"]);
  k.mirror();
  // face (after mirroring so the highlights stay top-left)
  const eye = { open: EYE_OPEN, focus: EYE_FOCUS, shut: EYE_SHUT, hurt: EYE_HURT }[p.eyes ?? "open"];
  const ey = Math.round(hcy - 5);
  k.stamp(eye, 19, ey);
  k.stamp(eye, 38, ey, true);
  k.rect(18, ey + 8, 3, 1, "r");
  k.rect(43, ey + 8, 3, 1, "r");
  const my = Math.round(hcy + 6);
  k.px(30, my - 2, "1");
  k.px(33, my - 2, "1");
  if (p.mouth === "open") k.stamp(["eeeeee", "ewrrwe", ".errre", "..eee."], 29, my);
  else if (p.mouth === "wince") k.stamp(["e.e.e.", ".e.e.e"], 29, my + 1);
  else k.stamp(["e....e", ".eeew."], 29, my);
  k.stamp(p.lit ? GEM_LIT : GEM, 29, Math.round(hcy - 13));
  under(k, tail(p.tail ?? 0, !!p.lit, 44, Math.round(tcy + 9)));
  k.outline("o");
  return k.toGrid();
}

/** Seen from behind: a ridge of heat-sink plates down the spine, horns, and the thread tail. */
function backFrame(p: Pose): Grid {
  const k = new PixelCanvas(64, 64);
  const bob = p.bob ?? 0;
  const sq = p.squash ?? 0;
  const lean = p.lean ?? 0;
  const arms = p.arms ?? 0;
  const tcy = 45 - sq + bob * 0.5;
  const hcy = 24 + sq * 1.2 - bob * 0.4 - lean;
  // arms out at the sides
  k.tube([16, tcy - 6], [8, tcy - 2 - arms], [6, tcy + 4 - arms * 1.4], 4.2, 3.4, BODY);
  k.ellipse(32, tcy, 19 + sq, 17.5 - sq * 0.5, BODY, [-0.5, -0.9]);
  k.tube([23, hcy - 6], [15, hcy - 14], [10, hcy - 18], 3.8, 2, ["s", "S", "S"]);
  k.stamp(p.lit ? TIP_LIT : TIP, 7, Math.round(hcy - 22));
  k.ellipse(13, hcy + 4, 4, 5, ["1", "2", "3"]);
  k.ellipse(32, hcy, 16 + sq * 0.5, 12.5 - sq * 0.4, BODY, [-0.5, -0.3]);
  // the scruff where head meets back
  k.ellipse(32, hcy + 12, 15 + sq, 7, ["2", "3"], [-0.4, 0.1]);
  k.mirror();
  // heat-sink plates down the spine, lit along their top edge
  const top = Math.round(hcy - 10);
  for (let i = 0; i < 7; i++) {
    const y = top + i * 6;
    const w = i === 0 || i === 6 ? 4 : 6;
    k.rect(32 - w / 2, y, w, 4, "1");
    k.rect(32 - w / 2 + 1, y, w - 2, 1, p.lit ? "t" : "3");
  }
  // status LED between the horns
  k.stamp(p.lit ? [".Y.", "YwY", ".Y."] : [".t.", "tTt", ".t."], 22, Math.round(hcy - 3));
  under(k, tail(-(p.tail ?? 0), !!p.lit, 46, Math.round(tcy + 8)));
  if (p.eyes === "hurt") for (const [x, y] of [[4, hcy - 4], [53, hcy - 8], [57, hcy - 2]] as const) k.stamp(["w.w", ".w.", "w.w"], x, Math.round(y));
  k.outline("o");
  return k.toGrid();
}

function sheet(side: "front" | "back"): SpriteSheet {
  const f = side === "front" ? frontFrame : backFrame;
  return {
    name: `Threadrake (${side})`,
    palette,
    idle: [f({}), f({ bob: 1, tail: 1 }), f({ tail: 2 }), f({ bob: 1, tail: 1, eyes: "shut" })],
    anims: {
      attack: [f({ squash: 1, eyes: "focus", arms: 3, lit: true, tail: -1 }), f({ squash: -1, lean: 3, eyes: "focus", mouth: "open", lit: true, arms: 8, tail: 2 }), f({ lean: 1, mouth: "open", lit: true, arms: 4, tail: 1 })],
      hurt: [f({ squash: 1.4, eyes: "hurt", mouth: "wince", tail: -2 }), f({ squash: 0.6, eyes: "hurt", mouth: "wince", tail: -1 })],
    },
    fps: { idle: 2.5, attack: 6, hurt: 6 },
  };
}

export const THREADRAKE_ART: CreatureArt = { id: "threadrake", name: "Threadrake", front: sheet("front"), back: sheet("back") };
