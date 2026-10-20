import { describe, expect, it } from "vitest";
import { GLYPH, LABEL_GAP, ganttLayout, ganttNames, rampFor, GANTT_RAMPS } from "@/components/lesson/Gantt";
import { fcfs, mlfq, roundRobin, srtf, type Job, type Slice } from "@/game/sim/scheduling";
import { rng } from "@/lib/rng";

const randomJobs = (seed: number): Job[] => {
  const r = rng(seed);
  return [...Array(r.int(2, 6)).keys()].map((i) => ({ name: `P${i + 1}`, arrival: r.int(0, 12), burst: r.int(1, 15) }));
};

describe("Gantt layout", () => {
  it("lays Silberschatz's FCFS chart proportionally across the width", () => {
    const { blocks, ticks } = ganttLayout(fcfs([{ name: "P1", arrival: 0, burst: 24 }, { name: "P2", arrival: 0, burst: 3 }, { name: "P3", arrival: 0, burst: 3 }]).gantt, 150);
    expect(blocks.map((b) => [b.name, b.x, b.w])).toEqual([["P1", 0, 120], ["P2", 120, 15], ["P3", 135, 15]]);
    expect(ticks.map((t) => [t.t, t.x, t.label])).toEqual([[0, 0, true], [24, 120, true], [27, 135, true], [30, 150, true]]);
    // end labels are nudged inside the chart
    expect(ticks.map((t) => t.lx)).toEqual([1.75, 120, 135, 146.5]);
  });

  it("is contiguous, fills the width and gives every block a unit, for any simulator's chart", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const js = randomJobs(seed);
      for (const g of [fcfs(js).gantt, srtf(js).gantt, roundRobin(js, 2).gantt, mlfq(js, [1, 2, Infinity]).gantt]) {
        for (const width of [40, 168]) {
          const { blocks, ticks } = ganttLayout(g, width);
          expect(blocks).toHaveLength(g.length);
          expect(blocks[0].x).toBe(0);
          blocks.forEach((b, i) => {
            expect(b.w).toBeGreaterThanOrEqual(1);
            expect(Number.isInteger(b.x) && Number.isInteger(b.w)).toBe(true);
            if (i > 0) expect(b.x).toBe(blocks[i - 1].x + blocks[i - 1].w);
            expect(b).toMatchObject(g[i]);
          });
          const last = blocks[blocks.length - 1];
          expect(last.x + last.w).toBe(width);
          // a tick on every boundary, the ends always labelled, labels never overlapping
          expect(ticks.map((t) => t.t)).toEqual([g[0].start, ...g.map((s) => s.end)]);
          expect(ticks[0].label && ticks[ticks.length - 1].label).toBe(true);
          const shown = ticks.filter((t) => t.label);
          for (let i = 1; i < shown.length; i++) {
            const half = (t: number) => (String(t).length * 3.5 * GLYPH) / 2;
            expect(shown[i].lx - half(shown[i].t) - (shown[i - 1].lx + half(shown[i - 1].t))).toBeGreaterThanOrEqual(LABEL_GAP);
            expect(shown[i].lx - half(shown[i].t)).toBeGreaterThanOrEqual(0);
            expect(shown[i].lx + half(shown[i].t)).toBeLessThanOrEqual(width);
          }
        }
      }
    }
  });

  it("an empty chart lays out to nothing", () => {
    expect(ganttLayout([], 100)).toEqual({ blocks: [], ticks: [] });
  });

  it("colours processes by natural name order and idle time grey", () => {
    const g: Slice[] = [
      { name: "P10", start: 0, end: 2 },
      { name: null, start: 2, end: 3 },
      { name: "P2", start: 3, end: 5 },
    ];
    expect(ganttNames(g)).toEqual(["P2", "P10"]);
    expect(rampFor("P2", ganttNames(g))).toBe(GANTT_RAMPS[0]);
    expect(rampFor("P10", ganttNames(g))).toBe(GANTT_RAMPS[1]);
    expect(GANTT_RAMPS).not.toContain(rampFor(null, ganttNames(g)));
  });
});
