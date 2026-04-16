import Phaser from 'phaser'
import { ASSET } from '../constants'

/**
 * ItemTextureBuilder — procedurelle teksturer til pickups og miljø-items.
 *
 * - Beer (Carlsberg-lignende ølflaske m. glow)
 * - Scroll (Jim's pergament)
 * - Jim-crow (Huginn-krage-variant som flyver ind med scroll)
 */
export class ItemTextureBuilder {
  static buildAll(scene: Phaser.Scene) {
    this.makeBeer(scene)
    this.makeScroll(scene)
    this.makeJimCrow(scene)
    this.makeGround(scene)
    this.makePlatform(scene)
  }

  // ========== Øl-flaske (detaljeret) ==========
  private static makeBeer(scene: Phaser.Scene) {
    const W = 28
    const H = 38
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Glow (gylden aura)
    g.fillStyle(0xf5a623, 0.3)
    g.fillCircle(W / 2, H / 2, 16)
    g.fillStyle(0xffd700, 0.2)
    g.fillCircle(W / 2, H / 2, 12)

    // Flaske-krop (mørk rav)
    g.fillStyle(0x5a3010, 1)
    g.fillRoundedRect(7, 10, 14, 24, 3)
    // Højlys
    g.fillStyle(0x8a5020, 1)
    g.fillRect(9, 12, 2, 20)

    // Hals
    g.fillStyle(0x4a2810, 1)
    g.fillRoundedRect(10, 4, 8, 8, 2)

    // Kapsel (sølv)
    g.fillStyle(0xc0c0c0, 1)
    g.fillRoundedRect(9, 2, 10, 4, 1)
    g.fillStyle(0x808080, 1)
    g.fillRect(9, 5, 10, 1)

    // Etiket (Carlsberg-grøn)
    g.fillStyle(0x0a5a3a, 1)
    g.fillRoundedRect(7, 16, 14, 12, 2)
    // Tekst-detalje (hvid)
    g.fillStyle(0xffffff, 1)
    g.fillRect(9, 18, 10, 1)
    g.fillRect(10, 22, 8, 1)
    g.fillRect(9, 25, 10, 1)

    // Refleksglimt
    g.fillStyle(0xffffff, 0.6)
    g.fillRect(11, 12, 1, 20)

    g.generateTexture(ASSET.TEX_BEER, W, H)
    g.destroy()
  }

  // ========== Scroll (Jim's pergament) ==========
  private static makeScroll(scene: Phaser.Scene) {
    const W = 34
    const H = 28
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Scroll-ruller (mørk brun)
    g.fillStyle(0x4a2810, 1)
    g.fillRoundedRect(0, 4, 6, 22, 2)
    g.fillRoundedRect(28, 4, 6, 22, 2)

    // Papir
    g.fillStyle(0xe8d8a0, 1)
    g.fillRect(6, 6, 22, 18)
    // Skygge
    g.fillStyle(0xc8b880, 1)
    g.fillRect(6, 22, 22, 2)

    // Tekst-linjer
    g.fillStyle(0x2a1810, 1)
    g.fillRect(9, 10, 16, 1)
    g.fillRect(9, 14, 13, 1)
    g.fillRect(9, 18, 15, 1)

    // Rødt segl
    g.fillStyle(0xc41e3a, 1)
    g.fillCircle(26, 20, 3)
    g.fillStyle(0x800000, 1)
    g.fillCircle(26, 20, 1.5)

    g.generateTexture(ASSET.TEX_SCROLL, W, H)
    g.destroy()
  }

  // ========== Jim-crow (samme som Huginn men lidt større + gult halsbånd) ==========
  private static makeJimCrow(scene: Phaser.Scene) {
    const W = 52
    const H = 42
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Krop (sort)
    g.fillStyle(0x0a0a0a, 1)
    g.fillEllipse(W / 2, 22, 34, 22)

    // Vinger (mere udbredt)
    g.fillStyle(0x1a1a1a, 1)
    g.fillTriangle(4, 14, 24, 8, 22, 30)
    g.fillTriangle(30, 8, 48, 18, 30, 24)

    // Hoved
    g.fillStyle(0x0a0a0a, 1)
    g.fillCircle(42, 18, 8)

    // Næb
    g.fillStyle(0xf5a623, 1)
    g.fillTriangle(48, 16, 52, 18, 48, 20)

    // Øjne (gul — mere wise Huginn-vibe)
    g.fillStyle(0xffd700, 1)
    g.fillCircle(44, 16, 2)
    g.fillStyle(0x000000, 1)
    g.fillCircle(44, 16, 1)

    // Halsbånd (orange — Jim-ref)
    g.fillStyle(0xf5a623, 1)
    g.fillRect(34, 24, 10, 2)
    // Lille dalmatiner-plet på halsbåndet
    g.fillStyle(0x000000, 1)
    g.fillCircle(37, 25, 0.8)
    g.fillCircle(41, 25, 0.8)

    // Skygge
    g.fillStyle(0x000000, 0.25)
    g.fillEllipse(W / 2, H - 2, 28, 5)

    g.generateTexture(ASSET.TEX_JIM_CROW, W, H)
    g.destroy()
  }

  // ========== Ground (mose-jord) ==========
  private static makeGround(scene: Phaser.Scene) {
    const W = 64
    const H = 40
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Dybt mudder (mørkere ned)
    g.fillStyle(0x1a2818, 1)
    g.fillRect(0, 0, W, H)
    // Top — mørkere grøn mos
    g.fillStyle(0x2a4a1c, 1)
    g.fillRect(0, 0, W, 10)
    g.fillStyle(0x3a5a28, 1)
    g.fillRect(0, 0, W, 4)

    // Græs-tufts på toppen
    g.fillStyle(0x4a6a30, 1)
    for (let i = 0; i < W; i += 6) {
      g.fillTriangle(i, 4, i + 2, 0, i + 4, 4)
    }

    // Små sten nedsunkne
    g.fillStyle(0x3a3a3a, 1)
    g.fillCircle(12, 20, 2)
    g.fillCircle(38, 28, 2.5)
    g.fillCircle(54, 18, 1.5)
    // Skygger
    g.fillStyle(0x1a1a1a, 1)
    g.fillCircle(13, 21, 1)
    g.fillCircle(39, 29, 1.2)

    // Dybe skygger til venstre/højre så tiles flyder sammen
    g.fillStyle(0x0a1408, 0.5)
    g.fillRect(0, 10, 2, H - 10)
    g.fillRect(W - 2, 10, 2, H - 10)

    g.generateTexture(ASSET.TEX_GROUND, W, H)
    g.destroy()
  }

  // ========== Platform (rådden træstamme) ==========
  private static makePlatform(scene: Phaser.Scene) {
    const W = 120
    const H = 24
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Basis-træ
    g.fillStyle(0x3a2818, 1)
    g.fillRoundedRect(0, 0, W, H, 4)
    // Bark-top (lysere)
    g.fillStyle(0x5a3a22, 1)
    g.fillRoundedRect(0, 0, W, 6, 4)
    // Top-linje
    g.fillStyle(0x7a5230, 1)
    g.fillRect(2, 2, W - 4, 2)

    // Mos på toppen
    g.fillStyle(0x3a6a20, 1)
    for (let i = 6; i < W - 6; i += 14) {
      g.fillEllipse(i, 1, 6, 3)
    }

    // Bark-striber (lodrette)
    g.lineStyle(1, 0x1a0f08, 0.6)
    for (let i = 10; i < W; i += 18) {
      g.lineBetween(i, 6, i, H - 2)
    }

    // Huller/skader
    g.fillStyle(0x0a0500, 1)
    g.fillCircle(30, 14, 2)
    g.fillCircle(80, 10, 1.5)
    g.fillCircle(100, 16, 2)

    g.generateTexture(ASSET.TEX_PLATFORM, W, H)
    g.destroy()
  }
}
