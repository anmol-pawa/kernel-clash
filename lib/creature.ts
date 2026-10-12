import type { Grid, SpriteSheet } from "./pixel";

/**
 * A battle creature's art: a front sheet (how foes see it) and a back sheet
 * (the player's own creature, bottom-left of the stage). Both sheets need an
 * idle loop plus "attack" and "hurt" poses; faint (sink + fade) and evolve
 * (white silhouette morph) are stage effects built on top of these frames.
 */
export interface CreatureArt {
  id: string;
  name: string;
  /** bosses are drawn on a bigger grid */
  boss?: boolean;
  front: SpriteSheet;
  back: SpriteSheet;
}

export const REQUIRED_ANIMS = ["attack", "hurt"] as const;
export const MAX_COLOURS = 24;

/** Every way a creature's art breaks the art bar (empty when it's fine). */
export function creatureProblems(c: CreatureArt): string[] {
  const out: string[] = [];
  const min = c.boss ? 96 : 64;
  for (const side of ["front", "back"] as const) {
    const s = c[side];
    const all: [string, Grid[]][] = [["idle", s.idle], ...Object.entries(s.anims ?? {})];
    const h = s.idle[0]?.length ?? 0;
    const w = s.idle[0]?.[0]?.length ?? 0;
    if (w < min || h < min) out.push(`${side}: ${w}×${h} is under ${min}×${min}`);
    if (s.idle.length < 2 || s.idle.length > 4) out.push(`${side}: idle has ${s.idle.length} frames (want 2–4)`);
    if (new Set(s.idle.map((f) => f.join(""))).size < 2) out.push(`${side}: idle frames are all identical`);
    for (const a of REQUIRED_ANIMS) if (!s.anims?.[a]?.length) out.push(`${side}: missing "${a}" animation`);
    if (Object.keys(s.palette).length > MAX_COLOURS) out.push(`${side}: ${Object.keys(s.palette).length} colours (max ${MAX_COLOURS})`);
    for (const [name, frames] of all)
      frames.forEach((f, i) => {
        const at = (x: number, y: number) => f[y]?.[x] ?? ".";
        if (f.length !== h || f.some((r) => r.length !== w)) out.push(`${side} ${name}[${i}]: not ${w}×${h}`);
        let filled = 0;
        let edgeBad = 0;
        for (let y = 0; y < f.length; y++)
          for (let x = 0; x < f[y].length; x++) {
            const ch = f[y][x];
            if (ch === ".") continue;
            filled++;
            if (!(ch in s.palette)) out.push(`${side} ${name}[${i}]: colour "${ch}" not in palette`);
            const edge = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes(".");
            if (edge && !OUTLINE_KEYS.has(ch)) edgeBad++;
          }
        // a clear silhouette: the sprite fills a good share of its box and is outlined
        if (filled < w * h * 0.2) out.push(`${side} ${name}[${i}]: only ${filled} filled pixels`);
        if (edgeBad > filled * 0.04) out.push(`${side} ${name}[${i}]: ${edgeBad} edge pixels aren't outline`);
      });
  }
  if (Object.keys(c.front.palette).join() !== Object.keys(c.back.palette).join()) out.push("front and back palettes differ");
  return out;
}

/** Palette keys that count as outline (or outline-adjacent glitch fringe). */
const OUTLINE_KEYS = new Set(["o", "c", "k"]);
