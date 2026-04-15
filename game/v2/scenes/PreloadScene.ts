import Phaser from 'phaser'
import { ASSET, GAME_HEIGHT, GAME_WIDTH, SCENE } from '../constants'

/**
 * PreloadScene: indlæser alle assets med visuel progress-bar.
 *
 * Strategi:
 * - Eksisterende parallax-baggrunde fra V1 genbruges (allerede i public/images/valhalla)
 * - Lars og fjender genereres procedurelt i Graphics → texture (ingen sprite-art nødvendigt)
 *   Det er hurtigt, kompakt, og matcher V1's visuelle stil
 * - Når alt er klar, starter MenuScene
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

    const pct = this.add.text(cx, cy + 30, '0%', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '16px',
      color: '#7A8A95',
    }).setOrigin(0.5)

    this.load.on('progress', (v: number) => {
      barFill.width = (barW - 4) * v
      pct.setText(`${Math.round(v * 100)}%`)
    })

    // Faktiske assets — kun det vi behøver til Level 1
    this.load.image(ASSET.BG_FAR_L1, '/images/valhalla/level1-bg-far.jpg')
    this.load.image(ASSET.BG_MID_L1, '/images/valhalla/level1-bg-mid.jpg')
    this.load.image(ASSET.BG_NEAR_L1, '/images/valhalla/level1-bg-near.jpg')
  }

  create() {
    // Generér procedurelle textures via Graphics → texture
    this.makeLarsTexture()
    this.makeGroundTexture()
    this.makePlatformTexture()
    this.makeBeerTexture()
    this.makeMoseDraugerTexture()

    this.scene.start(SCENE.MENU)
  }

  // ---------- Procedural textures ----------

  /**
   * Lars: 42x56px sprite med beanie, skæg, solbriller, krop.
   * Tegnes til en Graphics, dernæst snapshottet som texture.
   */
  private makeLarsTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const W = 42
    const H = 56

    // Skygge under fødder
    g.fillStyle(0x000000, 0.3)
    g.fillEllipse(W / 2, H - 2, 24, 4)

    // Krop (sort jakke)
    g.fillStyle(0x1a1a1a, 1)
    g.fillRoundedRect(8, 24, 26, 24, 4)

    // Hoved (skin)
    g.fillStyle(0xf2c4a0, 1)
    g.fillRoundedRect(11, 6, 20, 22, 6)

    // Beanie (orange/accent)
    g.fillStyle(0xf5a623, 1)
    g.fillRoundedRect(10, 2, 22, 10, 4)
    g.fillStyle(0xd4881c, 1)
    g.fillRect(10, 10, 22, 2)

    // Skæg (mørk)
    g.fillStyle(0x3a2818, 1)
    g.fillRoundedRect(12, 18, 18, 10, 3)

    // Solbriller (sort)
    g.fillStyle(0x000000, 1)
    g.fillRoundedRect(11, 14, 20, 5, 2)

    // Hånd (højre, holder kølle/økse-position)
    g.fillStyle(0xf2c4a0, 1)
    g.fillCircle(36, 32, 4)

    g.generateTexture(ASSET.TEX_LARS, W, H)
    g.destroy()
  }

  private makeGroundTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const W = 64
    const H = 32
    // Mose-grøn ground
    g.fillStyle(0x1d3826, 1)
    g.fillRect(0, 0, W, H)
    g.fillStyle(0x2a5238, 1)
    g.fillRect(0, 0, W, 6)
    g.lineStyle(1, 0x122418, 0.5)
    for (let i = 0; i < W; i += 8) g.lineBetween(i, 6, i, H)
    g.generateTexture(ASSET.TEX_GROUND, W, H)
    g.destroy()
  }

  private makePlatformTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const W = 96
    const H = 20
    g.fillStyle(0x4a3520, 1)
    g.fillRoundedRect(0, 0, W, H, 4)
    g.fillStyle(0x6b4f30, 1)
    g.fillRoundedRect(0, 0, W, 6, 4)
    g.generateTexture(ASSET.TEX_PLATFORM, W, H)
    g.destroy()
  }

  private makeBeerTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const W = 26
    const H = 32
    // Glas
    g.fillStyle(0x8b5a2b, 0.8)
    g.fillRoundedRect(4, 8, 18, 22, 3)
    // Skum
    g.fillStyle(0xfff5d6, 1)
    g.fillRoundedRect(4, 4, 18, 8, 3)
    // Hank
    g.lineStyle(3, 0x8b5a2b, 1)
    g.strokeCircle(24, 18, 5)
    // Glow
    g.fillStyle(0xf5a623, 0.4)
    g.fillCircle(W / 2, H / 2, 14)
    g.generateTexture(ASSET.TEX_BEER, W, H)
    g.destroy()
  }

  private makeMoseDraugerTexture() {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const W = 38
    const H = 50
    // Krop — algegrøn
    g.fillStyle(0x3a5a2a, 1)
    g.fillRoundedRect(6, 18, 26, 28, 4)
    // Hoved
    g.fillStyle(0x4a6a3a, 1)
    g.fillCircle(W / 2, 12, 10)
    // Røde øjne (creepy)
    g.fillStyle(0xff3030, 1)
    g.fillCircle(15, 11, 2)
    g.fillCircle(23, 11, 2)
    // Mosklædning detaljer
    g.fillStyle(0x2a4a1a, 1)
    g.fillRect(8, 30, 22, 3)
    g.fillRect(10, 38, 18, 2)
    g.generateTexture(ASSET.TEX_MOSE_DRAUGER, W, H)
    g.destroy()
  }
}
