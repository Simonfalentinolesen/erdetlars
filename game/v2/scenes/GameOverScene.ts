import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../constants'

interface GameOverInit {
  won: boolean
  score: number
}

/**
 * GameOverScene: viser slut-resultat (vundet/tabt) + score, og lader spilleren
 * vælge "spil igen" eller "tilbage til menu".
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.GAMEOVER })
  }

  create(data: GameOverInit) {
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x0f1923)
    this.cameras.main.fadeIn(400, 0, 0, 0)

    // Hovedtekst
    const title = data.won ? 'VALHALLA NÆRMER SIG' : 'LARS FALDT...'
    const subtitle = data.won
      ? 'Du klarede Moserne. Næste level kommer snart.'
      : 'Mosedraugerne tog dig. Prøv igen, viking.'
    const titleColor = data.won ? '#F5A623' : '#FF5470'

    this.add.text(cx, cy - 140, title, {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: titleColor,
    }).setOrigin(0.5)

    this.add.text(cx, cy - 70, subtitle, {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '18px',
      color: '#7A8A95',
    }).setOrigin(0.5)

    // Score
    this.add.text(cx, cy - 10, 'DIN SCORE', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '18px',
      color: '#7A8A95',
    }).setOrigin(0.5)

    this.add.text(cx, cy + 60, data.score.toLocaleString('da-DK'), {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '96px',
      fontStyle: 'bold',
      color: '#FFFFFF',
    }).setOrigin(0.5)

    // Knapper
    this.makeButton(cx, cy + 170, 'SPIL IGEN', 0xf5a623, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENE.LEVEL1))
    })

    this.makeButton(cx, cy + 230, 'TIL MENU', 0x1a2530, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENE.MENU))
    })
  }

  private makeButton(x: number, y: number, label: string, color: number, onClick: () => void) {
    const w = 280
    const h = 50
    const bg = this.add.rectangle(x, y, w, h, color)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true })
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: color === 0xf5a623 ? '#0F1923' : '#FFFFFF',
    }).setOrigin(0.5)

    bg.on('pointerover', () => bg.setScale(1.05))
    bg.on('pointerout', () => bg.setScale(1))
    bg.on('pointerdown', () => {
      bg.setScale(0.95)
      txt.setScale(0.95)
      this.time.delayedCall(80, onClick)
    })
  }
}
