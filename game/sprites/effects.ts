import { PixelCanvas, type Grid, type SpriteSheet } from "@/lib/pixel";

/** White-hot "bit orb" projectile, 3-frame shimmer. Tinted per move type on stage. */
function orb(phase: number): Grid {
  const k = new PixelCanvas(16, 16);
  k.ellipse(8, 8, 6.5 - phase * 0.5, 6.5 - phase * 0.5, ["1", "2", "3"]);
  k.ellipse(7, 7, 3, 3, ["3", "4"]);
  // orbiting bits
  const a = (phase * Math.PI * 2) / 3;
  k.px(8 + Math.round(Math.cos(a) * 7), 8 + Math.round(Math.sin(a) * 7), "4");
  k.px(8 - Math.round(Math.cos(a) * 7), 8 - Math.round(Math.sin(a) * 7), "3");
  return k.toGrid();
}

/** Impact star: burst, spread, scatter. */
function spark(step: number): Grid {
  const k = new PixelCanvas(24, 24);
  const r = [4, 8, 11][step];
  const c = step === 2 ? "2" : "4";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + (step === 1 ? Math.PI / 8 : 0);
    const len = i % 2 ? r * 0.6 : r;
    k.line(12, 12, 12 + Math.cos(a) * len, 12 + Math.sin(a) * len, i % 2 ? "3" : c);
  }
  if (step < 2) k.ellipse(12, 12, 3 - step, 3 - step, ["3", "4"]);
  if (step === 2) for (let i = 0; i < 6; i++) k.px(12 + Math.round(Math.cos(i) * 10), 12 + Math.round(Math.sin(i) * 10), "4");
  return k.toGrid();
}

const FX_PALETTE = { 1: "#7f8aa8", 2: "#b9c4de", 3: "#e6ecf8", 4: "#ffffff" };

export const BIT_ORB: SpriteSheet = { name: "Bit orb", palette: FX_PALETTE, idle: [orb(0), orb(1), orb(2)], fps: { idle: 12 } };
export const IMPACT: SpriteSheet = { name: "Impact spark", palette: FX_PALETTE, idle: [spark(0), spark(1), spark(2)], fps: { idle: 14 } };
