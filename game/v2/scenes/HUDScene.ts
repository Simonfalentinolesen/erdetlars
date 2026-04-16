import Phaser from 'phaser'
import { DEPTH, GAME_WIDTH, SCENE } from '../constants'

interface HUDInit {
  lives: number
  score: number
  level: string
}

/**
 * HUDScene: overlay med score, lives, level-navn, og boss-bar (når en boss er aktiv).
 *
 * Lytter til events emitted af den aktive level-scene:
 * - 'score' (n): ny total-score
 * - 'lives' (n): ny antal liv
 * - 'boss-start' ({name, hp, hpMax}): vis boss-bar
 * - 'boss-hp' ({hp, hpMax}): opdater bar
 * - 'boss-death': skjul bar
 */
export class HUDScene extends Phaser.Scene {
  private livesTxt!: Phaser.GameObjects.Text
  private scoreTxt!: Phaser.GameObjects.Text

  // Boss-bar components
  private bossBarBg?: Phaser.GameObjects.Rectangle
  private bossBarFill?: Phaser.GameObjects.Rectangle
  private bossName?: Phaser.GameObjects.Text
  private bossBarWidth = 500

  constructor() {
    super({ key: SCENE.HUD })
  }

  create(data: HUDInit) {
    // Top bar
    this.add.rectangle(GAME_WIDTH / 2, 30, GAME_WIDTH, 60, 0x0f1923, 0.7)
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)

    // Level-navn (centreret)
    this.add.text(GAME_WIDTH / 2, 30, data.level, {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#F5A623',
    }).setOrigin(0.5).setDepth(DEPTH.HUD)

    // Lives (venstre)
    this.livesTxt = this.add.text(20, 30, this.formatLives(data.lives), {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '24px',
      color: '#FF5470',
    }).setOrigin(0, 0.5).setDepth(DEPTH.HUD)

    // Score (højre)
    this.scoreTxt = this.add.text(GAME_WIDTH - 20, 30, this.formatScore(data.score), {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#FFFFFF',
    }).setOrigin(1, 0.5).setDepth(DEPTH.HUD)

    // ESC-hint
    this.add.text(GAME_WIDTH / 2, 66, 'ESC = menu', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#5a6a75',
    }).setOrigin(0.5).setDepth(DEPTH.HUD)

    // Lyt til events fra parent scene
    const level = this.scene.get(SCENE.LEVEL1)
    level.events.on('score', (s: number) => this.scoreTxt.setText(this.formatScore(s)))
    level.events.on('lives', (l: number) => this.livesTxt.setText(this.formatLives(l)))
    level.events.on('boss-start', (d: { name: string, hp: number, hpMax: number }) => this.showBossBar(d))
    level.events.on('boss-hp', (d: { hp: number, hpMax: number }) => this.updateBossBar(d))
    level.events.on('boss-death', () => this.hideBossBar())
  }

  private formatLives(n: number): string {
    return '♥'.repeat(n) + '♡'.repeat(Math.max(0, 3 - n))
  }

  private formatScore(s: number): string {
    return `SCORE ${s.toLocaleString('da-DK')}`
  }

  // ---------- Boss-bar ----------

  private showBossBar(d: { name: string, hp: number, hpMax: number }) {
    const y = 90
    const barX = GAME_WIDTH / 2

    this.bossName = this.add.text(barX, y - 14, d.name, {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#FF4040',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(DEPTH.HUD).setAlpha(0)

    this.bossBarBg = this.add.rectangle(barX, y + 10, this.bossBarWidth, 16, 0x1a0a0a)
      .setStrokeStyle(2, 0xff4040)
      .setDepth(DEPTH.HUD)
      .setAlpha(0)
    this.bossBarFill = this.add.rectangle(
      barX - this.bossBarWidth / 2 + 2,
      y + 10,
      this.bossBarWidth - 4,
      12,
      0xff4020,
    ).setOrigin(0, 0.5).setDepth(DEPTH.HUD).setAlpha(0)

    this.tweens.add({
      targets: [this.bossName, this.bossBarBg, this.bossBarFill],
      alpha: 1,
      duration: 400,
    })
  }

  private updateBossBar(d: { hp: number, hpMax: number }) {
    if (!this.bossBarFill) return
    const ratio = Math.max(0, d.hp / d.hpMax)
    this.tweens.add({
      targets: this.bossBarFill,
      displayWidth: (this.bossBarWidth - 4) * ratio,
      duration: 220,
      ease: 'Cubic.easeOut',
    })
    // Flash rød ved hit
    if (this.bossBarBg) {
      this.bossBarBg.setStrokeStyle(4, 0xffffff)
      this.time.delayedCall(120, () => {
        if (this.bossBarBg) this.bossBarBg.setStrokeStyle(2, 0xff4040)
      })
    }
  }

  private hideBossBar() {
    const targets = [this.bossName, this.bossBarBg, this.bossBarFill].filter(Boolean) as Phaser.GameObjects.GameObject[]
    if (!targets.length) return
    this.tweens.add({
      targets,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        targets.forEach(t => t.destroy())
        this.bossName = undefined
        this.bossBarBg = undefined
        this.bossBarFill = undefined
      },
    })
  }
}
