import { describe, expect, it } from "vitest";
import { GYMS } from "@/content/gyms";
import { KERNELDEX, dexCounts, dexEntry, dexStatus, type DexSave } from "@/content/kerneldex";
import { EVOLVE_GYM, STARTERS } from "@/content/starters";
import { BOSSES, CREATURES } from "@/game/sprites/index";
import { DEFAULT_SAVE, parseSave } from "@/lib/save";

const fresh: DexSave = { starter: null, badges: [], evolved: [], seen: [], caught: [] };
const status = (id: string, s: Partial<DexSave>) => dexStatus(dexEntry(id)!, { ...fresh, ...s });

describe("Kerneldex entries", () => {
  it("lists every creature once, in the art's dex order, numbered from 1", () => {
    expect(KERNELDEX.map((e) => e.id)).toEqual(CREATURES.map((c) => c.id));
    expect(KERNELDEX.map((e) => e.no)).toEqual(KERNELDEX.map((_, i) => i + 1));
    expect(new Set(KERNELDEX.map((e) => e.id)).size).toBe(KERNELDEX.length);
  });

  it("names match the art and every entry has a blurb and a place", () => {
    for (const e of KERNELDEX) {
      expect(CREATURES.find((c) => c.id === e.id)!.name).toBe(e.name);
      expect(e.blurb.length).toBeGreaterThan(20);
      expect(e.where.length).toBeGreaterThan(5);
    }
  });

  it("starters and their evolutions share the starter's type; each boss has its gym's type and art", () => {
    for (const s of STARTERS) {
      expect(dexEntry(s.id)).toMatchObject({ kind: "starter", type: s.type, starter: s.id });
      expect(dexEntry(s.evolution.id)).toMatchObject({ kind: "evolved", type: s.type, starter: s.id });
      expect(dexEntry(s.evolution.id)!.no).toBe(dexEntry(s.id)!.no + 1);
    }
    for (const g of GYMS) {
      const e = KERNELDEX.find((x) => x.gym === g.id && x.kind === "boss")!;
      expect(e).toMatchObject({ kind: "boss", type: g.type, name: g.boss.name });
      expect(BOSSES[g.id].id).toBe(e.id);
    }
    expect(dexEntry("glitchit")!.kind).toBe("wild");
  });
});

describe("Kerneldex status", () => {
  it("a fresh save knows nothing", () => {
    for (const e of KERNELDEX) expect(dexStatus(e, fresh)).toBe("unknown");
    expect(dexCounts(fresh)).toEqual({ seen: 0, caught: 0, total: KERNELDEX.length });
  });

  it("choosing a partner catches it and sees the other two starters, but not their evolutions", () => {
    const s = { starter: "ramster" };
    expect(status("ramster", s)).toBe("caught");
    expect(status("bytling", s)).toBe("seen");
    expect(status("spinnail", s)).toBe("seen");
    expect(status("gigahoard", s)).toBe("unknown");
    expect(dexCounts({ ...fresh, ...s })).toMatchObject({ seen: 3, caught: 1 });
  });

  it("an evolved partner's new form is caught; other evolutions are not", () => {
    const s = { starter: "bytling", evolved: ["bytling"], badges: GYMS.slice(0, 3).map((g) => g.id) };
    expect(s.badges).toContain(EVOLVE_GYM);
    expect(status("threadrake", s)).toBe("caught");
    expect(status("gigahoard", s)).toBe("unknown");
  });

  it("a boss is seen once met and caught once its badge is earned (older saves catch up)", () => {
    expect(status("hydrafork", { seen: ["hydrafork"] })).toBe("seen");
    expect(status("hydrafork", { badges: ["basics", "processes"] })).toBe("caught");
    expect(status("trapjaw", { badges: ["basics"] })).toBe("caught");
    expect(status("chronogolem", { badges: ["basics"] })).toBe("unknown");
  });

  it("a gym trainer sits just before its boss and is caught with the gym's badge", () => {
    const e = dexEntry("syscallow")!;
    expect(e).toMatchObject({ kind: "trainer", gym: "basics", type: "io", name: "Syscallow" });
    expect(dexEntry("trapjaw")!.no).toBe(e.no + 1);
    expect(status("syscallow", {})).toBe("unknown");
    expect(status("syscallow", { seen: ["syscallow"] })).toBe("seen");
    expect(status("syscallow", { caught: ["syscallow"] })).toBe("caught");
    expect(status("syscallow", { badges: ["basics"] })).toBe("caught");
  });

  it("Forkupine guards the Fork Grove Gym just before Hydrafork", () => {
    const e = dexEntry("forkupine")!;
    expect(e).toMatchObject({ kind: "trainer", gym: "processes", type: "process", name: "Forkupine" });
    expect(dexEntry("hydrafork")!.no).toBe(e.no + 1);
    expect(dexEntry("trapjaw")!.no).toBe(e.no - 1);
    expect(status("forkupine", { badges: ["basics"] })).toBe("unknown");
    expect(status("forkupine", { seen: ["forkupine"] })).toBe("seen");
    expect(status("forkupine", { badges: ["basics", "processes"] })).toBe("caught");
  });

  it("Tortick guards the Clocktower Gym just before Chronogolem", () => {
    const e = dexEntry("tortick")!;
    expect(e).toMatchObject({ kind: "trainer", gym: "scheduling", type: "scheduler", name: "Tortick" });
    expect(dexEntry("chronogolem")!.no).toBe(e.no + 1);
    expect(dexEntry("hydrafork")!.no).toBe(e.no - 1);
    expect(status("tortick", { badges: ["basics", "processes"] })).toBe("unknown");
    expect(status("tortick", { seen: ["tortick"] })).toBe("seen");
    expect(status("tortick", { badges: ["basics", "processes", "scheduling"] })).toBe("caught");
  });

  it("Semafrog guards the Mutex Marsh Gym just before Mutexa", () => {
    const e = dexEntry("semafrog")!;
    expect(e).toMatchObject({ kind: "trainer", gym: "sync", type: "sync", name: "Semafrog" });
    expect(dexEntry("mutexa")!.no).toBe(e.no + 1);
    expect(dexEntry("chronogolem")!.no).toBe(e.no - 1);
    expect(status("semafrog", { badges: ["basics", "processes", "scheduling"] })).toBe("unknown");
    expect(status("semafrog", { seen: ["semafrog"] })).toBe("seen");
    expect(status("semafrog", { badges: ["basics", "processes", "scheduling", "sync"] })).toBe("caught");
  });

  it("Cyclowl guards the Gridlock Gym just before Deadlocrab", () => {
    const e = dexEntry("cyclowl")!;
    expect(e).toMatchObject({ kind: "trainer", gym: "deadlocks", type: "sync", name: "Cyclowl" });
    expect(dexEntry("deadlocrab")!.no).toBe(e.no + 1);
    expect(dexEntry("mutexa")!.no).toBe(e.no - 1);
    expect(status("cyclowl", { badges: ["basics", "processes", "scheduling", "sync"] })).toBe("unknown");
    expect(status("cyclowl", { badges: ["basics", "processes", "scheduling", "sync", "deadlocks"] })).toBe("caught");
  });

  it("the recorded caught list wins over seen", () => {
    expect(status("glitchit", { seen: ["glitchit"] })).toBe("seen");
    expect(status("glitchit", { seen: ["glitchit"], caught: ["glitchit"] })).toBe("caught");
  });
});

describe("Kerneldex save fields", () => {
  it("default to empty and keep only known, unique creature ids", () => {
    expect(DEFAULT_SAVE.seen).toEqual([]);
    expect(DEFAULT_SAVE.caught).toEqual([]);
    const s = parseSave(JSON.stringify({ seen: ["glitchit", "glitchit", "nope", 4, "trapjaw"], caught: ["glitchit", "notacreature"] }));
    expect(s.seen).toEqual(["glitchit", "trapjaw"]);
    expect(s.caught).toEqual(["glitchit"]);
    expect(parseSave(JSON.stringify({ seen: "glitchit" })).seen).toEqual([]);
    expect(parseSave(JSON.stringify({ badges: ["basics"] })).caught).toEqual([]);
  });
});
