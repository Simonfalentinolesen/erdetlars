import Phaser from 'phaser'
import { GAME_WIDTH, SCENE } from '../constants'

interface HUDInit {
  lives: number
  score: number
  level: string
}

/**
 * HUDScene: overlay-scene der viser score, lives, og level-navn.
 * Lyttter på events fra Level-scenes — sceneA.events.emit('score', n) opdaterer.
 */
export class HUDScene extends Phaser.Scene {
  private livesTxt!: Phaser.GameObjects.Text
  private scoreTxt!: Phaser.GameObjects.Text

  constructor() {
    super({ key: SCENE.HUD })
  }

  create(data: HUDInit) {
    // Top bar med semi-transparent baggrund
    this.add.rectangle(GAME_WIDTH / 2, 30, GAME_WIDTH, 60, 0x0f1923, 0.7).setOrigin(0.5)

    // Level navn (centreret)
    this.add.text(GAME_WIDTH / 2, 30, data.level, {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#F5A623',
    }).setOrigin(0.5)

    // Lives (venstre)
    this.livesTxt = this.add.text(20, 30, this.formatLives(data.lives), {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '24px',
      color: '#FF5470',
    }).setOrigin(0, 0.5)

    // Score (højre)
    this.scoreTxt = this.add.text(GAME_WIDTH - 20, 30, this.formatScore(data.score), {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#FFFFFF',
    }).setOrigin(1, 0.5)

    // Lyt til events fra parent scene
    const level = this.scene.get(SCENE.LEVEL1)
    level.events.on('score', (s: number) => this.scoreTxt.setText(this.formatScore(s)))
    level.events.on('lives', (l: number) => this.livesTxt.setText(this.formatLives(l)))

    // ESC-hint
    this.add.text(GAME_WIDTH / 2, 70, 'ESC = menu', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#5a6a75',
    }).setOrigin(0.5)
  }

  private formatLives(n: number): string {
    return '♥'.repeat(n) + '♡'.repeat(Math.max(0, 3 - n))
  }

  private formatScore(s: number): string {
    return `SCORE ${s.toLocaleString('da-DK')}`
  }
}
