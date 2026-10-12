/**
 * CreatureStage: the PixiJS battle arena. Owns the renderer, an illustrated
 * pixel background, the two creatures on their platforms, the effects layers
 * and the camera, and exposes a small promise-based API the React battle
 * screen drives:
 *
 *   await stage.intro()
 *   await stage.attack("player", "process", 34, false)
 *   await stage.faint("foe")
 */
import { Application, Container, Graphics } from "pixi.js";
import type { CreatureArt } from "@/lib/creature";
import { TYPE_COLOR, type MoveType } from "@/game/engine/types";
import { BIT_ORB, IMPACT } from "@/game/sprites/effects";
import { PLATFORM, SKYLINE } from "@/game/sprites/scenery";
import { Camera, FxContext, popText, ring } from "./fx";
import { Particles } from "./particles";
import { PixiPixelSprite } from "./pixiSprite";
import { Tweener, ease } from "./tween";

/** Logical stage size; layout() scales it to fit the host. */
export const W = 960;
export const H = 540;
const PX = 3; // creature pixel size

export type Who = "player" | "foe";

const HOME: Record<Who, { x: number; y: number }> = {
  player: { x: 250, y: 470 },
  foe: { x: 700, y: 270 },
};

const SKY = [0x1b1446, 0x251a5c, 0x33226e, 0x4a2c7e, 0x6b3a86, 0x94508a, 0xc46f86];

export interface StageOptions {
  player: CreatureArt;
  foe: CreatureArt;
  reducedMotion: boolean;
  font: string;
}

export class CreatureStage {
  private app = new Application();
  private fit = new Container();
  private camera = new Container();
  private bg = new Container();
  private creatures = new Container();
  private fxLayer = new Container();
  private top = new Container();
  private flashRect = new Graphics();
  private wipe = new Graphics();
  private tw = new Tweener();
  private fx = new Particles();
  private cam!: Camera;
  private fxc!: FxContext;
  private mon!: Record<Who, PixiPixelSprite>;
  private anims: PixiPixelSprite[] = [];
  private t = 0;
  private destroyed = false;

  private constructor(private opts: StageOptions) {}

  static async create(host: HTMLElement, opts: StageOptions): Promise<CreatureStage> {
    const s = new CreatureStage(opts);
    await s.app.init({ resizeTo: host, background: 0x100e24, antialias: false, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: "webgl" });
    host.appendChild(s.app.canvas);
    Object.assign(s.app.canvas.style, { width: "100%", height: "100%", display: "block", imageRendering: "pixelated" });
    s.build();
    s.app.renderer.on("resize", () => s.layout());
    s.layout();
    s.app.ticker.add((tk) => s.frame(Math.min(0.05, tk.deltaMS / 1000)));
    return s;
  }

  private build() {
    this.fx.scale = this.opts.reducedMotion ? 0.35 : 1;
    // banded pixel sky, wider than the stage so wide screens never letterbox
    const sky = new Graphics();
    const band = Math.ceil(432 / SKY.length);
    SKY.forEach((c, i) => sky.rect(-600, -200 + i * band - (i ? 0 : 400), W + 1200, band + (i ? 0 : 400)).fill({ color: c }));
    this.bg.addChild(sky);
    // stars
    const stars = new Graphics();
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 60; i++) stars.rect(-600 + rnd() * (W + 1200), -150 + rnd() * 220, 3, 3).fill({ color: 0xffffff, alpha: 0.4 + rnd() * 0.5 });
    this.bg.addChild(stars);
    // kernel city skyline sitting on the horizon
    for (let i = -2; i < 4; i++) {
      const city = new PixiPixelSprite(SKYLINE, 3);
      city.position.set(i * 480 + 240, 232);
      this.bg.addChild(city);
    }
    // ground: two tones with dithered stripes for depth
    const ground = new Graphics();
    ground.rect(-600, 232, W + 1200, H + 400).fill({ color: 0x2a5a3a });
    for (let y = 232, i = 0; y < H + 200; y += 6 + i * 2, i++) ground.rect(-600, y, W + 1200, 3).fill({ color: 0x336b44, alpha: 0.8 });
    ground.rect(-600, 232, W + 1200, 6).fill({ color: 0x1d3f2a });
    this.bg.addChild(ground);
    // platforms under each creature
    for (const who of ["player", "foe"] as Who[]) {
      const p = new PixiPixelSprite(PLATFORM, who === "player" ? 4 : 3);
      p.position.set(HOME[who].x, HOME[who].y + (who === "player" ? 40 : 30));
      this.bg.addChild(p);
    }

    this.mon = {
      // the player's creature is seen from behind, the foe from the front
      player: new PixiPixelSprite(this.opts.player.back, PX + 1),
      // bosses are drawn on a 96×96 grid, so they render at 2× to share the 192px band
      foe: new PixiPixelSprite(this.opts.foe.front, this.opts.foe.boss ? 2 : PX),
    };
    for (const who of ["player", "foe"] as Who[]) {
      this.mon[who].position.set(HOME[who].x, HOME[who].y);
      this.creatures.addChild(this.mon[who]);
    }
    this.anims.push(this.mon.player, this.mon.foe);

    this.fxLayer.blendMode = "add";
    this.camera.addChild(this.bg, this.creatures, this.fx.container, this.fxLayer, this.top);
    this.fit.addChild(this.camera);
    this.flashRect.rect(0, 0, 16, 16).fill({ color: 0xffffff });
    this.flashRect.alpha = 0;
    this.wipe.rect(0, 0, 16, 16).fill({ color: 0x000000 });
    this.app.stage.addChild(this.fit, this.flashRect, this.wipe);
    this.cam = new Camera(this.camera, this.flashRect, () => this.opts.reducedMotion);
    this.cam.focus = { x: W / 2, y: H / 2 };
    this.fxc = { tw: this.tw, fx: this.fx, layer: this.fxLayer, top: this.top, camera: this.cam, reduced: this.opts.reducedMotion, font: this.opts.font };
    // creatures start off-screen until intro()
    this.mon.player.x = -200;
    this.mon.foe.x = W + 200;
  }

  /** Keep the battle band fully visible at any aspect ratio. */
  private layout() {
    const { width, height } = this.app.screen;
    const s = Math.min(height / (H - 60), width / (W - 120));
    this.fit.scale.set(s);
    this.fit.position.set(width / 2 - (W / 2) * s, height / 2 - (H / 2 + 20) * s);
    for (const r of [this.flashRect, this.wipe]) {
      r.width = width;
      r.height = height;
    }
  }

  private frame(realDt: number) {
    if (this.destroyed) return;
    const dt = this.cam.update(realDt);
    this.t += realDt;
    this.tw.update(dt);
    this.fx.update(dt);
    for (const a of this.anims) a.update(dt);
  }

  /* --------------------------------------------------------------- API */

  /** Screen wipe, then both creatures slide in. */
  async intro() {
    this.wipe.alpha = 1;
    await this.tw.wait(0.15);
    this.cam.flash(0.8);
    await this.tw.to(this.wipe, { alpha: 0 }, 0.35, ease.inQuad);
    await Promise.all([this.tw.to(this.mon.foe, { x: HOME.foe.x }, 0.7, ease.outCubic), this.tw.to(this.mon.player, { x: HOME.player.x }, 0.7, ease.outCubic)]);
  }

  private hitPoint(who: Who) {
    const m = this.mon[who];
    return { x: m.x, y: m.y - m.height * 0.45 };
  }

  /** A landed move: lunge, a typed bit-orb projectile, impact sparks, shake and damage numbers. */
  async attack(who: Who, type: MoveType, damage: number, crit: boolean) {
    const target: Who = who === "player" ? "foe" : "player";
    const me = this.mon[who];
    const color = TYPE_COLOR[type];
    const dir = who === "player" ? 1 : -1;
    const anim = me.play("attack");
    await this.tw.to(me, { x: HOME[who].x + dir * 36, y: HOME[who].y - dir * 12 }, 0.14, ease.outQuad);
    void this.tw.to(me, { x: HOME[who].x, y: HOME[who].y }, 0.3, ease.outCubic);

    const from = this.hitPoint(who);
    const to = this.hitPoint(target);
    const orb = new PixiPixelSprite(BIT_ORB, 4);
    orb.sprite.tint = color;
    orb.sprite.anchor.set(0.5);
    orb.position.set(from.x, from.y);
    this.top.addChild(orb);
    this.anims.push(orb);
    await this.tw.run(
      0.4,
      (k) => {
        orb.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 60);
        if (Math.random() < 0.7 * this.fx.scale) this.fx.emit({ x: orb.x, y: orb.y, size: 10, life: 0.3, color });
      },
      ease.inQuad,
    );
    this.drop(orb);
    await anim;
    await this.impact(target, color, damage, crit);
  }

  private drop(s: PixiPixelSprite) {
    this.anims = this.anims.filter((a) => a !== s);
    s.destroy({ children: true });
  }

  private async impact(who: Who, color: number, damage: number, crit: boolean) {
    const m = this.mon[who];
    const p = this.hitPoint(who);
    const spark = new PixiPixelSprite(IMPACT, crit ? 7 : 5);
    spark.sprite.anchor.set(0.5);
    spark.sprite.tint = color;
    spark.position.set(p.x, p.y);
    this.top.addChild(spark);
    this.anims.push(spark);
    void spark.play("idle", false).then(() => this.drop(spark));
    this.fx.burst(p.x, p.y, { count: crit ? 40 : 22, speed: 380, color, size: 10, spark: true });
    void ring(this.fxc, p, { color, radius: crit ? 150 : 100, squash: 0.6 });
    this.cam.shake(crit ? 18 : 10);
    this.cam.hitStop(crit ? 0.12 : 0.06);
    if (crit) this.cam.flash(0.4);
    popText(this.fxc, { x: p.x, y: p.y - 70 }, `-${damage}`, { color: crit ? 0xffe27a : 0xffffff, size: crit ? 56 : 44, crit });
    if (crit) popText(this.fxc, { x: p.x, y: p.y - 130 }, "CRITICAL!", { color: 0xffe27a, size: 26, rise: 40 });
    // hurt: wince pose, white flash blinks + recoil
    void m.play("hurt");
    const back = who === "player" ? -1 : 1;
    void this.tw.to(m, { x: m.x + back * 18 }, 0.08).then(() => this.tw.to(m, { x: HOME[who].x }, 0.25, ease.outBack));
    for (let i = 0; i < 3; i++) {
      m.flashAmount = 1;
      await this.tw.wait(0.07);
      m.flashAmount = 0;
      await this.tw.wait(0.07);
    }
  }

  /** Faint: flash, sink below the platform line and fade. */
  async faint(who: Who) {
    const m = this.mon[who];
    m.flashAmount = 0.8;
    void this.tw.to(m, { flashAmount: 0 }, 0.3);
    await this.tw.to(m, { y: HOME[who].y + 90, alpha: 0 }, 0.7, ease.inCubic);
  }

  setReducedMotion(on: boolean) {
    this.opts.reducedMotion = on;
    this.fx.scale = on ? 0.35 : 1;
  }

  destroy() {
    this.destroyed = true;
    this.tw.dispose();
    this.fx.clear();
    this.app.destroy({ removeView: true }, { children: true });
  }
}
