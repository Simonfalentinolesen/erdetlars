import Phaser from 'phaser'
import { DEPTH } from '../constants'
import { TEX } from '../textures'

/**
 * Jim Lyngvild — står i venstre side af skærmen som trickster.
 *
 * Han er ikke direkte gameplay-fjende; han laver "chaos events" der kort
 * forstyrrer spilleren: flashing lights, teasing speech-bubbles, peger på Lars.
 * MVP: han animerer mellem 3 frames (idle / point / cackle) og poster
 * periodisk en quote over hovedet.
 */

const QUOTES = [
  'Danser du forkert, Lars?',
  'Han fanger dem ALDRIG, vel?',
  'Det er ikke takt — det er krise!',
  'Din kone har ringet.',
  'En til, Lars. Bare en til.',
  'Du ligner en truende kedel.',
  'Publikum er på min side.',
]

export class Jim {
  scene: Phaser.Scene
  sprite: Phaser.GameObjects.Image
  shadow: Phaser.GameObjects.Ellipse
  private quote: Phaser.GameObjects.Container | null = null
  private baseX: number
  private baseY: number
  private nextQuoteAt = 6_000 // ms efter start

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.baseX = x
    this.baseY = y
    this.shadow = scene.add.ellipse(x, y + 4, 90, 14, 0x000000, 0.35).setDepth(DEPTH.JIM - 1)
    this.sprite = scene.add
      .image(x, y, TEX.JIM_IDLE)
      .setOrigin(0.5, 1)
      .setScale(1.3)
      .setDepth(DEPTH.JIM)
  }

  onBeat() {
    // Subtil wobble
    this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: -2, to: 2 },
      duration: 240,
      yoyo: true,
      ease: 'Sine.inOut',
    })
  }

  /**
   * Opdater per frame — tjek om vi skal poste en quote, wave animationen etc.
   */
  update(nowMs: number) {
    if (nowMs >= this.nextQuoteAt && !this.quote) {
      this.postQuote()
      // Næste quote 6-11 sek senere
      this.nextQuoteAt = nowMs + 6000 + Math.random() * 5000
    }
  }

  private postQuote() {
    const text = QUOTES[Math.floor(Math.random() * QUOTES.length)]
    // Swap til cackle-frame
    this.sprite.setTexture(TEX.JIM_CACKLE)

    // Quote boble
    const container = this.scene.add.container(this.baseX + 40, this.baseY - 180)
    container.setDepth(DEPTH.DIALOG)

    const padX = 16
    const padY = 8
    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '16px',
        color: '#101018',
        fontStyle: 'italic',
        wordWrap: { width: 260 },
        align: 'left',
      })
      .setOrigin(0, 0)
    const w = label.width + padX * 2
    const h = label.height + padY * 2

    const bubble = this.scene.add.graphics()
    bubble.fillStyle(0xfff6d8, 1)
    bubble.fillRoundedRect(0, 0, w, h, 10)
    bubble.lineStyle(2, 0xcc1f2b, 1)
    bubble.strokeRoundedRect(0, 0, w, h, 10)
    // Lille hale mod Jim
    bubble.fillStyle(0xfff6d8, 1)
    bubble.fillTriangle(10, h, 22, h, 6, h + 12)
    bubble.lineStyle(2, 0xcc1f2b, 1)
    bubble.beginPath()
    bubble.moveTo(10, h)
    bubble.lineTo(6, h + 12)
    bubble.lineTo(22, h)
    bubble.strokePath()

    label.setPosition(padX, padY)
    container.add([bubble, label])
    container.setScale(0.3)
    container.setAlpha(0)

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Back.out',
    })

    this.quote = container

    this.scene.time.delayedCall(2400, () => {
      if (!this.quote) return
      this.scene.tweens.add({
        targets: this.quote,
        alpha: 0,
        scale: 0.5,
        duration: 180,
        onComplete: () => {
          this.quote?.destroy()
          this.quote = null
          this.sprite.setTexture(TEX.JIM_IDLE)
        },
      })
    })

    // Peger på Lars i 1 sek
    this.scene.time.delayedCall(300, () => {
      this.sprite.setTexture(TEX.JIM_POINT)
      this.scene.time.delayedCall(900, () => {
        if (!this.quote) return
        this.sprite.setTexture(TEX.JIM_CACKLE)
      })
    })
  }

  destroy() {
    this.quote?.destroy()
    this.sprite.destroy()
    this.shadow.destroy()
  }
}
