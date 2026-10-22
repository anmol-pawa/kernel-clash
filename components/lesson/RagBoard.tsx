"use client";
import { useState } from "react";
import { sfx } from "@/game/audio/synth";
import { findCycle, isCycleNodes, type Edge } from "@/game/sim/deadlock";
import type { CycleNode } from "@/game/engine/question";

interface BoardProps {
  nodes: readonly CycleNode[];
  edges: readonly Edge[];
  /** the nodes marked so far */
  marked: readonly string[];
  /** toggle a node; omitted when the board is locked */
  onToggle?: (id: string) => void;
  /** after answering: the cycle to light up in gold */
  hint?: readonly string[];
  tone?: "right" | "wrong";
}

const R = 6.5;

/** The lesson's graph: a four-node cycle P1 → R1 → P2 → R2 → P1, plus P3 waiting on R1 while holding R3 (not part of the cycle). */
export const RAG_PLAY = {
  nodes: [
    { id: "P1", x: 14, y: 14 },
    { id: "R1", x: 50, y: 14 },
    { id: "P2", x: 50, y: 46 },
    { id: "R2", x: 14, y: 46 },
    { id: "P3", x: 86, y: 14 },
    { id: "R3", x: 86, y: 46 },
  ],
  edges: [["P1", "R1"], ["R1", "P2"], ["P2", "R2"], ["R2", "P1"], ["P3", "R1"], ["R3", "P3"]],
} as const satisfies { nodes: readonly CycleNode[]; edges: readonly Edge[] };

/** A segment from node a to node b, trimmed to leave the node shapes visible. */
function trim(a: CycleNode, b: CycleNode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const gap = R + 1;
  return { x1: a.x + (dx / d) * gap, y1: a.y + (dy / d) * gap, x2: b.x - (dx / d) * (gap + 1.5), y2: b.y - (dy / d) * (gap + 1.5) };
}

/**
 * A resource-allocation graph with tappable nodes. Processes are circles,
 * resources are squares; red arrows are requests (P → R), green arrows are
 * assignments (R → P). Mark the nodes of the cycle.
 */
export function RagBoard({ nodes, edges, marked, onToggle, hint, tone }: BoardProps) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const lit = new Set(hint ?? []);
  const border = tone === "right" ? "#166534" : tone === "wrong" ? "#991b1b" : "#1a1430";
  return (
    <div className="flex flex-col gap-1.5" data-testid="rag-board">
      <svg viewBox="0 0 100 60" className="w-full rounded-[4px] border-[3px] bg-[#1b1446]" style={{ borderColor: border }} role="img" aria-label="Resource-allocation graph">
        <defs>
          <marker id="rag-req" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 6 3 0 6z" fill="#f87a8a" />
          </marker>
          <marker id="rag-asg" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 6 3 0 6z" fill="#7cc24f" />
          </marker>
        </defs>
        {edges.map(([a, b], i) => {
          const na = by.get(a);
          const nb = by.get(b);
          if (!na || !nb) return null;
          const t = trim(na, nb);
          const req = a[0] === "P";
          return <line key={i} {...t} stroke={req ? "#f87a8a" : "#7cc24f"} strokeWidth={lit.has(a) && lit.has(b) ? 1.6 : 1} markerEnd={`url(#${req ? "rag-req" : "rag-asg"})`} />;
        })}
        {nodes.map((n) => {
          const on = marked.includes(n.id);
          const glow = lit.has(n.id);
          const fill = glow ? "#ffe27a" : on ? "#5eead4" : n.id[0] === "P" ? "#a78bfa" : "#d9a441";
          return (
            <g key={n.id} data-testid={`rag-${n.id}`} data-state={on ? "marked" : "free"} onClick={onToggle ? () => onToggle(n.id) : undefined} style={{ cursor: onToggle ? "pointer" : "default" }}>
              {/* an invisible larger target for fingers */}
              <circle cx={n.x} cy={n.y} r={9} fill="transparent" />
              {n.id[0] === "P" ? <circle cx={n.x} cy={n.y} r={R} fill={fill} stroke="#1a1430" strokeWidth={1.2} /> : <rect x={n.x - R} y={n.y - R} width={R * 2} height={R * 2} fill={fill} stroke="#1a1430" strokeWidth={1.2} />}
              {on && <circle cx={n.x} cy={n.y} r={R + 2.2} fill="none" stroke="#ffe27a" strokeWidth={0.8} strokeDasharray="1.6 1.2" />}
              <text x={n.x} y={n.y + 1.8} textAnchor="middle" fontSize={5} fontFamily="monospace" fontWeight="bold" fill="#1a1430" pointerEvents="none">
                {n.id}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-center font-pixel text-[7px] leading-4 text-[#b9b0d8]">
        <span className="text-[#f87a8a]">RED P→R</span> WANTS · <span className="text-[#7cc24f]">GREEN R→P</span> HELD BY
      </p>
    </div>
  );
}

/** Free play for a lesson page: mark the cycle (or see why a pick isn't one). */
export function RagPlay({ nodes, edges }: { nodes: readonly CycleNode[]; edges: readonly Edge[] }) {
  const [marked, setMarked] = useState<string[]>([]);
  const solved = isCycleNodes(edges, marked);
  const cycle = findCycle(edges) ?? [];
  return (
    <div className="flex flex-col gap-2 bg-[#100e24] p-2" data-testid="rag-play">
      <p className="text-center font-pixel text-[8px] leading-4 text-[#b9b0d8]">TAP THE NODES THAT FORM THE CYCLE</p>
      <RagBoard nodes={nodes} edges={edges} marked={marked} tone={solved ? "right" : undefined} onToggle={(id) => (sfx.blip(), setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id])))} />
      <button type="button" disabled={!marked.length} onClick={() => (sfx.click(), setMarked([]))} className="gb-box min-h-11 font-pixel text-[10px] !text-[var(--box-ink)] disabled:opacity-50" data-testid="rag-reset">
        ↺ RESET
      </button>
      {solved && (
        <p className="text-center font-pixel text-[9px] leading-4 text-[#4ade80]" data-testid="rag-solved">
          ✓ CYCLE {cycle.join(" → ")}: every resource has one instance, so this is a deadlock.
        </p>
      )}
    </div>
  );
}
