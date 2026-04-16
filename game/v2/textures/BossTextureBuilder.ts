import Phaser from 'phaser'
import { ASSET } from '../constants'

/**
 * BossTextureBuilder — boss-sprites til V2's levels.
 *
 * Level 1: Surtr — ildjætte m. økse og Porsche-emblem som gravering (Easter egg)
 */
export class BossTextureBuilder {
  static buildAll(scene: Phaser.Scene) {
    this.makeSurtr(scene)
    this.makeSurtrRock(scene)
  }

  // ========== Surtr (Moserne boss) ==========
  private static makeSurtr(scene: Phaser.Scene) {
    const W = 90
    const H = 120
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Skygge
    g.fillStyle(0x000000, 0.45)
    g.fillEllipse(W / 2, H - 3, 60, 8)

    // Ben (mørk rød, muskuløs)
    g.fillStyle(0x6a1818, 1)
    g.fillRoundedRect(22, 82, 16, 32, 3)
    g.fillRoundedRect(52, 82, 16, 32, 3)
    // Fødder (jern-støvler)
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(18, 108, 22, 8, 2)
    g.fillRoundedRect(50, 108, 22, 8, 2)

    // Krop (mørk rød rustning m. guld)
    g.fillStyle(0x8a2020, 1)
    g.fillRoundedRect(14, 40, 62, 50, 8)
    // Guld-kant
    g.fillStyle(0xaa8030, 1)
    g.fillRect(14, 42, 62, 4)
    g.fillRect(14, 84, 62, 4)
    // Rustplader
    g.fillStyle(0x6a1818, 1)
    g.fillRoundedRect(22, 48, 22, 16, 3)
    g.fillRoundedRect(46, 48, 22, 16, 3)
    // Guld-krystal i midten (boss-symbol)
    g.fillStyle(0xf5a623, 1)
    g.fillTriangle(45, 66, 38, 76, 52, 76)
    g.fillStyle(0xffd700, 1)
    g.fillTriangle(45, 68, 40, 74, 50, 74)

    // Arme
    g.fillStyle(0x6a1818, 1)
    g.fillRoundedRect(4, 44, 14, 42, 5)
    g.fillRoundedRect(72, 44, 14, 42, 5)
    // Håndled-bånd (guld)
    g.fillStyle(0xaa8030, 1)
    g.fillRect(4, 78, 14, 4)
    g.fillRect(72, 78, 14, 4)

    // ØKSEBLAD (højre hånd, stor brutal)
    // Skaft
    g.fillStyle(0x3a2010, 1)
    g.fillRoundedRect(80, 30, 4, 60, 1)
    // Blad — fremstiller det som en tung middelalder-økse
    g.fillStyle(0xc0c0c0, 1)
    g.fillTriangle(80, 36, 96, 24, 96, 48)
    g.fillStyle(0xa0a0a0, 1)
    g.fillTriangle(82, 36, 94, 28, 94, 44)
    // PORSCHE-EMBLEM som gravering (Easter egg — lille rød cirkel med hest-silhouette)
    g.fillStyle(0x1a1a1a, 1)
    g.fillCircle(88, 36, 3)
    g.fillStyle(0xc41e3a, 0.9)
    g.fillCircle(88, 36, 2)
    // Minimal hest-silhouette
    g.fillStyle(0xffd700, 1)
    g.fillRect(87, 35, 2, 1)
    g.fillRect(88, 34, 1, 1)

    // Hoved (ildjætte — skævt og hornet)
    g.fillStyle(0x6a1818, 1)
    g.fillCircle(W / 2, 26, 18)
    // Skygge-side
    g.fillStyle(0x4a0808, 1)
    g.fillCircle(W / 2 - 4, 28, 15)

    // HORN (store, gule)
    g.fillStyle(0xaa8030, 1)
    g.fillTriangle(30, 14, 22, -2, 36, 10)
    g.fillTriangle(60, 14, 68, -2, 54, 10)
    g.fillStyle(0xd4a040, 1)
    g.fillTriangle(32, 12, 26, 2, 36, 10)
    g.fillTriangle(58, 12, 64, 2, 54, 10)

    // Øjne (ildrøde, glødende)
    g.fillStyle(0x400000, 1)
    g.fillCircle(38, 26, 4)
    g.fillCircle(52, 26, 4)
    g.fillStyle(0xff3010, 1)
    g.fillCircle(38, 26, 2.5)
    g.fillCircle(52, 26, 2.5)
    g.fillStyle(0xffff80, 0.9)
    g.fillCircle(38.5, 25.5, 1)
    g.fillCircle(52.5, 25.5, 1)

    // Skæg (sort, langt, vildt)
    g.fillStyle(0x0a0a0a, 1)
    g.fillRoundedRect(28, 32, 34, 14, 5)
    g.fillTriangle(30, 42, 45, 50, 60, 42)
    // Mund (tænder)
    g.fillStyle(0x400000, 1)
    g.fillRoundedRect(38, 36, 14, 4, 1)
    g.fillStyle(0xf0e0c0, 1)
    g.fillTriangle(40, 36, 41, 39, 42, 36)
    g.fillTriangle(44, 36, 45, 39, 46, 36)
    g.fillTriangle(48, 36, 49, 39, 50, 36)

    // Ild-aura ud af hovedet (rødgule strøg)
    g.fillStyle(0xff6020, 0.4)
    g.fillCircle(W / 2, 20, 24)

    g.generateTexture(ASSET.TEX_SURTR, W, H)
    g.destroy()
  }

  // ========== Surtr's sten (phase-2 projektil) ==========
  private static makeSurtrRock(scene: Phaser.Scene) {
    const s = 20
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    // Glødende sten (mørkgrå m. rød sprække)
    g.fillStyle(0x3a2a20, 1)
    g.fillCircle(s / 2, s / 2, 9)
    g.fillStyle(0x5a3a28, 1)
    g.fillCircle(s / 2 - 2, s / 2 - 2, 5)
    // Glødende sprække
    g.fillStyle(0xff4020, 1)
    g.fillRect(s / 2 - 4, s / 2, 8, 1)
    g.fillRect(s / 2 - 2, s / 2 + 2, 5, 1)
    // Ild-aura
    g.fillStyle(0xff6020, 0.3)
    g.fillCircle(s / 2, s / 2, 10)
    g.generateTexture(ASSET.TEX_SURTR_ROCK, s, s)
    g.destroy()
  }
}
