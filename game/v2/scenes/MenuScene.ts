import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../constants'

/**
 * MenuScene: simpel start-skærm med "TRYK FOR AT SPILLE LEVEL 1".
 * V2 starter MVP — kun Level 1 først, vi udvider når arkitekturen er bevist.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.MENU })
  }

  create() {
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2

    // Baggrund
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x0f1923)

    // Glow
    const glow = this.add.circle(cx, cy - 50, 200, 0xf5a623, 0.15)
    this.tweens.add({
      targets: glow,
      scale: { from: 1, to: 1.2 },
      alpha: { from: 0.15, to: 0.3 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Title
    this.add.text(cx, cy - 120, 'LARS', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '128px',
      fontStyle: 'bold',
      color: '#FFFFFF',
    }).setOrigin(0.5)

    this.add.text(cx, cy - 30, 'OG VEJEN TIL VALHALLA', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#F5A623',
    }).setOrigin(0.5)

    this.add.text(cx, cy + 20, 'V2 — Phaser 3 Engine', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '16px',
      color: '#7A8A95',
    }).setOrigin(0.5)

    // CTA-knap
    const btnW = 360
    const btnH = 70
    const btn = this.add.rectangle(cx, cy + 130, btnW, btnH, 0xf5a623)
      .setStrokeStyle(3, 0xffffff)
      .setInteractive({ useHandCursor: true })

    const btnTxt = this.add.text(cx, cy + 130, 'SPIL LEVEL 1: MOSERNE', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#0F1923',
    }).setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0xffd166))
    btn.on('pointerout', () => btn.setFillStyle(0xf5a623))
    btn.on('pointerdown', () => {
      btn.setScale(0.95)
      btnTxt.setScale(0.95)
      this.time.delayedCall(80, () => {
        this.cameras.main.fadeOut(300, 0, 0, 0)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start(SCENE.LEVEL1)
        })
      })
    })

    // Hint
    this.add.text(cx, GAME_HEIGHT - 60, '← → for at gå · MELLEMRUM/op for at hoppe (dobbelthop tilladt)', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      color: '#7A8A95',
    }).setOrigin(0.5)

    this.add.text(cx, GAME_HEIGHT - 30, 'TIP: Saml øl, undgå mosedrauger, find Surtr i slutningen', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      color: '#5a6a75',
    }).setOrigin(0.5)
  }
}
