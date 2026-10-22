import { describe, expect, it } from "vitest";
import { STORAGE_GENERATORS, tapNextTrack } from "@/content/storageGenerators";
import { answerText, correctionText, grade, kindOf, questionProblems, trackSetup, type TrackQ } from "@/game/engine/question";
import { DISK_EXAMPLE } from "@/game/sim/storage";

const mk = (over: Partial<TrackQ>): TrackQ => ({ kind: "track", id: "t", prompt: "p", explain: "e", policy: "sstf", cylinders: 200, head: 53, direction: "up", queue: [...DISK_EXAMPLE.queue], served: [], answer: 65, move: { name: "Seek Strike", type: "storage", power: 34 }, ...over });

/** The next request by plain rules over the waiting list, independent of scheduleDisk(). */
function nextRequest(q: TrackQ): number {
  const { at, pending } = trackSetup(q);
  const up = pending.filter((c) => c > at).sort((a, b) => a - b);
  const down = pending.filter((c) => c < at).sort((a, b) => b - a);
  switch (q.policy) {
    case "fcfs": return pending[0];
    case "sstf": return [...pending].sort((a, b) => Math.abs(a - at) - Math.abs(b - at))[0];
    case "scan": case "look": return q.direction === "up" ? (up[0] ?? down[0]) : (down[0] ?? up[0]);
    default: return q.direction === "up" ? (up[0] ?? Math.min(...pending)) : (down[0] ?? Math.max(...pending));
  }
}

describe("track (tap the next request)", () => {
  it("Silberschatz Figure 11.4: SSTF from 53 serves 65, then 67, then 37", () => {
    expect(grade(mk({}), { kind: "track", cylinder: 65 })).toBe(true);
    const second = mk({ served: [65], answer: 67 });
    expect(questionProblems(second)).toEqual([]);
    expect(trackSetup(second).at).toBe(65);
    expect(trackSetup(second).pending).toEqual([98, 183, 37, 122, 14, 124, 67]);
    expect(questionProblems(mk({ served: [65, 67], answer: 37 }))).toEqual([]);
    expect(grade(mk({}), { kind: "track", cylinder: 67 })).toBe(false);
    expect(grade(mk({}), { kind: "mcq", choice: 65 })).toBe(false);
  });

  it("rejects a wrong answer, a served prefix off the policy and bad queues", () => {
    expect(questionProblems(mk({ answer: 67 }))).toContain("answer isn't the policy's next request");
    expect(questionProblems(mk({ served: [98] }))).toContain("served requests don't follow the policy");
    expect(questionProblems(mk({ queue: [65, 67, 65, 90] }))).toContain("requests must be distinct cylinders on the disk, away from the head");
    expect(questionProblems(mk({ queue: [1, 2, 3] }))).toContain("track needs 4–8 requests");
  });

  it("SCAN and LOOK keep their direction; FCFS takes the oldest", () => {
    const up = mk({ policy: "look", served: [65, 67], answer: 98 });
    expect(questionProblems(up)).toEqual([]);
    expect(questionProblems(mk({ policy: "fcfs", served: [98], answer: 183 }))).toEqual([]);
    expect(questionProblems(mk({ policy: "look", direction: "down", served: [37, 14], answer: 65 }))).toEqual([]);
  });

  it("generated questions are well-formed, deterministic, graded right and match plain rules", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const q = tapNextTrack.make(seed) as TrackQ;
      expect(kindOf(q)).toBe("track");
      expect(questionProblems(q), `${seed}`).toEqual([]);
      expect(JSON.stringify(tapNextTrack.make(seed))).toBe(JSON.stringify(q));
      expect(q.answer).toBe(nextRequest(q));
      expect(grade(q, { kind: "track", cylinder: q.answer })).toBe(true);
      for (const c of trackSetup(q).pending.filter((c) => c !== q.answer)) expect(grade(q, { kind: "track", cylinder: c })).toBe(false);
      expect(answerText(q)).toBe(`cylinder ${q.answer}`);
      expect(correctionText(q)).toContain(String(q.answer));
      seen.add(q.policy);
    }
    expect(seen.size).toBe(6);
  });

  it("is in the storage generators", () => {
    expect(STORAGE_GENERATORS).toContain(tapNextTrack);
  });
});
