import Phaser from 'phaser'
import { ASSET, DEPTH } from '../constants'

/**
 * HitFx — genbrugelige visuelle effekter til "juice" i gameplay.
 *
 * Alle funktioner tager en scene-reference og x/y, og spawner selvkørende
 * objekter der rydder op efter sig selv (destroy() i onComplete).
 */
export class HitFx {
  /**
   * Flydende pop-text der driver opad og fader ud. Bruges til +100, +250, osv.
   */
  static popText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color = '#F5A623',
    opts: { fontSize?: string, rise?: number, duration?: number } = {},
  ) {
    const t = scene.add.text(x, y, text, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: opts.fontSize ?? '20px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.PARTICLES)

    scene.tweens.add({
      targets: t,
      y: y - (opts.rise ?? 40),
      alpha: 0,
      scale: { from: 1, to: 1.25 },
      duration: opts.duration ?? 750,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    })

    return t
  }

  /**
   * Burst af 8 stjerner fra et punkt — bruges ved pickup/stomp.
   */
  static pickupBurst(scene: Phaser.Scene, x: number, y: number, tint = 0xf5a623) {
    const emitter = scene.add.particles(x, y, ASSET.TEX_P_STAR, {
      lifespan: 500,
      speed: { min: 80, max: 180 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      quantity: 8,
      emitting: false,
    })
    emitter.setDepth(DEPTH.PARTICLES)
    emitter.explode(8)
    scene.time.delayedCall(600, () => emitter.destroy())
  }

  /**
   * Boss-hit flash: hvid tint + scale-pulse for at give vægt til et hit.
   */
  static bossHitFlash(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite) {
    sprite.setTintFill(0xffffff)
    scene.tweens.add({
      targets: sprite,
      scale: { from: sprite.scale * 1.08, to: sprite.scale },
      duration: 80,
      yoyo: false,
      onComplete: () => {
        sprite.clearTint()
      },
    })
  }

  /**
   * Boss-death explosion: guld-partikler + screen-shake + chromatic flash
   */
  static bossDeathExplosion(scene: Phaser.Scene, x: number, y: number) {
    // Guld-burst
    const gold = scene.add.particles(x, y, ASSET.TEX_P_GOLD, {
      lifespan: 1400,
      speed: { min: 150, max: 350 },
      scale: { start: 1.8, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 400,
      quantity: 30,
      emitting: false,
    })
    gold.setDepth(DEPTH.BOSS_FX)
    gold.explode(30)
    scene.time.delayedCall(1500, () => gold.destroy())

    // Røg/stjerne-burst
    const stars = scene.add.particles(x, y, ASSET.TEX_P_STAR, {
      lifespan: 900,
      speed: { min: 80, max: 250 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff3010, 0xf5a623, 0xffd700],
      quantity: 20,
      emitting: false,
    })
    stars.setDepth(DEPTH.BOSS_FX)
    stars.explode(20)
    scene.time.delayedCall(1000, () => stars.destroy())

    // Kameraet ryster og flasher
    scene.cameras.main.shake(500, 0.018)
    scene.cameras.main.flash(200, 255, 220, 120)
  }

  /**
   * Pre-set screen-shake med navngivne intensiteter
   */
  static shake(scene: Phaser.Scene, preset: 'small' | 'medium' | 'big' | 'huge' = 'medium') {
    const map = {
      small: { dur: 120, amt: 0.006 },
      medium: { dur: 200, amt: 0.012 },
      big: { dur: 350, amt: 0.018 },
      huge: { dur: 600, amt: 0.025 },
    }
    const { dur, amt } = map[preset]
    scene.cameras.main.shake(dur, amt)
  }
}
