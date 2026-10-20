import type { Slice } from "@/game/sim/scheduling";

/**
 * A pixel Gantt chart: the scheduling simulator's chart drawn as shaded
 * blocks (one colour per process, hatched while idle) over a time axis.
 * `GanttRows` draws into a lesson diagram's SVG; `GanttChart` is a
 * standalone SVG for explanations. Both use `ganttLayout`, which is pure.
 */
const INK = "#1a1430";

type Ramp = readonly [dark: string, mid: string, light: string];
/** one ramp per process, in name order (P1, P2, …) */
export const GANTT_RAMPS: readonly Ramp[] = [
  ["#8a5a10", "#e0a030", "#ffe27a"],
  ["#0f5a55", "#178f84", "#5eead4"],
  ["#7a1a2a", "#c83a4a", "#f87a8a"],
  ["#2a1a58", "#4a2f8e", "#7a5ac8"],
  ["#1f5a2c", "#3a8a3a", "#7cc24f"],
  ["#1f3f6e", "#2f68a8", "#5a9ad8"],
];
const IDLE: Ramp = ["#2a2838", "#3a3850", "#5e5a78"];

export interface GanttBlock extends Slice {
  x: number;
  w: number;
}

export interface GanttTick {
  t: number;
  x: number;
  /** the label's centre: the tick, nudged inside the chart at the ends */
  lx: number;
  /** false where the label would overlap a neighbour's */
  label: boolean;
}

/** Glyph width of the pixel font, as a fraction of its size. */
export const GLYPH = 1;
/** Minimum space between two tick labels, in chart units. */
export const LABEL_GAP = 2;

/**
 * Lays a chart out across `width` units: block edges are whole units,
 * contiguous and proportional to time (rounded), and every block is at least
 * one unit wide. Ticks sit on every boundary; inner labels that would
 * collide with the previous shown label are dropped, but the first and last
 * are always shown (the last pushes out the one before it if they collide).
 */
export function ganttLayout(gantt: readonly Slice[], width: number, labelSize = 3.5): { blocks: GanttBlock[]; ticks: GanttTick[] } {
  if (!gantt.length) return { blocks: [], ticks: [] };
  const t0 = gantt[0].start;
  const span = gantt[gantt.length - 1].end - t0;
  const edge = (t: number) => Math.round(((t - t0) / span) * width);
  const blocks: GanttBlock[] = [];
  let x = 0;
  gantt.forEach((s, i) => {
    const room = width - (gantt.length - 1 - i);
    const end = i === gantt.length - 1 ? width : Math.min(room, Math.max(x + 1, edge(s.end)));
    blocks.push({ ...s, x, w: end - x });
    x = end;
  });
  const half = (t: number) => (String(t).length * labelSize * GLYPH) / 2;
  const tick = (t: number, x: number): GanttTick => ({ t, x, lx: Math.min(Math.max(x, half(t)), width - half(t)), label: true });
  const ticks: GanttTick[] = [tick(gantt[0].start, 0), ...blocks.map((b) => tick(b.end, b.x + b.w))];
  const clear = (a: GanttTick, b: GanttTick) => b.lx - half(b.t) - (a.lx + half(a.t)) >= LABEL_GAP;
  let shown = ticks[0];
  for (const tk of ticks.slice(1, -1)) {
    tk.label = clear(shown, tk);
    if (tk.label) shown = tk;
  }
  const last = ticks[ticks.length - 1];
  if (ticks.length > 2 && shown !== ticks[0] && !clear(shown, last)) shown.label = false;
  return { blocks, ticks };
}

/** Process names in the chart, sorted naturally (P2 before P10), for colours. */
export function ganttNames(gantt: readonly Slice[]): string[] {
  const names = [...new Set(gantt.flatMap((s) => (s.name ? [s.name] : [])))];
  return names.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export function rampFor(name: string | null, names: readonly string[]): Ramp {
  if (name === null) return IDLE;
  return GANTT_RAMPS[Math.max(0, names.indexOf(name)) % GANTT_RAMPS.length];
}

function Label({ x, y, size, fill, children }: { x: number; y: number; size: number; fill: string; children: string | number }) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor="middle" style={{ fontFamily: "var(--font-pixel)" }}>
      {children}
    </text>
  );
}

/**
 * The chart drawn at (x, y): a bar `h` tall and `width` wide, then a ruler
 * with a tick at every boundary and the times under it (`h` + 8 tall in all).
 */
export function GanttRows({ gantt, x, y, width, h = 12, axis = "#f8f4e6", names }: { gantt: readonly Slice[]; x: number; y: number; width: number; h?: number; axis?: string; names?: readonly string[] }) {
  const size = 3.5;
  const { blocks, ticks } = ganttLayout(gantt, width, size);
  const ns = names ?? ganttNames(gantt);
  return (
    <g transform={`translate(${x} ${y})`} data-testid="gantt">
      <rect x={-1} y={-1} width={width + 2} height={h + 2} fill={INK} />
      {blocks.map((b, i) => {
        const r = rampFor(b.name, ns);
        const fits = b.name !== null && b.w >= b.name.length * size * GLYPH + 2;
        return (
          <g key={i} data-name={b.name ?? "idle"} data-start={b.start} data-end={b.end}>
            <rect x={b.x} y={0} width={b.w} height={h} fill={r[1]} />
            <rect x={b.x} y={0} width={b.w} height={1} fill={r[2]} />
            <rect x={b.x} y={h - 1} width={b.w} height={1} fill={r[0]} />
            {b.name === null &&
              Array.from({ length: Math.floor((b.w + h) / 3) }, (_, k) => {
                // a diagonal hatch, clipped to the block by staying inside it
                const cx = b.x + k * 3 - h + 1;
                return Array.from({ length: h - 2 }, (_, d) => {
                  const px = cx + d;
                  return px >= b.x && px < b.x + b.w ? <rect key={`${k}-${d}`} x={px} y={h - 2 - d} width={1} height={1} fill={r[2]} /> : null;
                });
              })}
            {i > 0 && <rect x={b.x} y={0} width={1} height={h} fill={INK} />}
            {fits && (
              <Label x={b.x + b.w / 2} y={h / 2 + size / 2} size={size} fill={INK}>
                {b.name!}
              </Label>
            )}
          </g>
        );
      })}
      {ticks.map((tk, i) => (
        <g key={i}>
          <rect x={Math.min(tk.x, width - 1)} y={h + 1} width={1} height={2} fill={axis} />
          {tk.label && (
            <Label x={tk.lx} y={h + 7} size={size} fill={axis}>
              {tk.t}
            </Label>
          )}
        </g>
      ))}
    </g>
  );
}

/** A standalone Gantt chart (with a key for blocks too narrow to name). */
export function GanttChart({ gantt, className = "", title = "Gantt chart" }: { gantt: readonly Slice[]; className?: string; title?: string }) {
  const W = 180;
  const names = ganttNames(gantt);
  const { blocks } = ganttLayout(gantt, W - 8);
  const unnamed = names.filter((n) => blocks.every((b) => b.name !== n || b.w < n.length * 3.5 * GLYPH + 2));
  const H = 24 + (unnamed.length ? 8 : 0);
  return (
    <svg role="img" aria-label={`${title}: ${gantt.map((s) => `${s.name ?? "idle"} ${s.start} to ${s.end}`).join(", ")}`} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" className={`block h-auto w-full ${className}`} data-testid="gantt-chart">
      <rect x={0} y={0} width={W} height={H} fill="#2a2440" />
      <GanttRows gantt={gantt} x={4} y={4} width={W - 8} names={names} />
      {unnamed.map((n, i) => {
        const r = rampFor(n, names);
        const kx = 4 + i * 26;
        return (
          <g key={n}>
            <rect x={kx} y={H - 7} width={6} height={5} fill={INK} />
            <rect x={kx + 1} y={H - 6} width={4} height={3} fill={r[1]} />
            <text x={kx + 8} y={H - 2.5} fontSize={3.5} fill="#f8f4e6" style={{ fontFamily: "var(--font-pixel)" }}>
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
