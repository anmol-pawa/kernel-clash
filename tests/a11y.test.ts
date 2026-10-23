import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("accessibility basics", () => {
  it("the battle screen has a heading and a labelled stage", () => {
    const src = read("components/battle/Battle.tsx");
    expect(src).toMatch(/<h1 className="sr-only">/);
    expect(src).toMatch(/role="img" aria-label=/);
  });

  it("controls show a keyboard focus ring and reduced motion is honoured", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
