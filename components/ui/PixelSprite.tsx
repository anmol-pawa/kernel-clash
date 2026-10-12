"use client";
import { useEffect, useState } from "react";
import { framesOf, runs, type SpriteSheet } from "@/lib/pixel";

/**
 * Renders a palette + grid sprite as crisp SVG, cycling one animation's frames
 * (idle by default). `white` draws the solid silhouette used for hurt / evolve.
 */
export function PixelSprite({ sprite, anim = "idle", scale = 4, fps, white = false, className }: { sprite: SpriteSheet; anim?: string; scale?: number; fps?: number; white?: boolean; className?: string }) {
  const frames = framesOf(sprite, anim);
  const rate = fps ?? sprite.fps?.[anim] ?? 3;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (frames.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000 / rate);
    return () => clearInterval(id);
  }, [frames.length, rate]);
  const grid = frames[tick % frames.length];
  const w = grid[0].length;
  const h = grid.length;
  return (
    <svg role="img" aria-label={sprite.name} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" className={className}>
      {runs(grid).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={white ? "#ffffff" : sprite.palette[r.c]} />
      ))}
    </svg>
  );
}
