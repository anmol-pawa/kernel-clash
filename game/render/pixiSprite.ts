import { Container, Sprite, Texture } from "pixi.js";
import { framesOf, gridToRGBA, type Grid, type SpriteSheet } from "@/lib/pixel";

/** Draw one frame onto a fresh canvas at 1 px per pixel. */
export function frameCanvas(sheet: SpriteSheet, grid: Grid, white = false): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = grid[0].length;
  c.height = grid.length;
  const data = gridToRGBA(sheet, grid, white);
  c.getContext("2d")!.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, c.width, c.height), 0, 0);
  return c;
}

const cache = new Map<string, Texture[]>();

/** Nearest-neighbour textures for one animation (cached per sheet). */
export function animTextures(sheet: SpriteSheet, anim: string, white = false): Texture[] {
  const key = `${sheet.name}/${anim}/${white ? "w" : "c"}`;
  let t = cache.get(key);
  if (!t) {
    t = framesOf(sheet, anim).map((f) => {
      const tex = Texture.from(frameCanvas(sheet, f, white));
      tex.source.scaleMode = "nearest";
      return tex;
    });
    cache.set(key, t);
  }
  return t;
}

/**
 * A pixel creature on the Pixi stage. `scale` is the integer pixel size; the
 * anchor sits at the bottom centre so `position` is where its feet touch the
 * platform. `flashAmount` overlays a white silhouette for hurt / evolve effects.
 */
export class PixiPixelSprite extends Container {
  readonly sprite: Sprite;
  private flashSprite: Sprite;
  private anim = "idle";
  private frame = 0;
  private acc = 0;
  private loop = true;
  private onDone?: () => void;

  constructor(
    readonly sheet: SpriteSheet,
    scale = 3,
    flipX = false,
  ) {
    super();
    this.sprite = new Sprite(animTextures(sheet, "idle")[0]);
    this.flashSprite = new Sprite(animTextures(sheet, "idle", true)[0]);
    for (const s of [this.sprite, this.flashSprite]) {
      s.anchor.set(0.5, 1);
      s.scale.set(flipX ? -scale : scale, scale);
      s.roundPixels = true;
    }
    this.flashSprite.alpha = 0;
    this.addChild(this.sprite, this.flashSprite);
  }

  get flashAmount() {
    return this.flashSprite.alpha;
  }
  /** 0 = normal colours, 1 = solid white silhouette. */
  set flashAmount(v: number) {
    this.flashSprite.alpha = v;
  }

  /** Switch animation. Non-looping animations resolve when they finish and return to idle. */
  play(anim: string, loop = anim === "idle"): Promise<void> {
    this.onDone?.();
    this.anim = anim;
    this.frame = 0;
    this.acc = 0;
    this.loop = loop;
    this.apply();
    return new Promise((res) => (this.onDone = loop ? undefined : res));
  }

  update(dt: number) {
    const n = framesOf(this.sheet, this.anim).length;
    const fps = this.sheet.fps?.[this.anim] ?? 4;
    this.acc += dt;
    while (this.acc >= 1 / fps) {
      this.acc -= 1 / fps;
      if (this.frame + 1 < n) this.frame++;
      else if (this.loop) this.frame = 0;
      else {
        const done = this.onDone;
        this.onDone = undefined;
        this.anim = "idle";
        this.frame = 0;
        this.loop = true;
        done?.();
      }
    }
    this.apply();
  }

  private apply() {
    this.sprite.texture = animTextures(this.sheet, this.anim)[this.frame];
    this.flashSprite.texture = animTextures(this.sheet, this.anim, true)[this.frame];
  }
}
