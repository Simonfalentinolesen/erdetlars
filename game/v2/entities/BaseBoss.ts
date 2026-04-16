import Phaser from 'phaser'
import { DEPTH } from '../constants'
import { HitFx } from '../fx/HitFx'

/**
 * BaseBoss — abstract klasse for alle bosser.
 *
 * Fælles adfærd:
 * - HP-tracking med phase-events når HP rammer specifikke tærskler
 * - Invulnerability efter hit (ingen mashing-kill)
 * - Standard death-sekvens med eksplosion + events
 * - HUD-integration via scene-events ('boss-hp', 'boss-phase', 'boss-death')
 *
 * Subklasser skal implementere:
 * - update(time, dt): AI-logik pr. frame
 * - onPhaseChange(newPhase): visuelt/mekanisk skift
 */
export abstract class BaseBoss {
  public sprite: Phaser.Physics.Arcade.Sprite
  public hp: number
  public readonly hpMax: number
  public phase = 1
  protected invulnUntil = 0
  protected readonly invulnMs: number
  protected readonly name: string
  protected readonly phaseThresholds: number[] // HP-værdier der trigger nye faser
  protected dead = false

  constructor(
    protected scene: Phaser.Scene,
    texture: string,
    x: number,
    y: number,
    opts: {
      hpMax: number
      name: string
      phaseThresholds?: number[] // fx [3, 1] for boss med 3 faser (5 → 3 → 1)
      invulnMs?: number
    },
  ) {
    this.hpMax = opts.hpMax
    this.hp = opts.hpMax
    this.name = opts.name
    this.phaseThresholds = opts.phaseThresholds ?? []
    this.invulnMs = opts.invulnMs ?? 600

    const sprite = scene.physics.add.sprite(x, y, texture)
    sprite.setDepth(DEPTH.ENEMIES + 2)
    sprite.setCollideWorldBounds(false)
    this.sprite = sprite
  }

  /**
   * Subklasser kalder denne når Lars stomper dem, eller ved anden hit-kilde.
   * Returnerer true hvis hittet blev registreret (ikke invuln).
   */
  takeHit(time: number): boolean {
    if (this.dead || time < this.invulnUntil) return false
    this.hp--
    this.invulnUntil = time + this.invulnMs

    HitFx.bossHitFlash(this.scene, this.sprite)
    HitFx.shake(this.scene, 'small')

    // Emit HP-event til HUD
    this.scene.events.emit('boss-hp', { hp: this.hp, hpMax: this.hpMax })

    // Phase check
    for (let i = 0; i < this.phaseThresholds.length; i++) {
      const threshold = this.phaseThresholds[i]
      if (this.hp === threshold && this.phase === i + 1) {
        this.phase = i + 2
        this.scene.events.emit('boss-phase', { phase: this.phase, hp: this.hp })
        this.onPhaseChange(this.phase)
      }
    }

    if (this.hp <= 0) this.die()
    return true
  }

  protected die() {
    if (this.dead) return
    this.dead = true
    HitFx.bossDeathExplosion(this.scene, this.sprite.x, this.sprite.y)
    this.scene.events.emit('boss-death', { name: this.name })

    // Fade boss ud
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: 0.2,
      duration: 600,
      onComplete: () => this.sprite.destroy(),
    })
  }

  isDead(): boolean {
    return this.dead
  }

  abstract update(time: number, dt: number): void
  protected abstract onPhaseChange(newPhase: number): void
}
