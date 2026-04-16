import Phaser from 'phaser'
import { ASSET, GAME_HEIGHT, GAME_WIDTH, SCENE } from '../constants'
import { BossTextureBuilder } from '../textures/BossTextureBuilder'
import { EnemyTextureBuilder } from '../textures/EnemyTextureBuilder'
import { ItemTextureBuilder } from '../textures/ItemTextureBuilder'
import { LarsTextureBuilder } from '../textures/LarsTextureBuilder'
import { ParticleTextureBuilder } from '../textures/ParticleTextureBuilder'

/**
 * PreloadScene: indlæser alle assets + genererer procedurale teksturer.
 *
 * Strategi:
 * - Eksisterende parallax-baggrunde fra V1 genbruges (i public/images/valhalla)
 * - Lars, fjender, boss, items, partikler genereres procedurelt via
 *   TextureBuilders (Phaser Graphics → snapshots)
 * - Alt er klar FØR MenuScene starter, så ingen scene skal vente
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.PRELOAD })
  }

  preload() {
    // Visuel progress feedback
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2
    const barW = 480
    const barH = 14

    this.add.rectangle(cx, cy - 60, GAME_WIDTH, GAME_HEIGHT, 0x0f1923).setOrigin(0.5)

    this.add.text(cx, cy - 80, 'LARS LADER OP...', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '24px',
      color: '#F5A623',
    }).setOrigin(0.5)

    const barBg = this.add.rectangle(cx, cy, barW, barH, 0x1a2530).setStrokeStyle(2, 0xf5a623)
    const barFill = this.add.rectangle(cx - barW / 2 + 2, cy, 0, barH - 4, 0xf5a623).setOrigin(0, 0.5)
    void barBg

    const pct = this.add.text(cx, cy + 30, '0%', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '16px',
      color: '#7A8A95',
    }).setOrigin(0.5)

    this.load.on('progress', (v: number) => {
      barFill.width = (barW - 4) * v
      pct.setText(`${Math.round(v * 100)}%`)
    })

    // Faktiske billedefiler
    this.load.image(ASSET.BG_FAR_L1, '/images/valhalla/level1-bg-far.jpg')
    this.load.image(ASSET.BG_MID_L1, '/images/valhalla/level1-bg-mid.jpg')
    this.load.image(ASSET.BG_NEAR_L1, '/images/valhalla/level1-bg-near.jpg')
  }

  create() {
    // Procedurale teksturer
    LarsTextureBuilder.buildAll(this)
    ItemTextureBuilder.buildAll(this) // inkluderer ground + platform
    EnemyTextureBuilder.buildAll(this)
    BossTextureBuilder.buildAll(this)
    ParticleTextureBuilder.buildAll(this)

    this.scene.start(SCENE.MENU)
  }
}
