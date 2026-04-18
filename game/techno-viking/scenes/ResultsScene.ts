import Phaser from 'phaser'
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE, STORAGE } from '../constants'
import { TEX } from '../textures'

interface ResultsData {
  score: number
  maxCombo: number
  perfect: number
  great: number
  good: number
  miss: number
  followers: number
  stageName: string
  isNewHi: boolean
}

/**
 * ResultsScene — slut-skærm med score breakdown, stage-titel, retry/menu.
 */
export class ResultsScene extends Phaser.Scene {
  private results!: ResultsData

  constructor() {
    super({ key: SCENE.RESULTS })
  }

  init(data: ResultsData) {
    this.results = data
  }

  create() {
    const cx = GAME_WIDTH / 2

    // Bg gradient
    const bg = this.add.graphics()
    bg.fillGradientStyle(
      COLORS.SKY_TOP,
      COLORS.SKY_TOP,
      COLORS.SKY_MID,
      COLORS.SKY_MID,
      1,
    )
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Lars silhouette centered i baggrund (celebration)
    this.add
      .image(cx, GAME_HEIGHT - 180, TEX.LARS_TECHNO_A)
      .setOrigin(0.5, 1)
      .setScale(1.2)
      .setAlpha(0.8)

    // Title
    this.add
      .text(cx, 60, this.results.stageName.toUpperCase(), {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#ffd447',
      })
      .setOrigin(0.5)
      .setStroke('#0a0a12', 5)

    // Score
    const scoreText = this.add
      .text(cx, 130, String(this.results.score).padStart(6, '0'), {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#0a0a12', 5)
    this.tweens.add({
      targets: scoreText,
      scale: { from: 0.3, to: 1 },
      duration: 420,
      ease: 'Back.out',
    })

    if (this.results.isNewHi) {
      this.add
        .text(cx, 190, '★ NY HIGHSCORE ★', {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '18px',
          color: '#ff9ac2',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    }

    // Breakdown rows
    const rows: Array<[string, string, string]> = [
      ['PERFECT', String(this.results.perfect), '#ffd447'],
      ['GREAT', String(this.results.great), '#4de0a1'],
      ['GOOD', String(this.results.good), '#5ec8ff'],
      ['MISS', String(this.results.miss), '#ff3b6b'],
      ['MAX COMBO', `${this.results.maxCombo}x`, '#ffffff'],
      ['FØLGERE', String(this.results.followers), '#ff9ac2'],
    ]
    const startY = 230
    rows.forEach((row, i) => {
      const [label, value, color] = row
      const y = startY + i * 36
      this.add
        .text(cx - 140, y, label, {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '16px',
          color: '#a0a8b8',
        })
        .setOrigin(0, 0.5)
      this.add
        .text(cx + 140, y, value, {
          fontFamily: 'Space Grotesk, system-ui, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color,
        })
        .setOrigin(1, 0.5)
    })

    const hi = Number(localStorage.getItem(STORAGE.HIGHSCORE) || 0)
    this.add
      .text(cx, startY + rows.length * 36 + 20, `BEST EVER: ${hi.toLocaleString('da-DK')}`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#7a8a95',
      })
      .setOrigin(0.5)

    // Buttons
    const btnY = GAME_HEIGHT - 80
    const retry = this.makeButton(cx - 130, btnY, 'DANS IGEN', 0xffd447, '#1a0a0a', () => {
      this.scene.start(SCENE.GAME)
    })
    const menu = this.makeButton(cx + 130, btnY, 'MENU', 0x1a1a2a, '#ffffff', () => {
      this.scene.start(SCENE.MENU)
    })
    void retry
    void menu

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start(SCENE.GAME))
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE.MENU))
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    fill: number,
    textColor: string,
    onClick: () => void,
  ) {
    const rect = this.add.rectangle(x, y, 220, 56, fill).setStrokeStyle(2, 0xffffff, 0.8)
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: textColor,
      })
      .setOrigin(0.5)
    rect.setInteractive({ useHandCursor: true })
    rect.on('pointerover', () => {
      rect.setScale(1.05)
      text.setScale(1.05)
    })
    rect.on('pointerout', () => {
      rect.setScale(1)
      text.setScale(1)
    })
    rect.on('pointerdown', onClick)
    return { rect, text }
  }
}
