import Phaser from 'phaser'
import { COLORS, DEPTH, GAME_WIDTH, SCENE, STAGE_NAMES } from '../constants'

interface HUDEvent {
  score: number
  combo: number
  followers: number
  vikingMeter: number
  stageIndex: number
}

interface JudgeEvent {
  judge: 'perfect' | 'great' | 'good' | 'miss'
  x: number
  type: 'arrow' | 'beer'
}

/**
 * HUDScene — overlay på GameScene. Viser score, combo, followers, viking-meter
 * og judgement-popups over receptorerne.
 *
 * Den er sin egen scene (ikke del af GameScene) så den ikke påvirkes af
 * camera shake/fade og sidder stabilt øverst.
 */
export class HUDScene extends Phaser.Scene {
  private scoreLabel!: Phaser.GameObjects.Text
  private comboLabel!: Phaser.GameObjects.Text
  private followersLabel!: Phaser.GameObjects.Text
  private stageLabel!: Phaser.GameObjects.Text
  private meterBar!: Phaser.GameObjects.Rectangle
  private meterBarBg!: Phaser.GameObjects.Rectangle
  private exitBtn!: Phaser.GameObjects.Text

  private lastScore = 0

  private onRetry?: () => void
  private onExit?: () => void

  constructor() {
    super({ key: SCENE.HUD })
  }

  init(data: { onRetry?: () => void; onExit?: () => void }) {
    this.onRetry = data.onRetry
    this.onExit = data.onExit
  }

  create() {
    // Top-left: Score
    this.scoreLabel = this.add
      .text(24, 18, '0', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '40px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.HUD)
      .setStroke('#0a0a12', 4)
    this.add
      .text(24, 62, 'SCORE', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: '#7a8a95',
        fontStyle: 'bold',
      })
      .setDepth(DEPTH.HUD)

    // Top-center: Combo
    this.comboLabel = this.add
      .text(GAME_WIDTH / 2, 20, '', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '46px',
        color: '#ffd447',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.HUD)
      .setStroke('#0a0a12', 5)

    // Top-right: Followers + Stage
    this.followersLabel = this.add
      .text(GAME_WIDTH - 24, 18, '0', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '34px',
        color: '#ff9ac2',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD)
      .setStroke('#0a0a12', 4)
    this.add
      .text(GAME_WIDTH - 24, 56, 'FØLGERE', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: '#7a8a95',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD)

    this.stageLabel = this.add
      .text(GAME_WIDTH - 24, 74, STAGE_NAMES[0].toUpperCase(), {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        color: '#ffd447',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.HUD)

    // Viking meter (under følgere)
    this.meterBarBg = this.add
      .rectangle(GAME_WIDTH - 24, 98, 180, 12, 0x1a1a2a)
      .setOrigin(1, 0)
      .setStrokeStyle(1, 0xffffff, 0.3)
      .setDepth(DEPTH.HUD)
    this.meterBar = this.add
      .rectangle(GAME_WIDTH - 24 - 179, 99, 0, 10, COLORS.LARS_TATTOO_GLOW)
      .setOrigin(0, 0)
      .setDepth(DEPTH.HUD)

    // Exit button (top-left small X)
    this.exitBtn = this.add
      .text(GAME_WIDTH / 2, 76, '[ ESC ]', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#7a8a95',
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.HUD)
      .setInteractive({ useHandCursor: true })
    this.exitBtn.on('pointerdown', () => this.onExit?.())

    this.input.keyboard?.on('keydown-ESC', () => this.onExit?.())

    // Lyt på GameScene events
    const game = this.scene.get(SCENE.GAME)
    game.events.on('tv-hud', (data: HUDEvent) => this.applyState(data))
    game.events.on('tv-judgement', (data: JudgeEvent) => this.showJudgement(data))
    game.events.on('tv-stage', () => {
      // Handled via stateUpdate when stageIndex changes
    })

    // Ryd op når scenen dør
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      game.events.off('tv-hud')
      game.events.off('tv-judgement')
      game.events.off('tv-stage')
    })
  }

  private applyState(data: HUDEvent) {
    // Score ticker (animerer mellem lastScore og nye score)
    const target = data.score
    if (target !== this.lastScore) {
      this.tweens.addCounter({
        from: this.lastScore,
        to: target,
        duration: 220,
        onUpdate: tw => {
          const v = tw.getValue() ?? 0
          this.scoreLabel.setText(String(Math.floor(v)).padStart(6, '0'))
        },
      })
      this.lastScore = target
    }

    // Combo
    if (data.combo >= 5) {
      this.comboLabel.setText(`${data.combo}x`)
      this.comboLabel.setScale(1)
      this.tweens.add({
        targets: this.comboLabel,
        scale: { from: 1.25, to: 1 },
        duration: 140,
        ease: 'Cubic.out',
      })
    } else if (data.combo === 0) {
      this.comboLabel.setText('')
    } else {
      this.comboLabel.setText(`${data.combo}`)
    }

    // Followers
    this.followersLabel.setText(String(data.followers))

    // Stage
    this.stageLabel.setText(STAGE_NAMES[data.stageIndex].toUpperCase())

    // Meter
    const width = Math.max(0, Math.min(1, data.vikingMeter / 100)) * 178
    this.tweens.add({ targets: this.meterBar, width, duration: 220, ease: 'Cubic.out' })
    // Ændr farve ved fyldt
    if (data.vikingMeter >= 100) {
      this.meterBar.setFillStyle(COLORS.LANE_BEER)
    } else {
      this.meterBar.setFillStyle(COLORS.LARS_TATTOO_GLOW)
    }
  }

  private showJudgement(data: JudgeEvent) {
    const labels: Record<JudgeEvent['judge'], { text: string; color: string }> = {
      perfect: { text: 'PERFECT', color: '#ffd447' },
      great: { text: 'GREAT', color: '#4de0a1' },
      good: { text: 'GOOD', color: '#5ec8ff' },
      miss: { text: 'MISS', color: '#ff3b6b' },
    }
    const { text, color } = labels[data.judge]
    const y = 560
    const t = this.add
      .text(data.x, y, text, {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: data.type === 'beer' ? '22px' : '20px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD)
      .setStroke('#0a0a12', 4)
    this.tweens.add({
      targets: t,
      y: y - 50,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    })
  }
}
