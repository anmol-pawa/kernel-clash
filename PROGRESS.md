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
