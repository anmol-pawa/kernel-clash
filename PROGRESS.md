# kernel-clash progress log

Each hourly routine run appends an entry: date (IST), task, what changed, how it was verified, and what's next.

## 2026-10-12: planning
- Added CLAUDE.md (run protocol, art quality bar, rules) and ROADMAP.md. The hourly routine starts from the first unchecked task.

## 2026-10-12: 0.1 scaffold (run 1)
- Next.js 16 + TS + Tailwind 4 + Vitest + ESLint, configs copied from Query Clash (PGlite bits removed). Static export with `BASE_PATH=/kernel-clash`, `app/manifest.ts`, `PwaRegister`, `scripts/gen-sw.mjs` (offline precache, worker `#fragment` fix kept), `ci.yml` + `pages.yml`.
- Original pixel "KC" CPU-chip icon generated in-repo by `scripts/gen-icons.mjs` (192/512/apple/favicon).
- `lib/pixel.ts`: palette + character-grid toolkit (`PixelCanvas` with sphere-shaded dithered ellipses, stamps, mirror, auto-outline, run encoding). `components/ui/PixelSprite.tsx` renders sheets as crisp SVG and cycles idle frames.
- Title screen: banded pixel sky, seeded "kernel city" skyline, grass platform, and the original mascot Bytling (40×40, 4-frame idle with bob + blink), Press Start 2P / Pixelify Sans fonts, handheld cream text box.
- Verified: lint, typecheck, `npm test` (5 sprite tests), `build`, `build:pages` (44 files precached). Playwright on the static build at 1280×800 and iPhone 14: no console errors, no horizontal overflow, service worker registered; screenshots reviewed.
- Next: 0.2 port the Pixi battle engine and get a demo battle running.

## 2026-10-12: 0.2 battle engine + demo battle (run 2)
- Took over a stale routine lock (01:43 UTC, never released; main was green).
- Ported from Query Clash: `game/render/{tween,particles,textures,fx}.ts` (tween engine, pooled particles, camera shake / hit-stop / flash, pop text), `game/audio/synth.ts` (Web Audio sfx, `cast()` keyed by the new OS move types in `game/engine/types.ts`), and `game/render/pixiSprite.ts` (palette-grid sheets → nearest-neighbour Pixi textures, named animations, white-silhouette flash). `lib/pixel.ts` sheets gained optional `anims`/`fps` plus `gridToRGBA`.
- New pure reducer `game/engine/battle.ts` for question battles (intro → ask → resolve → victory/defeat; right answer lands the move, wrong answer lets the foe counter; streaks and fast-answer crits from `game/engine/damage.ts`).
- `game/render/stage.ts` CreatureStage: banded pixel sky, stars, kernel-city skyline, striped ground, grass platforms, screen-wipe + flash intro with slide-ins, lunge + typed pixel bit-orb projectile + 3-frame pixel impact spark, ring, shake, hit-stop, damage numbers, hurt flash/recoil, faint (sink + fade).
- New foe Glitchit (64×64 software-bug beetle: shaded shell with hex spots, 4-frame idle with leg steps, blink and an RGB scanline "glitch" tear, 3-frame attack). Pixel `BIT_ORB` and `IMPACT` effect sheets.
- `/battle` demo: Bytling vs Glitchit, five OS-basics/process MCQs (each keyed answer tested), handheld HP boxes (bars drop on impact), message box with explanations, tap-friendly answer menu. Title "PRESS START" now opens the battle.
- Verified: lint, typecheck, `npm test` (21 tests: reducer, damage, tween, demo answers, sprite validity), `build:pages` (66 files precached). Playwright on the static build at 1280×800 and iPhone 14: played a full battle (right, wrong, then rights → victory), no console errors, no horizontal overflow; screenshots reviewed.
- Not ported yet: `lib/save.ts` (nothing to save until XP/levels in 1.3) and Query Clash's glowy button kit (replaced by handheld `HpBox`/`MenuChoice` in `components/ui/kit.tsx`).
- Next: 0.3 pixel-sprite system (back sprites, hurt/faint/evolve frames per creature, a `/dev/sprites` viewer), then 0.4 the full GBA-style battle layout (the 4-option menu should go 2×2 on phones to give the stage more room).
