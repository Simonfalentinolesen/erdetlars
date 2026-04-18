import Phaser from 'phaser'
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE, STORAGE } from '../constants'
import { TEX } from '../textures'

/**
 * MenuScene — title screen med "start", controls-hint og highscore.
 *
 * Vi laver en let pulsende "rave intro" så brugeren forstår vibe'en før
 * GameScene starter. Bekræfter også at vi har fået en user-gesture så
 * Web Audio kan starte uden autoplay-warning.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.MENU })
  }

  create() {
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2

    // Background gradient via layered rectangles
    const bg = this.add.graphics()
    bg.fillGradientStyle(
      COLORS.SKY_TOP,
      COLORS.SKY_TOP,
      COLORS.SKY_MID,
      COLORS.SKY_MID,
      1,
    )
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Pulserende "rave-glow" bag titel
    const glow = this.add
      .image(cx, cy - 120, TEX.HIT_SPARK)
      .setScale(14)
      .setAlpha(0.25)
      .setTint(0xff3b6b)
    this.tweens.add({
      targets: glow,
      scale: { from: 12, to: 16 },
      alpha: { from: 0.15, to: 0.4 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    // Titel
    this.add
      .text(cx, cy - 160, 'TECHNO VIKING', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffd447',
      })
      .setOrigin(0.5)
      .setStroke('#1a0a0a', 6)

    this.add
      .text(cx, cy - 95, 'Lars mod Jim · Pølsevognen kl. 03:47', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '20px',
        color: '#e8d8a0',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)

    // Lars preview i midten
    this.add
      .image(cx - 140, cy + 20, TEX.LARS_TECHNO_A)
      .setScale(1.3)
      .setOrigin(0.5, 1)

    this.add
      .image(cx + 140, cy + 20, TEX.JIM_POINT)
      .setScale(1.1)
      .setOrigin(0.5, 1)

    // Controls
    const controlsY = cy + 80
    this.add
      .text(cx, controlsY, 'TRYK/KLIK · ←  ↓  ↑  → · ELLER A  S  W  D', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    this.add
      .text(cx, controlsY + 26, 'Ram pilene på beat. Få øl. Led paraden til Valhalla.', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '15px',
        color: '#a0a8b8',
      })
      .setOrigin(0.5)

    // Highscore
    const hi = Number(localStorage.getItem(STORAGE.HIGHSCORE) || 0)
    const maxCombo = Number(localStorage.getItem(STORAGE.MAX_COMBO) || 0)
    if (hi > 0) {
      this.add
        .text(cx, controlsY + 58, `Best: ${hi.toLocaleString('da-DK')} · Max combo: ${maxCombo}x`, {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '14px',
          color: '#7a8a95',
        })
        .setOrigin(0.5)
    }

    // Start-knap
    const btn = this.add
      .rectangle(cx, cy + 180, 260, 64, 0xffd447)
      .setStrokeStyle(3, 0xffffff)
    const btnLabel = this.add
      .text(cx, cy + 180, 'DANS', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#1a0a0a',
      })
      .setOrigin(0.5)

    btn.setInteractive({ useHandCursor: true })
    btn.on('pointerover', () => {
      btn.setFillStyle(0xffe684)
      btnLabel.setScale(1.05)
    })
    btn.on('pointerout', () => {
      btn.setFillStyle(0xffd447)
      btnLabel.setScale(1)
    })

    const start = () => {
      btn.disableInteractive()
      this.cameras.main.fadeOut(220, 10, 5, 15)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENE.GAME)
      })
    }
    btn.on('pointerdown', start)

    // SPACE / ENTER starter også
    this.input.keyboard?.once('keydown-SPACE', start)
    this.input.keyboard?.once('keydown-ENTER', start)

    // Pulsérende button
    this.tweens.add({
      targets: btn,
      scale: { from: 1, to: 1.04 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })
  }
}
