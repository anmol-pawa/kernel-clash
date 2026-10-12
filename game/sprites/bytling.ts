import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/**
 * Bytling: the title-screen mascot, a round little process-sprite with a
 * program-counter gem on its forehead and two antenna "pins". Original design.
 */
const palette = {
  o: "#170f2e", // outline
  1: "#23336e", // body ramp, dark → light
  2: "#2f5fb8",
  3: "#4f95e8",
  4: "#9fd4ff",
  a: "#c79a52", // belly ramp
  b: "#efcf8a",
  c: "#fff1c8",
  w: "#ffffff",
  e: "#120c24", // pupil
  r: "#ff7aa8", // blush
  g: "#d22a64", // gem ramp
  G: "#ff5c8a",
  H: "#ffd0dd",
  y: "#e8a52a", // antenna tip
  Y: "#ffe27a",
  s: "#3a2a5c", // stalk
  f: "#1b2552", // feet
  F: "#2a3d80",
} as const;

const EYE_OPEN: Grid = [".www.", "wwwew", "wweee", "wweee", ".wee."];
const EYE_SHUT: Grid = [".....", ".....", "eeeee", ".eee.", "....."];
const GEM: Grid = ["..H..", ".HGG.", "HGGGg", ".Ggg.", "..g.."];
const TIP: Grid = [".yy.", "yYYy", "yYyy", ".yy."];

function frame(bob: number, blink: boolean): Grid {
  const S = 40;
  const k = new PixelCanvas(S, S);
  const cy = 23 + bob * 0.5;
  // antenna stalks + tips (drawn first so the head overlaps their roots)
  k.line(13, 13 + bob, 9, 6 + bob, "s");
  k.stamp(TIP, 6, 3 + bob);
  // feet
  k.ellipse(12, 35.5, 4.5, 2.2, ["f", "F"]);
  // body
  k.ellipse(20, cy, 14 - bob * 0.3, 12.5 + bob * 0.3, ["1", "2", "3", "4"]);
  // belly
  k.ellipse(20, cy + 5, 8, 5.5, ["a", "b", "c"]);
  k.mirror();
  // face (after mirroring so the highlights stay top-left)
  const ey = Math.round(cy - 5);
  k.stamp(blink ? EYE_SHUT : EYE_OPEN, 11, ey);
  k.stamp(blink ? EYE_SHUT : EYE_OPEN, 24, ey, true);
  k.rect(10, ey + 6, 3, 1, "r");
  k.rect(27, ey + 6, 3, 1, "r");
  k.stamp(["e...e", ".eee."], 18, ey + 6); // smile
  k.stamp(GEM, 18, Math.round(cy - 12));
  k.outline("o");
  return k.toGrid();
}

export const BYTLING: SpriteSheet = {
  name: "Bytling",
  palette,
  idle: [frame(0, false), frame(1, false), frame(0, false), frame(1, true)],
};
