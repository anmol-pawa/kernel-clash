/**
 * A small seeded random generator (mulberry32), so generated problems are
 * reproducible: the same seed always builds the same question.
 */
export interface Rng {
  /** a float in [0, 1) */
  next(): number;
  /** an integer in [min, max] (inclusive) */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** a shuffled copy */
  shuffle<T>(items: readonly T[]): T[];
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
