import Phaser from 'phaser'
import { ASSET } from '../constants'

/**
 * ParticleTextureBuilder — små procedurale teksturer til partikel-systemer.
 *
 * Alle partikler er tiny (4-12px) så de kan genbruges af Phaser's ParticleEmitter
 * med forskellig tint/alpha/scale pr. biome.
 */
export class ParticleTextureBuilder {
  static buildAll(scene: Phaser.Scene) {
    this.makeMist(scene)
    this.makeLeaf(scene)
    this.makeRain(scene)
    this.makeEmber(scene)
    this.makeFirefly(scene)
    this.makeStar(scene)
    this.makeDot(scene)
    this.makeGold(scene)
  }

  // Diffus grå-grøn pyt (Moserne)
  private static makeMist(scene: Phaser.Scene) {
    const s = 24
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 0.18)
    g.fillCircle(s / 2, s / 2, 10)
    g.fillStyle(0xffffff, 0.35)
    g.fillCircle(s / 2, s / 2, 6)
    g.fillStyle(0xffffff, 0.6)
    g.fillCircle(s / 2, s / 2, 3)
    g.generateTexture(ASSET.TEX_P_MIST, s, s)
    g.destroy()
  }

  // Lille blad (til skov-levels)
  private static makeLeaf(scene: Phaser.Scene) {
    const W = 10
    const H = 12
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillEllipse(W / 2, H / 2, W, H)
    g.generateTexture(ASSET.TEX_P_LEAF, W, H)
    g.destroy()
  }

  // Regn-dråbe (lodret)
  private static makeRain(scene: Phaser.Scene) {
    const W = 2
    const H = 10
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, W, H)
    g.generateTexture(ASSET.TEX_P_RAIN, W, H)
    g.destroy()
  }

  // Glødende ember (ildlevel)
  private static makeEmber(scene: Phaser.Scene) {
    const s = 8
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xff8833, 0.4)
    g.fillCircle(s / 2, s / 2, 4)
    g.fillStyle(0xffaa33, 0.7)
    g.fillCircle(s / 2, s / 2, 2.5)
    g.fillStyle(0xffff88, 1)
    g.fillCircle(s / 2, s / 2, 1.5)
    g.generateTexture(ASSET.TEX_P_EMBER, s, s)
    g.destroy()
  }

  // Ildflue (grøngul glow)
  private static makeFirefly(scene: Phaser.Scene) {
    const s = 6
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xccff88, 0.4)
    g.fillCircle(s / 2, s / 2, 3)
    g.fillStyle(0xffff88, 1)
    g.fillCircle(s / 2, s / 2, 1.5)
    g.generateTexture(ASSET.TEX_P_FIREFLY, s, s)
    g.destroy()
  }

  // Stjerne (pickup-burst)
  private static makeStar(scene: Phaser.Scene) {
    const s = 12
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    const cx = s / 2, cy = s / 2
    // 4-takket stjerne
    g.fillTriangle(cx, 0, cx - 1.5, cy - 1.5, cx + 1.5, cy - 1.5)
    g.fillTriangle(cx, s, cx - 1.5, cy + 1.5, cx + 1.5, cy + 1.5)
    g.fillTriangle(0, cy, cx - 1.5, cy - 1.5, cx - 1.5, cy + 1.5)
    g.fillTriangle(s, cy, cx + 1.5, cy - 1.5, cx + 1.5, cy + 1.5)
    g.fillCircle(cx, cy, 2)
    g.generateTexture(ASSET.TEX_P_STAR, s, s)
    g.destroy()
  }

  // Generisk prik
  private static makeDot(scene: Phaser.Scene) {
    const s = 6
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(s / 2, s / 2, s / 2)
    g.generateTexture(ASSET.TEX_P_DOT, s, s)
    g.destroy()
  }

  // Guldpartikel (boss-death)
  private static makeGold(scene: Phaser.Scene) {
    const s = 10
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffd700, 0.7)
    g.fillCircle(s / 2, s / 2, 5)
    g.fillStyle(0xffff88, 1)
    g.fillCircle(s / 2, s / 2, 2)
    g.generateTexture(ASSET.TEX_P_GOLD, s, s)
    g.destroy()
  }
}
