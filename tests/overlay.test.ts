import { describe, expect, it } from "vitest";
import { Overlay, WHITEOUT, type Layer } from "@/game/sim/containers";

const layer = (files: Record<string, [string, number] | "x">): Layer =>
  new Map(Object.entries(files).map(([k, v]) => [k, v === "x" ? WHITEOUT : { data: v[0], sizeMB: v[1] }]));

describe("overlayfs", () => {
  const base = layer({ "/bin/sh": ["sh v1", 1], "/db/data": ["rows v1", 100], "/etc/motd": ["hi", 0] });
  const app = layer({ "/app/run": ["run", 5], "/etc/motd": ["hello", 0] });

  it("reads the topmost layer that has the name", () => {
    const o = new Overlay([app, base]);
    expect(o.read("/etc/motd")?.data).toBe("hello");
    expect(o.read("/bin/sh")?.data).toBe("sh v1");
    expect(o.read("/nope")).toBeUndefined();
  });

  it("copies the whole file up on the first write, however small the change (Docker storage docs)", () => {
    const o = new Overlay([app, base]);
    o.write("/db/data", "rows v2");
    expect(o.copiedUpMB).toBe(100);
    expect(o.upperMB).toBe(100);
    expect(o.read("/db/data")?.data).toBe("rows v2");
    expect(base.get("/db/data")).toMatchObject({ data: "rows v1" });
    o.write("/db/data", "rows v3");
    expect(o.copiedUpMB).toBe(100); // already in the upper layer: no second copy
  });

  it("creating a new file copies nothing", () => {
    const o = new Overlay([base]);
    o.write("/tmp/new", "x", 2);
    expect(o.copiedUpMB).toBe(0);
    expect(o.upperMB).toBe(2);
  });

  it("deleting a lower file leaves a whiteout; the lower layer keeps its bytes", () => {
    const o = new Overlay([base]);
    o.remove("/db/data");
    expect(o.upper.get("/db/data")).toBe(WHITEOUT);
    expect(o.read("/db/data")).toBeUndefined();
    expect(base.get("/db/data")).not.toBe(WHITEOUT);
    expect(o.upperMB).toBe(0); // the image is no smaller, the container layer no bigger
  });

  it("deleting an upper-only file leaves no whiteout, and a whiteout in a layer hides the layers below it", () => {
    const o = new Overlay([base]);
    o.write("/tmp/a", "x", 1);
    o.remove("/tmp/a");
    expect(o.upper.has("/tmp/a")).toBe(false);
    const hidden = new Overlay([layer({ "/bin/sh": "x" }), base]);
    expect(hidden.read("/bin/sh")).toBeUndefined();
  });

  it("writing a whiteout-hidden name creates a fresh file without copy-up", () => {
    const o = new Overlay([base]);
    o.remove("/db/data");
    o.write("/db/data", "new", 1);
    expect(o.copiedUpMB).toBe(0);
    expect(o.read("/db/data")?.data).toBe("new");
  });
});
