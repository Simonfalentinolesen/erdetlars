import Phaser from 'phaser'
import { ASSET, DEPTH } from '../../constants'
import { BaseBoss } from '../BaseBoss'
import { HitFx } from '../../fx/HitFx'

/**
 * Surtr — Moserne boss (Level 1).
 *
 * 3 faser:
 * - Fase 1 (HP 5→3): langsomt fremad mod Lars, berøring giver skade
 * - Fase 2 (HP 3→1): stands, swing m. øks → 3 sten kaster ud i bueformet bane
 *                   (simpel tell: boss løfter armene, pause 500ms, så fyr)
 * - Fase 3 (HP 1): desperat charge — dobbelt hastighed mod Lars
 *
 * Lars skader Surtr ved at stomp'e ham (hoppe ned ovenpå med positive velocityY).
 */
export class SurtrBoss extends BaseBoss {
  private target: Phaser.Physics.Arcade.Sprite
  private rockGroup: Phaser.Physics.Arcade.Group
  private attackTimer = 0
  private charging = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Phaser.Physics.Arcade.Sprite,
    rockGroup: Phaser.Physics.Arcade.Group,
  ) {
    super(scene, ASSET.TEX_SURTR, x, y, {
      hpMax: 5,
      name: 'Surtr',
      phaseThresholds: [3, 1], // faser skifter ved HP 3 og HP 1
      invulnMs: 700,
    })
    this.target = target
    this.rockGroup = rockGroup

    this.sprite.setDepth(DEPTH.ENEMIES + 2)
    this.sprite.setCollideWorldBounds(false)
    this.sprite.body!.setSize(70, 110, true)
    this.sprite.body!.setOffset(10, 8)
    // Surtr er tung, falder men pushes ikke let
    this.sprite.setMaxVelocity(300, 1500)

    // Subtil idle-puls (ild-aura)
    scene.tweens.add({
      targets: this.sprite,
      scaleX: { from: 1, to: 1.02 },
      scaleY: { from: 1, to: 0.98 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  update(time: number, _dt: number) {
    if (this.isDead()) return
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    if (!body) return

    const dx = this.target.x - this.sprite.x
    const facingRight = dx > 0
    this.sprite.setFlipX(facingRight) // sprite er tegnet som højrevendt → flip hvis højre

    if (this.phase === 1) {
      // Langsom march mod Lars
      const speed = 60
      this.sprite.setVelocityX(Math.sign(dx) * speed)
    } else if (this.phase === 2) {
      // Stop, angreb med sten hvert 2.5 sek
      this.sprite.setVelocityX(0)
      this.attackTimer -= this.scene.game.loop.delta
      if (this.attackTimer <= 0) {
        this.throwRocks()
        this.attackTimer = 2500
      }
    } else if (this.phase === 3) {
      // Charge
      const speed = 180
      this.sprite.setVelocityX(Math.sign(dx) * speed)
      if (!this.charging) {
        this.charging = true
        // Rød tint der pulserer
        this.scene.tweens.add({
          targets: this.sprite,
          duration: 200,
          yoyo: true,
          repeat: -1,
          onStart: () => this.sprite.setTint(0xff4040),
        })
      }
    }
  }

  protected onPhaseChange(newPhase: number) {
    // Vis et flash + tekst når ny fase starter
    const label = newPhase === 2 ? 'SURTR KASTER ILD!' : newPhase === 3 ? 'SURTR ER RASENDE!' : ''
    if (label) {
      HitFx.shake(this.scene, 'medium')
      const cam = this.scene.cameras.main
      const t = this.scene.add.text(cam.worldView.centerX, cam.worldView.y + 100, label, {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#FF4040',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.DIALOG).setScrollFactor(0)
      this.scene.tweens.add({
        targets: t,
        alpha: 0,
        scale: 1.4,
        duration: 1500,
        onComplete: () => t.destroy(),
      })
    }
    if (newPhase === 2) {
      this.attackTimer = 800 // lidt delay før første kast
    }
  }

  /**
   * Kast 3 sten i bueformet bane mod Lars. Stenene tilføjes til rockGroup så
   * scenens collider kan håndtere dem.
   */
  private throwRocks() {
    // Lille arm-løft animation
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 6,
      duration: 150,
      yoyo: true,
    })

    this.scene.time.delayedCall(200, () => {
      if (this.isDead()) return
      const dx = this.target.x - this.sprite.x
      const dir = Math.sign(dx) || 1
      const speeds = [-180, -120, -60] // vertikal opstart — buer forskelligt højt
      const horizVel = [220, 280, 340]
      for (let i = 0; i < 3; i++) {
        const rock = this.rockGroup.create(
          this.sprite.x + dir * 30,
          this.sprite.y - 30,
          ASSET.TEX_SURTR_ROCK,
        ) as Phaser.Physics.Arcade.Sprite
        rock.setDepth(DEPTH.PARTICLES)
        rock.setVelocity(dir * horizVel[i], speeds[i])
        rock.body!.setSize(16, 16, true)
        // Spin
        this.scene.tweens.add({
          targets: rock,
          angle: 720,
          duration: 2000,
          repeat: -1,
        })
        // Fjern efter 4 sek
        this.scene.time.delayedCall(4000, () => {
          if (rock.active) rock.destroy()
        })
      }
    })
  }
}
