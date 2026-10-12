"use client";
import { useEffect, useState } from "react";
import { runs, type SpriteSheet } from "@/lib/pixel";

/** Renders a palette + grid sprite as crisp SVG, cycling its idle frames. */
export function PixelSprite({ sprite, scale = 4, fps = 3, className }: { sprite: SpriteSheet; scale?: number; fps?: number; className?: string }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (sprite.idle.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setF((n) => (n + 1) % sprite.idle.length), 1000 / fps);
    return () => clearInterval(id);
  }, [sprite, fps]);
  const grid = sprite.idle[f];
  const w = grid[0].length;
  const h = grid.length;
  return (
    <svg role="img" aria-label={sprite.name} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" className={className}>
      {runs(grid).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={sprite.palette[r.c]} />
      ))}
    </svg>
  );
}
