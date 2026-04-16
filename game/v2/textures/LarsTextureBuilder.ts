import Phaser from 'phaser'
import { ASSET, LARS_HEIGHT, LARS_WIDTH } from '../constants'

/**
 * LarsTextureBuilder — procedurelt genererede Lars-sprites.
 *
 * Vi tegner Lars lag-for-lag med Phaser Graphics, og snapshotter til en tekstur.
 * Hver variant er uafhængig (fuld figur, ikke bare overlay) så vi kan setTexture()
 * uden animation-glitches.
 *
 * Lars' signaturtræk (fra V1):
 * - Orange beanie med sort pom-pom
 * - Mørkt skæg der dækker nedre ansigt
 * - Sorte solbriller med hvide glimt
 * - Guldkæde om halsen
 * - Sort Canada Goose-jakke
 * - Blå jeans
 * - Øldåse i højre hånd
 *
 * Skala: LARS_WIDTH × LARS_HEIGHT (42×56), antialiased.
 */
export class LarsTextureBuilder {
  static buildAll(scene: Phaser.Scene) {
    this.build(scene, ASSET.TEX_LARS, 'normal')
    this.build(scene, ASSET.TEX_LARS_WALK_A, 'walk-a')
    this.build(scene, ASSET.TEX_LARS_WALK_B, 'walk-b')
    this.build(scene, ASSET.TEX_LARS_JUMP, 'jump')
    this.build(scene, ASSET.TEX_LARS_HAPPY, 'happy')
    this.build(scene, ASSET.TEX_LARS_SCARED, 'scared')
    this.build(scene, ASSET.TEX_LARS_VICTORY, 'victory')
  }

  private static build(
    scene: Phaser.Scene,
    key: string,
    variant: 'normal' | 'walk-a' | 'walk-b' | 'jump' | 'happy' | 'scared' | 'victory',
  ) {
    const W = LARS_WIDTH
    const H = LARS_HEIGHT
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Body-offset for jump (hele figuren lidt højere op i canvas så skyggen falder nede)
    const yOff = variant === 'jump' ? -2 : 0

    // ---- 1. Skygge ----
    g.fillStyle(0x000000, 0.35)
    g.fillEllipse(W / 2, H - 2, 26, 4)

    // ---- 2. Ben ----
    // walk-a: venstre ben frem (flip for walk-b)
    const legOffset = variant === 'walk-a' ? 2 : variant === 'walk-b' ? -2 : 0
    // Venstre ben
    g.fillStyle(0x2a3a5a, 1) // blå jeans
    g.fillRoundedRect(12, 40 + yOff, 8, 14 - Math.abs(yOff), 2)
    // Højre ben
    g.fillRoundedRect(22, 40 + yOff, 8, 14 - Math.abs(yOff), 2)
    // Bevægelse: skævvrid ét ben
    if (variant === 'walk-a' || variant === 'walk-b') {
      g.fillStyle(0x1a2540, 1)
      g.fillRoundedRect(12 + legOffset, 42 + yOff, 8, 10, 2)
    }
    // Sneakers
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(11, 52 + yOff, 9, 3, 1)
    g.fillRoundedRect(22, 52 + yOff, 9, 3, 1)

    // ---- 3. Krop (sort Canada Goose-jakke) ----
    g.fillStyle(0x0f0f10, 1)
    g.fillRoundedRect(8, 24 + yOff, 26, 20, 5)
    // Lynlås-detalje
    g.lineStyle(1, 0x3a3a3c, 1)
    g.lineBetween(21, 26 + yOff, 21, 42 + yOff)
    // Guldkæde
    g.fillStyle(0xffd700, 1)
    g.fillCircle(17, 28 + yOff, 1.5)
    g.fillCircle(21, 29 + yOff, 1.5)
    g.fillCircle(25, 28 + yOff, 1.5)

    // ---- 4. Arme ----
    // Venstre arm (bag kroppen)
    g.fillStyle(0x0a0a0c, 1)
    g.fillRoundedRect(5, 26 + yOff, 6, 15, 2)
    // Højre arm (holder øldåse)
    g.fillRoundedRect(31, 26 + yOff, 6, 12, 2)
    // Hånd (skin)
    g.fillStyle(0xf2c4a0, 1)
    g.fillCircle(34, 40 + yOff, 3.5)
    // Øldåse i hånden
    g.fillStyle(0xc41e3a, 1)
    g.fillRect(32, 37 + yOff, 6, 8)
    g.fillStyle(0xc0c0c0, 1)
    g.fillRect(32, 36 + yOff, 6, 2)
    g.fillStyle(0xffd700, 1)
    g.fillRect(33, 39 + yOff, 4, 1)

    // ---- 5. Hoved ----
    const headY = 8 + yOff
    g.fillStyle(0xf2c4a0, 1) // skin
    g.fillRoundedRect(11, headY, 20, 22, 7)

    // Mørk skyggelinje under hagen
    g.fillStyle(0xd4a382, 1)
    g.fillRoundedRect(11, headY + 20, 20, 2, 2)

    // ---- 6. Skæg (mørk brun) ----
    g.fillStyle(0x2a1b10, 1)
    g.fillRoundedRect(11, headY + 12, 20, 11, 4)
    // Skæg-skygge
    g.fillStyle(0x1a0f08, 1)
    g.fillRoundedRect(13, headY + 20, 16, 3, 2)
    // Mund (afhænger af mood)
    if (variant === 'happy' || variant === 'victory') {
      // Grin — hvide tænder der blinker gennem skægget
      g.fillStyle(0xffffff, 1)
      g.fillRoundedRect(16, headY + 16, 10, 3, 1)
      g.fillStyle(0x3a2820, 1)
      g.fillRect(18, headY + 17, 1, 1)
      g.fillRect(22, headY + 17, 1, 1)
    } else if (variant === 'scared') {
      // Åben mund — sort oval
      g.fillStyle(0x000000, 1)
      g.fillEllipse(21, headY + 18, 4, 5)
    }

    // ---- 7. Solbriller ----
    g.fillStyle(0x000000, 1)
    g.fillRoundedRect(11, headY + 6, 20, 6, 2)
    // Glimt på glas
    g.fillStyle(0xffffff, 0.8)
    g.fillRect(13, headY + 7, 3, 1)
    g.fillRect(23, headY + 7, 3, 1)
    if (variant === 'scared') {
      // Sveddråbe på kinden
      g.fillStyle(0x88bbff, 1)
      g.fillCircle(29, headY + 14, 1.5)
    }

    // ---- 8. Beanie (orange) ----
    g.fillStyle(0xf5a623, 1)
    g.fillRoundedRect(10, headY - 6, 22, 10, 5)
    // Rib-detalje (mørkere stribe nederst)
    g.fillStyle(0xd4881c, 1)
    g.fillRect(10, headY + 2, 22, 2)
    // Pom-pom (sort bold på toppen)
    g.fillStyle(0x1a1a1a, 1)
    g.fillCircle(W / 2, headY - 8, 3.5)
    g.fillStyle(0x3a3a3a, 1)
    g.fillCircle(W / 2 - 1, headY - 9, 1)

    // ---- 9. Variant-specifikke add-ons ----
    if (variant === 'victory') {
      // Knyttet næve op over hovedet (venstre arm løftet)
      g.fillStyle(0x0a0a0c, 1)
      g.fillRoundedRect(2, headY - 10, 6, 16, 2)
      g.fillStyle(0xf2c4a0, 1)
      g.fillCircle(5, headY - 12, 4)
      // Gyldent glow om hovedet
      g.fillStyle(0xf5a623, 0.2)
      g.fillCircle(W / 2, headY + 8, 22)
    }

    if (variant === 'happy') {
      // Små stjerner ved siden af hovedet
      g.fillStyle(0xffd700, 0.9)
      g.fillCircle(6, headY + 4, 1.5)
      g.fillCircle(38, headY + 2, 1.5)
      g.fillCircle(40, headY + 14, 1)
    }

    if (variant === 'jump') {
      // Vind-streger bag ryggen
      g.lineStyle(1.5, 0xffffff, 0.6)
      g.lineBetween(2, 20, 6, 18)
      g.lineBetween(2, 28, 6, 26)
      g.lineBetween(2, 36, 6, 34)
    }

    g.generateTexture(key, W, H)
    g.destroy()
  }
}
