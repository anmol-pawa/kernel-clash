"use client";
import { useEffect, useRef, useState } from "react";

/** Characters revealed after `ms` at `cps` characters per second. */
export const typedLength = (text: string, ms: number, cps: number) => Math.max(0, Math.min(text.length, Math.floor((ms / 1000) * cps)));

/**
 * Types `text` out like a handheld message box. Returns the visible slice,
 * whether it's finished, and `skip()` to reveal the rest at once (a tap).
 * `instant` (reduced motion) shows the whole text immediately.
 */
export function useTypewriter(text: string, { cps = 45, instant = false, onTick }: { cps?: number; instant?: boolean; onTick?: () => void } = {}) {
  const [state, setState] = useState({ text, n: instant ? text.length : 0 });
  const tick = useRef(onTick);
  const skipped = useRef(false);
  useEffect(() => {
    tick.current = onTick;
  });
  useEffect(() => {
    skipped.current = false;
    let raf = 0;
    const t0 = performance.now();
    let last = -1;
    const step = (now: number) => {
      const n = skipped.current || instant ? text.length : typedLength(text, now - t0, cps);
      if (n !== last) {
        if (n > last && last >= 0 && n % 3 === 0 && text[n - 1] !== " ") tick.current?.();
        last = n;
        setState({ text, n });
      }
      if (n < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, cps, instant]);
  // a new text resets to empty until its first frame
  const n = state.text === text ? state.n : instant ? text.length : 0;
  return {
    shown: text.slice(0, n),
    done: n >= text.length,
    skip: () => {
      skipped.current = true;
    },
  };
}
