"use client";
import Link from "next/link";
import { useState } from "react";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { CREATURES, EFFECTS, SCENERY, WORLD } from "@/game/sprites";
import { BACKDROPS, type Backdrop } from "@/game/sprites/scenery";
import { GYMS } from "@/content/gyms";
import { creatureProblems } from "@/lib/creature";
import { runs, type SpriteSheet } from "@/lib/pixel";

const BACKGROUNDS = ["#9fd3a8", "#f8f4e8", "#33226e", "#100e24"];

function animsOf(s: SpriteSheet) {
  return ["idle", ...Object.keys(s.anims ?? {})];
}

function SheetRow({ sheet, bg, scale, white }: { sheet: SpriteSheet; bg: string; scale: number; white: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-pixel text-[9px] text-[#ffd0dd]">
        {sheet.name.toUpperCase()} · {sheet.idle[0][0].length}×{sheet.idle[0].length} · {animsOf(sheet).map((a) => `${a} ${(a === "idle" ? sheet.idle : sheet.anims![a]).length}f`).join(" · ")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {animsOf(sheet).map((a) => (
          <figure key={a} className="flex max-w-full flex-col items-center gap-1 rounded p-2" style={{ background: bg }} data-testid={`anim-${sheet.name}-${a}`}>
            <PixelSprite sprite={sheet} anim={a} scale={scale} white={white} className="h-auto max-w-full" />
            <figcaption className="font-pixel text-[8px] text-[#1a1238] [text-shadow:0_0_2px_#fff]">{a.toUpperCase()}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** A sheet's first frame placed like the battle stage does: bottom-centre at (x, y). */
function Placed({ sheet, x, y, scale, flip = false }: { sheet: SpriteSheet; x: number; y: number; scale: number; flip?: boolean }) {
  const grid = sheet.idle[0];
  const w = grid[0].length;
  const h = grid.length;
  const left = x - (w * scale) / 2;
  const tf = flip ? `translate(${left + w * scale} ${y - h * scale}) scale(${-scale} ${scale})` : `translate(${left} ${y - h * scale}) scale(${scale})`;
  return (
    <g transform={tf}>
      {runs(grid).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={sheet.palette[r.c]} />
      ))}
    </g>
  );
}

/** The battle stage's backdrop (sky, horizon, ground, props, platforms) without creatures, at 960×540. */
function BackdropPreview({ scene }: { scene: Backdrop }) {
  const band = Math.ceil(432 / scene.sky.length);
  const stripes: number[] = [];
  for (let y = 232, i = 0; y < 540; y += 6 + i * 2, i++) stripes.push(y);
  return (
    <svg viewBox="0 0 960 540" shapeRendering="crispEdges" className="h-auto w-full rounded" role="img" aria-label={`${scene.name} backdrop`}>
      {scene.sky.map((c, i) => (
        <rect key={i} x={0} y={i ? -200 + i * band : -600} width={960} height={i ? band : band + 400} fill={hex(c)} />
      ))}
      {[0, 1].map((i) => (
        <Placed key={i} sheet={scene.horizon} x={i * 480 + 240} y={232} scale={3} />
      ))}
      <rect x={0} y={232} width={960} height={308} fill={hex(scene.ground.base)} />
      {stripes.map((y) => (
        <rect key={y} x={0} y={y} width={960} height={3} fill={hex(scene.ground.stripe)} opacity={0.8} />
      ))}
      <rect x={0} y={232} width={960} height={6} fill={hex(scene.ground.edge)} />
      {scene.props.map((p, i) => (
        <Placed key={i} {...p} />
      ))}
      <Placed sheet={scene.platform} x={250} y={510} scale={4} />
      <Placed sheet={scene.platform} x={700} y={300} scale={3} />
    </svg>
  );
}

/** Dev page for reviewing pixel art: every creature (front + back), every animation, every effect. */
export function SpriteViewer() {
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [scale, setScale] = useState(2);
  const [white, setWhite] = useState(false);
  const btn = "min-h-11 px-3 font-pixel text-[10px] border-2 border-[#b9b0d8] rounded";
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd]">
          ◀ TITLE
        </Link>
        <h1 className="font-pixel text-base text-[#ffe27a] pixel-shadow">SPRITES</h1>
        <span className="font-pixel text-[9px] text-white/50">{CREATURES.length} creatures</span>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {[1, 2, 3].map((s) => (
            <button key={s} type="button" onClick={() => setScale(s)} aria-pressed={scale === s} className={`${btn} ${scale === s ? "bg-[#ffe27a] text-[#1a1238]" : ""}`}>
              {s}×
            </button>
          ))}
          <button type="button" onClick={() => setWhite((w) => !w)} aria-pressed={white} className={`${btn} ${white ? "bg-white text-[#1a1238]" : ""}`}>
            SILHOUETTE
          </button>
          {BACKGROUNDS.map((c) => (
            <button key={c} type="button" aria-label={`background ${c}`} onClick={() => setBg(c)} className="h-11 w-11 rounded border-2 border-[#b9b0d8]" style={{ background: c }} />
          ))}
        </div>
      </header>

      {CREATURES.map((c) => {
        const problems = creatureProblems(c);
        return (
          <section key={c.id} className="flex flex-col gap-4 rounded-lg border-2 border-white/10 bg-white/[0.03] p-3" data-testid={`creature-${c.id}`}>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-pixel text-sm text-[#5eead4]">{c.name.toUpperCase()}</h2>
              <span className={`font-pixel text-[9px] ${problems.length ? "text-[#f87171]" : "text-[#4ade80]"}`}>{problems.length ? `${problems.length} PROBLEMS` : "MEETS THE ART BAR"}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(c.front.palette).map(([k, col]) => (
                <span key={k} title={`${k} ${col}`} className="h-6 w-6 rounded-sm border border-black/40" style={{ background: col }} />
              ))}
            </div>
            {problems.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-[#f87171]">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <SheetRow sheet={c.front} bg={bg} scale={scale} white={white} />
            <SheetRow sheet={c.back} bg={bg} scale={scale} white={white} />
          </section>
        );
      })}

      <section className="flex flex-col gap-4 rounded-lg border-2 border-white/10 bg-white/[0.03] p-3" data-testid="backdrops">
        <h2 className="font-pixel text-sm text-[#5eead4]">BATTLE BACKDROPS</h2>
        {[...new Set(Object.values(BACKDROPS))].map((b) => (
          <figure key={b.name} className="flex flex-col gap-2" data-testid={`backdrop-${b.name}`}>
            <figcaption className="font-pixel text-[9px] text-[#ffd0dd]">
              {b.name.toUpperCase()} · {GYMS.filter((g) => BACKDROPS[g.id] === b).map((g) => g.name).join(", ")}
            </figcaption>
            <BackdropPreview scene={b} />
          </figure>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border-2 border-white/10 bg-white/[0.03] p-3">
        <h2 className="font-pixel text-sm text-[#5eead4]">EFFECTS + SCENERY</h2>
        {[...EFFECTS, ...SCENERY].map((s) => (
          <SheetRow key={s.name} sheet={s} bg={bg} scale={scale} white={white} />
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border-2 border-white/10 bg-white/[0.03] p-3">
        <h2 className="font-pixel text-sm text-[#5eead4]">OVERWORLD</h2>
        {WORLD.map((s) => (
          <SheetRow key={s.name} sheet={s} bg={bg} scale={scale} white={white} />
        ))}
      </section>
    </main>
  );
}
