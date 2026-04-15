import Phaser from 'phaser'
import {
  ASSET,
  DEPTH,
  LARS_DOUBLE_JUMP_VELOCITY,
  LARS_JUMP_VELOCITY,
  LARS_SPEED,
} from '../constants'

type Mood = 'normal' | 'happy' | 'scared' | 'victory'

/**
 * LarsPlayer: Arcade-physics sprite med:
 * - Venstre/højre bevægelse
 * - Single + double jump (Lars er liddt overspist, men kan stadig)
 * - Mood-state der påvirker tint (gylden = happy, blå = scared)
 * - Invuln-flicker efter hit
 *
 * Holdes som klasse separat fra Phaser.Sprite for at gøre testing/state nemmere.
 */
export class LarsPlayer {
  public sprite: Phaser.Physics.Arcade.Sprite
  public lives = 3
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private spaceKey!: Phaser.Input.Keyboard.Key
  private wasdW!: Phaser.Input.Keyboard.Key
  private wasdA!: Phaser.Input.Keyboard.Key
  private wasdD!: Phaser.Input.Keyboard.Key
  private jumpsUsed = 0
  private invulnUntil = 0
  private mood: Mood = 'normal'
  private moodTimer = 0

  constructor(public scene: Phaser.Scene, x: number, y: number) {
    const sprite = scene.physics.add.sprite(x, y, ASSET.TEX_LARS)
    sprite.setDepth(DEPTH.PLAYER)
    sprite.setCollideWorldBounds(true)
    sprite.setBounce(0)
    sprite.setDragX(900)
    sprite.setMaxVelocity(LARS_SPEED * 1.2, 1500)
    // Body lidt smallere end texture for blødere hit-detection
    sprite.body!.setSize(28, 50, true)
    this.sprite = sprite

    const kb = scene.input.keyboard
    if (!kb) {
      throw new Error('Keyboard input not available — kør i browser')
    }
    this.cursors = kb.createCursorKeys()
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.wasdW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.wasdA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.wasdD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
  }

  update(time: number, dt: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    if (!body) return

    const left = this.cursors.left.isDown || this.wasdA.isDown
    const right = this.cursors.right.isDown || this.wasdD.isDown
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.wasdW)

    // Horizontal movement
    if (left) {
      this.sprite.setVelocityX(-LARS_SPEED)
      this.sprite.setFlipX(true)
    } else if (right) {
      this.sprite.setVelocityX(LARS_SPEED)
      this.sprite.setFlipX(false)
    }

    // Reset jump count når vi rammer ground
    if (body.blocked.down || body.touching.down) {
      this.jumpsUsed = 0
    }

    // Jump (med double jump)
    if (jumpPressed) {
      if (this.jumpsUsed === 0 && (body.blocked.down || body.touching.down)) {
        this.sprite.setVelocityY(LARS_JUMP_VELOCITY)
        this.jumpsUsed = 1
      } else if (this.jumpsUsed === 1) {
        this.sprite.setVelocityY(LARS_DOUBLE_JUMP_VELOCITY)
        this.jumpsUsed = 2
        // Lille squash for at vise double-jump
        this.scene.tweens.add({
          targets: this.sprite,
          scaleX: 1.2,
          scaleY: 0.8,
          duration: 80,
          yoyo: true,
        })
      }
    }

    // Invuln-flicker
    if (time < this.invulnUntil) {
      this.sprite.setAlpha(Math.sin(time * 0.03) > 0 ? 1 : 0.3)
    } else {
      this.sprite.setAlpha(1)
    }

    // Mood timer countdown
    if (this.moodTimer > 0) {
      this.moodTimer -= dt
      if (this.moodTimer <= 0) {
        this.mood = 'normal'
        this.applyMoodTint()
      }
    }
  }

  setMood(mood: Mood, durationMs: number) {
    this.mood = mood
    this.moodTimer = durationMs
    this.applyMoodTint()
  }

  private applyMoodTint() {
    switch (this.mood) {
      case 'happy':
        this.sprite.setTint(0xffd966)
        break
      case 'scared':
        this.sprite.setTint(0x6688ff)
        break
      case 'victory':
        this.sprite.setTint(0xf5a623)
        break
      default:
        this.sprite.clearTint()
    }
  }

  /**
   * Tag damage. Returner true hvis hittet faktisk landede (ikke i invuln).
   */
  takeHit(time: number): boolean {
    if (time < this.invulnUntil) return false
    this.lives = Math.max(0, this.lives - 1)
    this.invulnUntil = time + 1500
    // Knockback
    this.sprite.setVelocityY(-300)
    this.sprite.setVelocityX(this.sprite.flipX ? 300 : -300)
    // Camera shake besluttes af scenen
    this.scene.cameras.main.shake(180, 0.012)
    return true
  }

  isDead(): boolean {
    return this.lives <= 0
  }
}
