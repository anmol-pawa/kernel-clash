"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { sfx } from "@/game/audio/synth";
import {
  DEFAULT_FS, LAYOUTS, LAYOUT_LABEL, extentsOf, gradeFsProblem, makeFile, makeFsProblem, openAndRead, pathParts,
  type FsConfig, type ReadKind,
} from "@/game/sim/fsLab";

const KIND_COLOR: Record<ReadKind, string> = {
  inode: "#5b9fe3", dir: "#9b7fe0", indirect: "#e8a24a", fat: "#e0707f", "extent-tree": "#4cbf8a", data: "#e6efc8",
};

function Sandbox() {
  const [path, setPath] = useState("/usr/ast/mbox");
  const [blockBytes, setBlockBytes] = useState(4096);
  const [blocks, setBlocks] = useState(40);
  const [fragments, setFragments] = useState(3);
  const [offsetText, setOffsetText] = useState("100000");
  const [fatCached, setFatCached] = useState(false);
  const [layout, setLayout] = useState<(typeof LAYOUTS)[number]>("inode");
  const cfg: FsConfig = { ...DEFAULT_FS, blockBytes, fatCached };
  const file = useMemo(() => makeFile(blocks, fragments, 7, { ...DEFAULT_FS, blockBytes }), [blocks, fragments, blockBytes]);
  const offset = Math.trunc(Number(offsetText));
  const res = openAndRead(layout, path, file, Number.isFinite(offset) ? offset : -1, cfg);
  const num = (set: (n: number) => void, lo: number, hi: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(Math.min(hi, Math.max(lo, Math.trunc(Number(e.target.value)) || lo)));
  return (
    <>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Setup">
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Layout">
          {LAYOUTS.map((l) => (
            <button key={l} role="radio" aria-checked={layout === l} data-testid={`fl-${l}`} onClick={() => setLayout(l)} className={`gb-box min-h-11 px-0.5 font-pixel text-[8px] leading-3 ${layout === l ? "bg-[#ffe27a]!" : ""}`}>
              {LAYOUT_LABEL[l].toUpperCase()}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
          PATH
          <input aria-label="path" data-testid="fs-path" value={path} onChange={(e) => setPath(e.target.value)} className="min-h-11 min-w-0 flex-1 border-2 border-[#1a1430] bg-white px-2 font-mono text-base" />
        </label>
        <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
          BYTE OFFSET
          <input aria-label="byte offset" data-testid="fs-offset" inputMode="numeric" value={offsetText} onChange={(e) => setOffsetText(e.target.value.replace(/[^0-9-]/g, ""))} className="min-h-11 w-32 border-2 border-[#1a1430] bg-white px-2 text-center font-mono text-base" />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 font-pixel text-[7px]">
            FILE BLOCKS
            <input aria-label="file blocks" type="number" inputMode="numeric" data-testid="fs-blocks" min={1} max={3000} value={blocks} onChange={num(setBlocks, 1, 3000)} className="min-h-11 w-full border-2 border-[#1a1430] bg-white px-1 text-center text-base" />
          </label>
          <label className="flex flex-col gap-1 font-pixel text-[7px]">
            FRAGMENTS
            <input aria-label="fragments" type="number" inputMode="numeric" data-testid="fs-frags" min={1} max={20} value={fragments} onChange={num(setFragments, 1, 20)} className="min-h-11 w-full border-2 border-[#1a1430] bg-white px-1 text-center text-base" />
          </label>
          <div className="flex flex-col gap-1 font-pixel text-[7px]">
            BLOCK SIZE
            <button data-testid="fs-bs" onClick={() => setBlockBytes(blockBytes === 4096 ? 1024 : 4096)} className="gb-box min-h-11 text-[9px]">{blockBytes} B</button>
          </div>
        </div>
        <button data-testid="fs-fatcache" aria-pressed={fatCached} onClick={() => setFatCached(!fatCached)} className={`gb-box min-h-11 font-pixel text-[8px] ${fatCached ? "bg-[#ffe27a]!" : ""}`}>
          FAT TABLE CACHED IN RAM: {fatCached ? "YES" : "NO"}
        </button>
        <p className="text-[12px] text-[#5a5078]">
          Cold caches; each directory fits in one block; file is {file.sizeBytes} bytes in {extentsOf(file.blocks).length} extent(s). Path has {pathParts(path).length} component(s).
        </p>
      </section>
      <section className="gb-box flex flex-col gap-2 p-3" aria-label="Disk reads">
        <p className="font-pixel text-[9px] leading-4" data-testid="fs-total">
          {res.total} DISK READ{res.total === 1 ? "" : "S"}
        </p>
        {res.ok ? null : <p className="text-[13px] text-[#a02040]" data-testid="fs-why">Cannot read: {res.why}. Only the path walk is shown.</p>}
        <ol className="flex flex-col gap-1" data-testid="fs-reads">
          {res.reads.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px]">
              <span className="w-6 text-right font-pixel text-[8px] text-[#5a5078]">{i + 1}</span>
              <i className="inline-block h-3 w-3 shrink-0 border border-[#1a1430]" style={{ background: KIND_COLOR[r.kind] }} />
              <span className="min-w-0 break-words">{r.label}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="gb-box overflow-x-auto p-3" aria-label="Compare layouts">
        <p className="font-pixel text-[8px]">SAME FILE AND OFFSET, EVERY LAYOUT</p>
        <table className="mt-1 w-full text-left text-[13px]" data-testid="fs-compare">
          <thead><tr className="text-[#5a5078]"><th>layout</th><th>total reads</th></tr></thead>
          <tbody>
            {LAYOUTS.map((l) => (
              <tr key={l} className={l === layout ? "font-bold" : ""}>
                <td>{LAYOUT_LABEL[l]}</td>
                <td>{openAndRead(l, path, file, Number.isFinite(offset) ? offset : -1, cfg).total}{openAndRead(l, path, file, Number.isFinite(offset) ? offset : -1, cfg).ok ? "" : " (no data read)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Trace() {
  const [seed, setSeed] = useState(1);
  const p = useMemo(() => makeFsProblem(seed), [seed]);
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const [score, setScore] = useState({ right: 0, tries: 0 });
  const n = Number(text);
  const right = shown && text !== "" && gradeFsProblem(p, n);
  const ext = extentsOf(p.file.blocks);
  const next = () => { setSeed((s) => s + 1); setText(""); setShown(false); };
  const check = () => {
    if (text === "") return;
    setShown(true);
    setScore((x) => ({ right: x.right + (gradeFsProblem(p, n) ? 1 : 0), tries: x.tries + 1 }));
    sfx.click();
  };
  const layoutText =
    p.layout === "inode"
      ? `Unix inode with 12 direct pointers and single, double and triple indirect blocks, ${p.cfg.pointerBytes}-byte pointers.`
      : p.layout === "fat"
        ? `FAT chain: the next-cluster table is on disk (${p.cfg.pointerBytes}-byte entries, ${p.cfg.blockBytes / p.cfg.pointerBytes} per block), nothing cached. The file's clusters in order: ${p.file.blocks.slice(0, 40).join(", ")}${p.file.blocks.length > 40 ? ", …" : ""}.`
        : `Extents: up to 4 extents fit in the inode, more need one extent-tree block. The file has ${ext.length} extent(s).`;
  return (
    <section className="gb-box flex flex-col gap-2 p-3" aria-label="Count the disk reads">
      <p className="font-pixel text-[9px] leading-4">COUNT #{seed} · SCORE {score.right}/{score.tries}</p>
      <p className="text-[14px] leading-snug">
        {LAYOUT_LABEL[p.layout]} layout, {p.cfg.blockBytes}-byte blocks, cold caches, each directory is one block. {layoutText}
      </p>
      <p className="text-[15px]" data-testid="fs-q">
        Open <b className="break-all font-mono">{p.path}</b> ({p.file.sizeBytes} bytes) and read the byte at offset <b className="font-mono">{p.offset}</b>. How many disk reads in total (path walk included)?
      </p>
      <label className="flex items-center justify-between gap-2 font-pixel text-[8px]">
        TOTAL READS
        <input aria-label="total disk reads" data-testid="fs-answer" inputMode="numeric" disabled={shown} value={text} onChange={(e) => setText(e.target.value.replace(/\D/g, ""))} className="min-h-11 w-24 border-2 border-[#1a1430] bg-white px-2 text-center font-mono text-base" />
      </label>
      {shown ? (
        <p className={`font-pixel text-[9px] leading-4 ${right ? "text-[#2f7a2a]" : "text-[#a02040]"}`} data-testid="fs-result">
          {right ? "CORRECT" : `NOT QUITE: ${p.answer} READS`}
        </p>
      ) : null}
      {shown ? (
        <ol className="flex flex-col gap-1">
          {openAndRead(p.layout, p.path, p.file, p.offset, p.cfg).reads.map((r, i) => (
            <li key={i} className="text-[13px]">{i + 1}. {r.label}</li>
          ))}
        </ol>
      ) : null}
      <button data-testid="fs-go" disabled={!shown && text === ""} onClick={shown ? next : check} className="gb-box min-h-11 font-pixel text-[9px] disabled:opacity-40">
        {shown ? "NEXT" : "CHECK"}
      </button>
    </section>
  );
}

/** The file-system lab: open a path and read an offset on inode, FAT and extent layouts, counting disk reads. */
export function FsLab() {
  const [mode, setMode] = useState<"sandbox" | "count">("sandbox");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2">
        <Link href="/map" className="flex min-h-11 items-center font-pixel text-[10px] text-[#ffd0dd] pixel-shadow">◀ MAP</Link>
        <h1 className="font-pixel text-sm text-[#ffe27a] pixel-shadow">FILE-SYSTEM LAB</h1>
        <span className="w-12" />
      </header>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["sandbox", "count"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} data-testid={`ftab-${m}`} onClick={() => setMode(m)} className={`gb-box min-h-11 font-pixel text-[8px] ${mode === m ? "bg-[#ffe27a]!" : ""}`}>
            {m === "sandbox" ? "SANDBOX" : "COUNT THE READS"}
          </button>
        ))}
      </div>
      {mode === "sandbox" ? <Sandbox /> : <Trace />}
    </main>
  );
}
