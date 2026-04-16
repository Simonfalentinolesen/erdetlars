import Phaser from 'phaser'
import { ASSET } from '../constants'

/**
 * EnemyTextureBuilder — procedurelt genererede fjende-sprites til Level 1.
 *
 * 3 distinkte typer så Moserne ikke føles ensformige:
 * - mose-drauger (patrol på jord): algegrøn muskuløs sump-draugr
 * - fenris-hvalp (hurtig patrol): lille ulvehvalp m. Jim-dalmatinermønster (Easter egg)
 * - huginn-krage (flyver i sinus): sort fugl med røde Celtic-tegn (Jim-ref)
 *
 * Alle er antialiased, 2-frame walk hvor relevant.
 */
export class EnemyTextureBuilder {
  static buildAll(scene: Phaser.Scene) {
    this.makeDrauger(scene, ASSET.TEX_MOSE_DRAUGER, 'a')
    this.makeDrauger(scene, ASSET.TEX_MOSE_DRAUGER_B, 'b')
    this.makeFenrisHvalp(scene)
    this.makeHuginnKrage(scene)
  }

  // ========== Mose-drauger ==========
  private static makeDrauger(scene: Phaser.Scene, key: string, frame: 'a' | 'b') {
    const W = 44
    const H = 58
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    const legOff = frame === 'a' ? 1 : -1

    // Skygge
    g.fillStyle(0x000000, 0.35)
    g.fillEllipse(W / 2, H - 2, 32, 5)

    // Ben (muddergrønne) — med variation pr. frame
    g.fillStyle(0x1d3a1a, 1)
    g.fillRoundedRect(11 - legOff, 42, 8, 14, 2)
    g.fillRoundedRect(25 + legOff, 42, 8, 14, 2)
    // "Støvler" af mudder
    g.fillStyle(0x0a1a08, 1)
    g.fillRoundedRect(10 - legOff, 53, 10, 3, 1)
    g.fillRoundedRect(24 + legOff, 53, 10, 3, 1)

    // Krop — algegrøn, muskuløs
    g.fillStyle(0x3a5a2a, 1)
    g.fillRoundedRect(6, 22, 32, 24, 6)
    // Muskel-skygger
    g.fillStyle(0x2a4a1c, 1)
    g.fillRoundedRect(8, 32, 12, 10, 3)
    g.fillRoundedRect(24, 32, 12, 10, 3)

    // Mosklædning der hænger ned fra kroppen
    g.fillStyle(0x1a3010, 1)
    g.fillRect(6, 40, 4, 8)
    g.fillRect(14, 42, 3, 7)
    g.fillRect(26, 42, 3, 7)
    g.fillRect(34, 40, 4, 8)

    // Arme
    g.fillStyle(0x3a5a2a, 1)
    g.fillRoundedRect(2, 24, 7, 20, 3)
    g.fillRoundedRect(35, 24, 7, 20, 3)
    // Kløer (grå)
    g.fillStyle(0x8a8a7a, 1)
    g.fillTriangle(2, 42, 5, 48, 8, 42)
    g.fillTriangle(35, 42, 38, 48, 41, 42)

    // Hoved (mørkere grøn)
    g.fillStyle(0x4a6a3a, 1)
    g.fillRoundedRect(10, 4, 24, 22, 8)
    // Kranier-detalje på ansigt (dødt udtryk)
    g.fillStyle(0x2a4a1c, 1)
    g.fillRoundedRect(11, 14, 22, 3, 1)

    // Mund med skarpe tænder
    g.fillStyle(0x0a0a0a, 1)
    g.fillRoundedRect(14, 18, 16, 5, 2)
    g.fillStyle(0xf0e0c0, 1)
    g.fillTriangle(16, 18, 18, 23, 20, 18)
    g.fillTriangle(22, 18, 24, 23, 26, 18)
    g.fillTriangle(28, 18, 30, 23, 32, 18)

    // Røde glødende øjne
    g.fillStyle(0x400000, 1)
    g.fillCircle(16, 10, 3)
    g.fillCircle(28, 10, 3)
    g.fillStyle(0xff2030, 1)
    g.fillCircle(16, 10, 2)
    g.fillCircle(28, 10, 2)
    g.fillStyle(0xffffff, 0.8)
    g.fillCircle(16.5, 9.5, 0.8)
    g.fillCircle(28.5, 9.5, 0.8)

    // Alge/dynd-dråber der drypper
    g.fillStyle(0x2a4a1c, 0.8)
    g.fillCircle(12, 28, 1.5)
    g.fillCircle(34, 30, 1.2)
    if (frame === 'b') {
      g.fillCircle(22, 48, 1.8)
    }

    g.generateTexture(key, W, H)
    g.destroy()
  }

  // ========== Fenris-hvalp (med dalmatiner-mønster) ==========
  private static makeFenrisHvalp(scene: Phaser.Scene) {
    const W = 48
    const H = 36
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Skygge
    g.fillStyle(0x000000, 0.3)
    g.fillEllipse(W / 2, H - 2, 36, 4)

    // Krop (mørkegrå)
    g.fillStyle(0x3a3a3a, 1)
    g.fillRoundedRect(8, 14, 32, 16, 6)

    // Hoved
    g.fillStyle(0x3a3a3a, 1)
    g.fillRoundedRect(30, 10, 16, 14, 5)

    // Snude
    g.fillStyle(0x1a1a1a, 1)
    g.fillRoundedRect(42, 16, 6, 6, 2)
    // Næse
    g.fillStyle(0x000000, 1)
    g.fillCircle(46, 18, 1.5)

    // Øjne (gul/rød)
    g.fillStyle(0xffd700, 1)
    g.fillCircle(38, 15, 1.8)
    g.fillStyle(0x000000, 1)
    g.fillCircle(38, 15, 1)

    // Ører (trekanter)
    g.fillStyle(0x2a2a2a, 1)
    g.fillTriangle(32, 10, 34, 4, 36, 10)
    g.fillTriangle(40, 10, 42, 4, 44, 10)

    // Dalmatiner-pletter (JIM EASTER EGG — han har dalmatiner som hund)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(16, 18, 3)
    g.fillCircle(24, 22, 2.5)
    g.fillCircle(20, 28, 2)
    g.fillCircle(14, 24, 2)
    g.fillCircle(30, 18, 2)
    g.fillStyle(0x0a0a0a, 1)
    g.fillCircle(16, 18, 1)
    g.fillCircle(20, 28, 0.8)

    // Ben
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(10, 28, 5, 6, 1)
    g.fillRoundedRect(20, 28, 5, 6, 1)
    g.fillRoundedRect(30, 28, 5, 6, 1)

    // Hale
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(2, 14, 10, 5, 2)

    // Tunge ud (aggressiv men fjollet)
    g.fillStyle(0xff4060, 1)
    g.fillRoundedRect(44, 20, 4, 3, 1)

    g.generateTexture(ASSET.TEX_FENRIS_HVALP, W, H)
    g.destroy()
  }

  // ========== Huginn-krage (med Celtic-tegn) ==========
  private static makeHuginnKrage(scene: Phaser.Scene) {
    const W = 44
    const H = 36
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Krop (sort)
    g.fillStyle(0x0a0a0a, 1)
    g.fillEllipse(W / 2, 18, 28, 18)

    // Vinge (venstre, udbredt)
    g.fillStyle(0x1a1a1a, 1)
    g.fillTriangle(6, 14, 20, 8, 22, 24)
    g.fillStyle(0x0a0a0a, 1)
    g.fillTriangle(8, 16, 18, 12, 20, 22)
    // Røde Celtic-tegn på vingen (JIM EASTER EGG — Jim Lyngvild's tattoos)
    g.lineStyle(1, 0xc41e3a, 1)
    g.lineBetween(12, 14, 14, 16)
    g.lineBetween(14, 16, 12, 18)
    g.lineBetween(12, 18, 14, 20)
    g.fillStyle(0xc41e3a, 1)
    g.fillCircle(16, 14, 1)
    g.fillCircle(17, 19, 1)

    // Vinge (højre, tættere på krop)
    g.fillStyle(0x1a1a1a, 1)
    g.fillTriangle(26, 8, 36, 16, 26, 20)

    // Hoved (forrest)
    g.fillStyle(0x0a0a0a, 1)
    g.fillCircle(34, 14, 7)

    // Næb (sølv/orange)
    g.fillStyle(0xf5a623, 1)
    g.fillTriangle(39, 12, 44, 14, 39, 16)
    g.fillStyle(0xd4881c, 1)
    g.fillTriangle(39, 13, 43, 14, 39, 15)

    // Øjne (hvide m. rød pupil)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(36, 12, 1.8)
    g.fillStyle(0xff2030, 1)
    g.fillCircle(36, 12, 1)

    // Hale (bagved)
    g.fillStyle(0x0a0a0a, 1)
    g.fillTriangle(14, 20, 6, 24, 14, 28)

    // Skygge
    g.fillStyle(0x000000, 0.2)
    g.fillEllipse(W / 2, H - 2, 24, 4)

    g.generateTexture(ASSET.TEX_HUGINN_KRAGE, W, H)
    g.destroy()
  }
}
