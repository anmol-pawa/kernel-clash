"use client";
import Link from "next/link";
import { useState } from "react";
import { PixelSprite } from "@/components/ui/PixelSprite";
import { BYTLING } from "@/game/sprites/bytling";
import { PLATFORM, SKYLINE } from "@/game/sprites/scenery";

const SKY = ["#1b1446", "#251a5c", "#33226e", "#4a2c7e", "#6b3a86", "#94508a", "#c46f86"];

export default function Title() {
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* banded pixel sky */}
      <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(${SKY.map((c, i) => `${c} ${(i * 100) / SKY.length}% ${((i + 1) * 100) / SKY.length}%`).join(",")})` }} />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-[38%] bg-[#1d1640]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[38%] -z-10 flex justify-center">
        {[0, 1, 2].map((i) => (
          <PixelSprite key={i} sprite={SKYLINE} scale={4} className="shrink-0" />
        ))}
      </div>

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
        <p className="font-pixel text-[10px] tracking-[0.25em] text-[#ffd0dd] pixel-shadow">AN OPERATING SYSTEMS ADVENTURE</p>
        <h1 className="mt-4 font-pixel text-[40px] leading-[1.15] text-[#ffe27a] pixel-shadow sm:text-6xl">
          KERNEL
          <br />
          <span className="text-[#5eead4]">CLASH</span>
        </h1>

        <div className="relative mt-auto flex flex-col items-center pt-6">
          <PixelSprite sprite={BYTLING} scale={3} fps={2.5} className="relative z-10 -mb-12" />
          <PixelSprite sprite={PLATFORM} scale={4} />
        </div>

        <Link href="/map" className="mt-8 flex min-h-12 items-center px-6 font-pixel text-sm text-white pixel-shadow">
          <span className="blink">▶</span>&nbsp;PRESS START
        </Link>
        <div className="flex gap-2">
          <Link href="/battle" className="flex min-h-11 items-center px-3 font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">
            QUICK BATTLE
          </Link>
          <button
            type="button"
            onClick={() => setMsg("Nine gyms await on the region map: OS basics, processes, scheduling, sync, deadlocks, memory, virtual memory, storage, and the interview gauntlet at the Kernel Summit.")}
            className="min-h-11 px-3 font-pixel text-[10px] text-[#ffd0dd] pixel-shadow"
          >
            WHAT&apos;S AHEAD?
          </button>
        </div>
        <div className="gb-box mt-6 w-full p-4 text-left font-pixel text-[11px] leading-6 min-h-[5.5rem]" aria-live="polite">
          {msg ?? "Fork, schedule, lock and page your way to the top. Answer right to land your moves!"}
        </div>
      </section>
    </main>
  );
}
