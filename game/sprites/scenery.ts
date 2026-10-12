import { PixelCanvas, type SpriteSheet } from "@/lib/pixel";

/** Grass platform that creatures stand on (title screen and battles). */
function platform(): string[] {
  const k = new PixelCanvas(72, 18);
  k.ellipse(36, 9, 35, 8, ["d", "m", "l", "L"], [-0.2, -1]);
  // tufts along the rim
  for (let x = 6; x < 66; x += 7) k.stamp(["l.l", ".L."], x, 2 + Math.round(Math.abs(36 - x) / 9));
  k.outline("o");
  return k.toGrid();
}

export const PLATFORM: SpriteSheet = {
  name: "Grass platform",
  palette: { o: "#1c2a1a", d: "#2f5a2c", m: "#4b8a3a", l: "#7cc24f", L: "#b8e57a" },
  idle: [platform()],
};

/** Distant "kernel city" skyline: server towers with lit windows. Seeded, so it's stable. */
function skyline(): string[] {
  const W = 160;
  const H = 44;
  const k = new PixelCanvas(W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // far layer of hills
  for (let x = 0; x < W; x++) {
    const h = 10 + Math.round(4 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3));
    for (let y = H - h; y < H; y++) k.px(x, y, "f");
  }
  // towers
  let x = 1;
  while (x < W - 4) {
    const w = 6 + Math.floor(rnd() * 8);
    const h = 14 + Math.floor(rnd() * 24);
    k.rect(x, H - h, w, h, "t");
    k.rect(x, H - h, 1, h, "T"); // lit edge
    for (let wy = H - h + 3; wy < H - 3; wy += 3)
      for (let wx = x + 2; wx < x + w - 1; wx += 2) if (rnd() < 0.45) k.px(wx, wy, rnd() < 0.3 ? "w" : "W");
    if (rnd() < 0.5) k.rect(x + (w >> 1), H - h - 4, 1, 4, "T"); // antenna
    x += w + 1 + Math.floor(rnd() * 4);
  }
  return k.toGrid();
}

export const SKYLINE: SpriteSheet = {
  name: "Kernel city skyline",
  palette: { f: "#2a2156", t: "#1d1640", T: "#3a2f78", w: "#ffe27a", W: "#5eead4" },
  idle: [skyline()],
};
