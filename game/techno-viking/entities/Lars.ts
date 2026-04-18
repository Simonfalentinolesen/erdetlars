import Phaser from 'phaser'
import { COLORS, DEPTH, STAGE_THRESHOLDS } from '../constants'
import { TEX } from '../textures'

/**
 * Lars — parade-leader. Står i midten nederst på skærmen og marcherer i takt.
 *
 * Han er "low-poly" og ikke en sprite-sheet; i stedet cycler vi mellem 2 frames
 * per stage ved at swappe tekstur på beat. Transformation mellem stages sker
 * ved at blende via alpha + et glow-ring der puffer.
 */
export class Lars {
  scene: Phaser.Scene
  sprite: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Image
  shadow: Phaser.GameObjects.Ellipse
  stageIndex = 0 // 0..4
  private currentFrame: 'a' | 'b' = 'a'
  private baseY: number
  private bopTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.baseY = y

    this.shadow = scene.add.ellipse(x, y + 90, 120, 20, 0x000000, 0.4).setDepth(DEPTH.LARS - 1)

    this.glow = scene.add
      .image(x, y, TEX.BEAT_RING)
      .setScale(2.4)
      .setAlpha(0)
      .setTint(COLORS.LARS_TATTOO_GLOW)
      .setDepth(DEPTH.LARS - 1)

    this.sprite = scene.add
      .image(x, y, this.textureFor(0, 'a'))
      .setDepth(DEPTH.LARS)
      .setScale(1.6)
    this.sprite.setOrigin(0.5, 1)
    this.shadow.setY(y + 4)
  }

  get x() {
    return this.sprite.x
  }
  get y() {
    return this.sprite.y
  }

  /**
   * Kaldes på hver beat — Lars "bopper" og frame cycler.
   */
  onBeat(isDownbeat: boolean) {
    this.currentFrame = this.currentFrame === 'a' ? 'b' : 'a'
    this.sprite.setTexture(this.textureFor(this.stageIndex, this.currentFrame))

    const strength = isDownbeat ? 16 : 8
    if (this.bopTween) this.bopTween.stop()
    this.sprite.y = this.baseY
    this.bopTween = this.scene.tweens.add({
      targets: this.sprite,
      y: this.baseY - strength,
      duration: 80,
      yoyo: true,
      ease: 'Sine.inOut',
    })

    // Glow pulser subtilt når stage > 1
    if (this.stageIndex >= 2) {
      this.scene.tweens.add({
        targets: this.glow,
        alpha: { from: 0.5 + this.stageIndex * 0.1, to: 0 },
        scale: { from: 2.2 + this.stageIndex * 0.2, to: 3.2 + this.stageIndex * 0.2 },
        duration: 380,
        ease: 'Cubic.out',
      })
    }
  }

  /**
   * Trigger transform når follower-count passerer threshold.
   */
  updateFollowerCount(followers: number): boolean {
    let newStage = 0
    for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
      if (followers >= STAGE_THRESHOLDS[i]) {
        newStage = i
        break
      }
    }
    if (newStage !== this.stageIndex) {
      this.transformTo(newStage)
      return true
    }
    return false
  }

  private transformTo(newStage: number) {
    const prev = this.stageIndex
    this.stageIndex = newStage

    // Flash → swap → flash igen
    const flash = this.scene.add
      .image(this.sprite.x, this.sprite.y, TEX.HIT_SPARK)
      .setScale(5)
      .setAlpha(0)
      .setDepth(DEPTH.LARS + 1)
      .setTint(COLORS.LARS_TATTOO_GLOW)
      .setOrigin(0.5, 0.5)

    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.85 },
      scale: { from: 2, to: 8 },
      duration: 260,
      yoyo: true,
      ease: 'Cubic.out',
      onComplete: () => flash.destroy(),
    })

    this.scene.cameras.main.shake(220, 0.006 + newStage * 0.002)

    // Skalera Lars lidt op når han transformerer
    const targetScale = 1.6 + newStage * 0.06
    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: this.sprite.scale * 0.92, to: targetScale },
      duration: 320,
      ease: 'Back.out',
    })

    // Swap til stage frame
    this.sprite.setTexture(this.textureFor(newStage, this.currentFrame))

    // Event vi kan lytte på fra HUD
    this.scene.events.emit('tv-stage', { from: prev, to: newStage })
  }

  private textureFor(stage: number, frame: 'a' | 'b'): string {
    const map = [
      [TEX.LARS_CASUAL_A, TEX.LARS_CASUAL_B],
      [TEX.LARS_WARM_A, TEX.LARS_WARM_B],
      [TEX.LARS_LOOSE_A, TEX.LARS_LOOSE_B],
      [TEX.LARS_SHIFT_A, TEX.LARS_SHIFT_B],
      [TEX.LARS_TECHNO_A, TEX.LARS_TECHNO_B],
    ]
    const s = Math.max(0, Math.min(map.length - 1, stage))
    return map[s][frame === 'a' ? 0 : 1]
  }

  destroy() {
    this.bopTween?.stop()
    this.sprite.destroy()
    this.glow.destroy()
    this.shadow.destroy()
  }
}
