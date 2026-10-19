import type { GymFlow } from "@/game/world/progress";

type Chip = { key: string; label: string; done: boolean; current: boolean; locked?: boolean };

/** The gym's path as a row of step chips: LESSONS n/5 ▸ TRAINERS n/2 ▸ BOSS. */
export function GymFlowStrip({ flow, className = "" }: { flow: GymFlow; className?: string }) {
  const chips: Chip[] = [];
  if (flow.lessons.total > 0)
    chips.push({ key: "lessons", label: `LESSONS ${flow.lessons.done}/${flow.lessons.total}`, done: flow.lessons.done >= flow.lessons.total, current: flow.step === "lessons" });
  if (flow.trainers.total > 0)
    chips.push({ key: "trainers", label: `TRAINERS ${flow.trainers.won}/${flow.trainers.total}`, done: flow.trainers.won >= flow.trainers.total, current: flow.step === "trainers" });
  chips.push({ key: "boss", label: "BOSS", done: flow.state === "cleared", current: flow.step === "boss" || (flow.bossReady && flow.state === "open"), locked: !flow.bossReady });
  return (
    <ol className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Gym progress" data-testid="gym-flow" data-step={flow.step}>
      {chips.map((c, i) => (
        <li key={c.key} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="font-pixel text-[8px] text-[#8a7fb0]">▸</span>}
          <span
            data-testid={`flow-${c.key}`}
            data-done={c.done}
            className={`flex h-6 items-center gap-1 rounded-[3px] border-2 px-1.5 font-pixel text-[7px] leading-3 ${
              c.done
                ? "border-[#2f7a3a] bg-[#7ad66b] text-[#10301a]"
                : c.current
                  ? "border-[var(--box-edge)] bg-[#ffe27a] text-[var(--box-ink)]"
                  : "border-[#b9b0d8] bg-white text-[#6e6a8e]"
            }`}
          >
            {c.done ? "✓" : c.locked ? <LockIcon scale={1} /> : null}
            {c.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A 7×8 pixel padlock, drawn at `scale`×. */
export function LockIcon({ scale = 2 }: { scale?: number }) {
  return (
    <svg viewBox="0 0 7 8" width={7 * scale} height={8 * scale} shapeRendering="crispEdges" className="shrink-0" aria-hidden>
      <path d="M1 0h5v1h1v3H6V1H1v3H0V1h1z" fill="#1a1430" />
      <path d="M1 1h1v3H1zM5 1h1v3H5z" fill="#c8c6dc" />
      <rect x={0} y={3} width={7} height={5} fill="#1a1430" />
      <rect x={1} y={4} width={5} height={3} fill="#e8a52a" />
      <rect x={1} y={4} width={5} height={1} fill="#ffe27a" />
      <rect x={3} y={5} width={1} height={1} fill="#1a1430" />
    </svg>
  );
}
