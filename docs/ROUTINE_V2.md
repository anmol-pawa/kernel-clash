# Routine operating rules (v2)

Read by the scheduled builder routine every run. The repo's CLAUDE.md Run protocol stays the source of truth; these rules wrap it. Edit this file to tune the routine without touching the schedule.

## 0. Budget and mode (efficiency)
- Twice-daily unattended run. One coherent box per run, max ~45 min. Stop cleanly at the first sign of the usage limit; never leave a half-written box.
- Token discipline: read only the ROADMAP box, the cited doc sections, and files you will change. Use symbol-level navigation (Serena, if the MCP is attached) instead of whole-file reads. Never re-read a file you just wrote.
- Install once, verify in parallel: run lint, typecheck and unit tests together; run the slow suites (content verify, build:pages, screenshots) once at the end.
- Reuse before writing: search the repo, then the READ_ONLY_REFS, then registries. Port proven code rather than writing net-new.

## 1. Start of run (hygiene)
1. Attach repos, `npm ci` (and Python deps if a requirements file exists), take the routine lock or stop.
2. `git fetch --prune`; list unmerged remote branches OLDEST COMMIT FIRST (`git for-each-ref --sort=committerdate --format='%(refname:short) %(committerdate:iso)' refs/remotes/origin`, then `git branch -r --no-merged origin/main`); handle them strictly in that order so earlier work lands before later work and conflicts stay small. For each leftover branch: merge finished work into main; if its task ID or files already exist on main, tag `archive/<name>` and delete the branch. Never discard commits.
3. If main is red locally (lint, typecheck, tests, build), fixing it comes first. If Actions cannot start (billing or quota error), say so in the summary and rely on local verification.

## 2. Choose the box (coverage-driven expansion)
- Default: the first unchecked ROADMAP box.
- Coverage check (every run, 2 minutes): compare shipped content against the curriculum matrix (docs/CURRICULUM.md or docs/COVERAGE.md). If a topic that interviews or the learner outcome require has zero or thin coverage, and the next box is lower value, insert a box for that gap above it and do that instead. Record why.
- When the ROADMAP is nearly exhausted (fewer than 5 unchecked boxes): research current interview formats and topics (web search, stamp "as of month year"), draft the next tier of boxes into ROADMAP.md with acceptance criteria, then do the first one. Never idle on an empty roadmap.
- Split any box bigger than one run into run-sized sub-boxes first.

## 3. Build standards
- Correctness first: every piece of content is generated or verified by code (solvers, reference solutions, wrong implementations that must fail, seeded hidden tests). No invented numbers.
- Original wording only; never copy other sites' text; no third-party game IP names or assets.
- Features worth adding when a box allows: spaced repetition hooks, a "why you missed it" debrief, difficulty ladder and adaptive picks, shareable progress card, daily challenge, keyboard and touch parity, offline PWA, save export/import.
- Update the design doc in the same commit if a decision changes.

## 4. Graphics bar (best achievable in-browser)
- Art direction: one fixed palette per region (max 16 colours + 3 shade ramps), consistent light direction, 1px selective outlines. Creatures: 32x32 or 48x48 base, minimum 4-frame idle, 4-frame attack, hit and faint frames, evolution silhouette that visibly builds on the previous stage.
- Scenes: layered parallax backgrounds, animated tiles (water, flame, foliage sway), ambient particles, day or dusk tint per region, soft vignette, screen shake and hit-stop on impact, damage numbers with easing.
- UI: crisp pixel scaling (integer scale, `image-rendering: pixelated`), consistent 8px grid, readable type at phone size, focus rings, reduced-motion mode that disables shake, parallax and flashing.
- Generate art with the repo's deterministic sprite scripts so assets are reproducible and reviewable; never commit unreproducible binaries without the script.
- Performance budget: 60 fps on a mid phone, first load under ~3 s on 4G, no layout shift. Check with a Lighthouse or equivalent run; record the numbers, do not invent them.

## 5. Verify, commit, land
- Verify: lint, typecheck, unit tests, content verify, build, build:pages, then Playwright screenshots at desktop and iPhone 14 that you actually look at, plus a before/after of any changed art. Fix before committing; never commit a failing gate.
- Generated files (catalogs, problems.gen, COVERAGE.md): regenerate on Linux line endings (LF) and run the repo's own "is up to date" check before pushing.
- Commit with a specific conventional message, no attribution lines of any kind. Tick the ROADMAP box, append PROGRESS.md, release the lock, push.
- Land on main in the same run: fetch, checkout main, pull, `git merge --no-ff <your branch>`, re-verify if main moved, push. No PRs.
- If Actions can run: confirm CI and the Pages deploy are green; if red, fixing it is the next run's first job.

## 6. End of run
Summary: box done, commit SHA, verification commands and what the screenshots showed, coverage-gap findings, NEEDS OWNER APPROVAL items, next box.

## Standing branch policy

Stale branches are also merged automatically, oldest first, by the `branch-janitor` scheduled task (twice daily). Do not leave work on side branches: land it on the default branch in the same run. Branches younger than 3 hours are left alone by the janitor, so a run in progress is never disturbed.
