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

## 2026-10-12: 0.3 pixel-sprite system (run 3)
- `lib/creature.ts`: `CreatureArt` (front + back sheets, `boss` flag) and `creatureProblems()`, an art-bar checker: ≥64×64 (96 for bosses), 2–4 distinct idle frames, `attack` + `hurt` animations, ≤24 colours, all frames the same size and in-palette, a filled silhouette, outlined edges, matching front/back palettes.
- Bytling redrawn as a 64×64 battle creature: front (gem, antenna pins, stubby arms, circuit traces, blush) and a new back sprite (heat-sink vent, status LED, flank traces). Idle 4f with bob + blink, attack 3f (wind-up squash → charged gem/antennae with open mouth), hurt 2f (squeezed eyes, wince).
- Glitchit gained a back sprite (shell-from-behind with tail tip, wing cases that flare open to attack) and a 2-frame hurt (X eyes + RGB glitch tears).
- `game/sprites/index.ts` registry (`CREATURES`, `EFFECTS`, `SCENERY`). The battle stage now takes `CreatureArt`: the player shows its back sprite, the foe its front, and hits play the `hurt` pose on top of the white flash + recoil.
- `/dev/sprites` viewer: every creature front + back, every animation playing, palette swatches, a live art-bar verdict, 1×/2×/3× zoom, white-silhouette toggle (evolve preview), 4 backdrop colours, effects + scenery.
- `PixelSprite` can play any named animation and draw the silhouette.
- Verified: lint, typecheck, `npm test` (28 tests, incl. the art-bar check per creature and negative cases for the checker), `build:pages` (73 files precached). Playwright on the static build at 1280×800 and iPhone 14 for title, `/dev/sprites` and the battle (took a hit): no console errors, no horizontal overflow; screenshots reviewed.
- Next: 0.4 GBA-style battle screen (the 4 answers go 2×2 on phones to give the stage room; typed-out message box; XP bar). The evolve white-silhouette morph is a stage effect to add with evolution in 1.3.

## 2026-10-12: 0.4 GBA-style battle screen (run 4)
- Handheld status boxes (`components/ui/kit.tsx`): foe box top-left (name, Lv, HP gauge), player box bottom-right (HP gauge, HP numbers, blue XP gauge), pixel gauges with highlight rows and green/yellow/red HP, and a pixel "tail" pointing at each box's creature.
- Typed-out message box (`lib/typewriter.ts` `useTypewriter`, text-tick blip sfx, instant under reduced motion) with a red-trimmed handheld frame. Tapping skips the typing; after each explanation a blinking ▼ waits for a tap, so explanations can be read at the player's pace.
- Move menu: a move-info strip (move name, type badge, PWR) over a 2×2 grid of A–D answer buttons (≥56px tall) on every screen size; on desktop the message box and menu sit side by side. Right/wrong answers show ✓/✗ tags.
- XP and levels (`game/engine/xp.ts`): cubic curve (Lv L = L³ XP), `xpYield` per foe level (bosses 1.5×). Winning the demo awards 36 XP and levels Bytling 5 → 6 with a level-up jingle.
- Verified: lint, typecheck, `npm test` (34 tests, new xp + typewriter tests), `build:pages` (74 files precached). Playwright on the static build at 1280×800 and iPhone 14: full battle (right, wrong, rights → victory → XP → level up), no console errors, no horizontal overflow; screenshots reviewed (fixed a bug where both status boxes stacked top-left).
- Next: 1.1 region map with 9 gyms and boss creatures (likely split: map screen first, then bosses one at a time).

## 2026-10-12: 1.1a region map, gyms and badges (run 5)
- Split roadmap 1.1 into 1.1a–1.1f (map first, then bosses two or three per run, then gym boss battles that award badges).
- `content/gyms.ts`: the nine gyms in curriculum order (chapter, move type, topics, boss name + blurb, badge, roof/badge colour ramp).
- `game/world/progress.ts`: gyms clear in order (`gymState` cleared/open/locked, `nextGym`, `earnBadge` idempotent and map-ordered). `lib/save.ts` ported from Query Clash (localStorage, try/catch, `useSyncExternalStore`) with `badges` + `lastGym` and a defensive `parseSave`.
- `game/sprites/overworld.ts`: a seeded 128×216 pixel region map built in code: value-noise grass with tufts and flowers, snow-capped shaded peaks in the north with a brick summit plateau for the Kernel Summit, a winding river with sandy banks and ripples, a trunk road with spurs to every gym door and a plank bridge, outlined canopy trees and pines (depth-sorted, with ground shadows), rocks, and nine outlined gym buildings (shaded roofs in each gym's colours, emblem, brick walls, door, glowing windows). Also 14×14 shaded badges (a distinct shape per gym) and a 4-frame mini-Bytling map marker. All are in `/dev/sprites` under OVERWORLD.
- `/map` (`components/world/RegionMap.tsx`): the map drawn to a canvas and scaled with nearest-neighbour, tappable gyms with number plates (lock icon when locked, badge when cleared), the bobbing marker at the next gym, a badge case (unearned badges as silhouettes), and a gym card (fixed bottom sheet on phones, side panel on desktop) with boss, topics, reward and an action: locked gyms say which badge to earn first; open gyms go to the practice battle until boss battles land in 1.1f. PRESS START now opens the map; the title also has QUICK BATTLE.
- Verified: lint, typecheck, `npm test` (63 tests, new `tests/world.test.ts`: gym data, unlock order, badge earning, save parsing, map/building bounds and no overlaps, badges), `build:pages` (80 files precached). Playwright on the static build at 1280×800 and iPhone 14: title → map, select locked/open gyms, seeded a 3-badge save (states cleared×3, open, locked×5, badge count 3/9), gym card → battle, `/dev/sprites`; no console errors, no horizontal overflow; screenshots reviewed (moved the road to a central trunk after the first render ran roads under buildings).
- Next: 1.1b boss creatures Trapjaw and Hydrafork (96×96, front + back, idle/attack/hurt).
