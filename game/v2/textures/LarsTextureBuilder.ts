import Phaser from 'phaser'
import { ASSET, LARS_HEIGHT, LARS_WIDTH } from '../constants'

/**
 * LarsTextureBuilder — procedurelt genererede Lars-sprites.
 *
 * Vi tegner ved 2× opløsning og snapshotter, så sprite forbliver crisp når Phaser
 * scaler. Body-størrelsen i LarsPlayer matches separat (LARS_WIDTH × LARS_HEIGHT).
 *
 * Lars' signaturtræk (matchende V1 men mere detaljeret):
 * - Orange beanie med sort pom-pom + rib-detalje
 * - Mørkt skæg (3 lag for dybde)
 * - Sorte solbriller med 2 hvide glimt + næsestang
 * - Guldkæde med 5 led
 * - Sort Canada Goose-jakke (lynlås, lommer, krave-trim)
 * - Blå jeans med syning
 * - Hvide sneakers
 * - Øldåse med Carlsberg-stripe i højre hånd
 *
 * Variants: normal, walk-a, walk-b, jump, happy, scared, victory.
 */
const SCALE = 2 // Tegne-opløsning: dobbelt så stor som body-bounds for crisp output
const W = LARS_WIDTH * SCALE // 84
const H = LARS_HEIGHT * SCALE // 112

type Variant = 'normal' | 'walk-a' | 'walk-b' | 'jump' | 'happy' | 'scared' | 'victory'

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

  private static build(scene: Phaser.Scene, key: string, variant: Variant) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)

    // Y-offset for hop (hele figuren lidt højere op i canvas-vinduet)
    const yOff = variant === 'jump' ? -4 : 0

    // ============== 1. SKYGGE ==============
    g.fillStyle(0x000000, 0.4)
    g.fillEllipse(W / 2, H - 4, 52, 8)

    // ============== 2. BEN (med walk-cycle) ==============
    const legSwing = variant === 'walk-a' ? 6 : variant === 'walk-b' ? -6 : 0
    // Bagben (mørkere)
    g.fillStyle(0x1a2540, 1)
    g.fillRoundedRect(28, 84 + yOff, 14, 22 - Math.abs(legSwing) / 2, 3)
    // Forben
    g.fillStyle(0x2a3a5a, 1)
    g.fillRoundedRect(44 - legSwing, 84 + yOff, 14, 22, 3)
    // Syning på jeans (lodret midterstribe)
    g.fillStyle(0x3a5070, 1)
    g.fillRect(35, 86 + yOff, 1, 18)
    g.fillRect(51 - legSwing, 86 + yOff, 1, 18)
    // Sneakers (hvide med sort sål)
    g.fillStyle(0x000000, 1)
    g.fillRoundedRect(26, 104 + yOff, 18, 4, 2)
    g.fillRoundedRect(42 - legSwing, 104 + yOff, 18, 4, 2)
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(26, 100 + yOff, 18, 6, 2)
    g.fillRoundedRect(42 - legSwing, 100 + yOff, 18, 6, 2)
    // Sneaker-stribe (rød Nike-agtigt)
    g.fillStyle(0xc41e3a, 1)
    g.fillRect(30, 102 + yOff, 10, 1)
    g.fillRect(46 - legSwing, 102 + yOff, 10, 1)

    // ============== 3. KROP — Canada Goose-jakke ==============
    const jacketY = 50 + yOff
    // Hovedkrop (sort)
    g.fillStyle(0x0a0a0c, 1)
    g.fillRoundedRect(14, jacketY, 56, 42, 8)
    // Højlys langs venstre side
    g.fillStyle(0x2a2a2e, 1)
    g.fillRoundedRect(15, jacketY + 4, 4, 34, 2)
    // Lynlås (lyse-grå linje midt på)
    g.fillStyle(0x4a4a4c, 1)
    g.fillRect(41, jacketY + 4, 2, 36)
    // Lynlås-tænder (små horisontale streger)
    g.fillStyle(0x6a6a6c, 1)
    for (let yy = jacketY + 6; yy < jacketY + 38; yy += 3) {
      g.fillRect(40, yy, 4, 1)
    }
    // Lommer (firkanter på siderne)
    g.fillStyle(0x1a1a1c, 1)
    g.fillRoundedRect(20, jacketY + 22, 14, 12, 2)
    g.fillRoundedRect(50, jacketY + 22, 14, 12, 2)
    // Lomme-syning
    g.lineStyle(1, 0x3a3a3c, 0.8)
    g.strokeRoundedRect(20, jacketY + 22, 14, 12, 2)
    g.strokeRoundedRect(50, jacketY + 22, 14, 12, 2)
    // Krave (lidt lysere top-trim)
    g.fillStyle(0x2a2a2e, 1)
    g.fillRoundedRect(22, jacketY - 4, 40, 8, 4)
    // Pelskrave-detalje (små bugter)
    g.fillStyle(0x3a3a3c, 1)
    for (let xx = 24; xx < 58; xx += 4) {
      g.fillCircle(xx, jacketY - 2, 1.5)
    }

    // Guldkæde — 5 led
    g.fillStyle(0xffd700, 1)
    g.fillCircle(28, jacketY + 4, 2)
    g.fillCircle(34, jacketY + 6, 2)
    g.fillCircle(42, jacketY + 7, 2.5)
    g.fillCircle(50, jacketY + 6, 2)
    g.fillCircle(56, jacketY + 4, 2)
    // Guld-vedhæng (større)
    g.fillStyle(0xffd700, 1)
    g.fillCircle(42, jacketY + 12, 3)
    g.fillStyle(0xc89010, 1)
    g.fillCircle(42, jacketY + 12, 1.5)

    // ============== 4. ARME ==============
    // Venstre arm (bag kroppen)
    g.fillStyle(0x0a0a0c, 1)
    g.fillRoundedRect(8, jacketY + 4, 12, 30, 4)
    // Højre arm (holder øldåse)
    g.fillRoundedRect(64, jacketY + 4, 12, 26, 4)
    // Arm-skygge
    g.fillStyle(0x2a2a2e, 1)
    g.fillRoundedRect(9, jacketY + 4, 3, 26, 2)
    g.fillRoundedRect(72, jacketY + 4, 3, 22, 2)

    // Hånd (skin) — venstre
    g.fillStyle(0xf2c4a0, 1)
    g.fillCircle(14, jacketY + 36, 5)
    // Hånd — højre (omkring øldåsen)
    g.fillCircle(70, jacketY + 32, 5)

    // ============== 5. ØLDÅSE ==============
    const canX = 64
    const canY = jacketY + 26
    // Aluminium krop
    g.fillStyle(0xc0c0c0, 1)
    g.fillRoundedRect(canX, canY, 14, 18, 1)
    // Top
    g.fillStyle(0x808080, 1)
    g.fillRoundedRect(canX, canY - 2, 14, 4, 1)
    g.fillStyle(0x404040, 1)
    g.fillCircle(canX + 4, canY - 1, 1.5)
    // Carlsberg-grøn etiket
    g.fillStyle(0x0a5a3a, 1)
    g.fillRect(canX, canY + 4, 14, 8)
    // Hvid Carlsberg-tekst-attrappe
    g.fillStyle(0xffffff, 1)
    g.fillRect(canX + 2, canY + 6, 10, 1)
    g.fillRect(canX + 3, canY + 9, 8, 1)
    // Refleks-streg
    g.fillStyle(0xffffff, 0.6)
    g.fillRect(canX + 1, canY, 1, 18)

    // ============== 6. HOVED ==============
    const headTop = 8 + yOff
    const headW = 36
    const headH = 38
    const headX = (W - headW) / 2
    // Hud
    g.fillStyle(0xf2c4a0, 1)
    g.fillRoundedRect(headX, headTop, headW, headH, 12)
    // Skygge under hagen
    g.fillStyle(0xd4a382, 1)
    g.fillRoundedRect(headX, headTop + headH - 4, headW, 4, 4)
    // Kindrødme (lille)
    g.fillStyle(0xe8a890, 0.4)
    g.fillCircle(headX + 6, headTop + 22, 4)
    g.fillCircle(headX + headW - 6, headTop + 22, 4)

    // ============== 7. SKÆG (mørk brun, 3 lag for dybde) ==============
    g.fillStyle(0x2a1b10, 1)
    g.fillRoundedRect(headX, headTop + 22, headW, 18, 6)
    // Skygge-sektion (mørkere midte)
    g.fillStyle(0x1a0f08, 1)
    g.fillRoundedRect(headX + 4, headTop + 32, headW - 8, 6, 4)
    // Grå hår-detaljer (Lars er ældre — lidt grå striber)
    g.fillStyle(0x4a3a30, 1)
    g.fillRect(headX + 8, headTop + 28, 1, 8)
    g.fillRect(headX + 16, headTop + 26, 1, 6)
    g.fillRect(headX + 24, headTop + 28, 1, 8)
    // Mund (varierer per mood)
    if (variant === 'happy' || variant === 'victory') {
      // Hvidt grin gennem skægget
      g.fillStyle(0xffffff, 1)
      g.fillRoundedRect(headX + 10, headTop + 28, 16, 5, 2)
      // Tand-skygger
      g.fillStyle(0x3a2820, 1)
      g.fillRect(headX + 14, headTop + 30, 1, 3)
      g.fillRect(headX + 18, headTop + 30, 1, 3)
      g.fillRect(headX + 22, headTop + 30, 1, 3)
    } else if (variant === 'scared') {
      // Åben mund
      g.fillStyle(0x000000, 1)
      g.fillEllipse(headX + headW / 2, headTop + 32, 8, 9)
      g.fillStyle(0xc41e3a, 1)
      g.fillEllipse(headX + headW / 2, headTop + 33, 4, 5)
    }

    // ============== 8. SOLBRILLER ==============
    const sgY = headTop + 12
    // Frame (sort)
    g.fillStyle(0x000000, 1)
    g.fillRoundedRect(headX + 2, sgY, headW - 4, 10, 3)
    // Næsestang (linje midt)
    g.lineStyle(1.5, 0x000000, 1)
    g.lineBetween(headX + headW / 2 - 1, sgY + 4, headX + headW / 2 + 1, sgY + 4)
    // Glas-glimt (2 hvide streger)
    g.fillStyle(0xffffff, 0.85)
    g.fillRoundedRect(headX + 5, sgY + 1, 6, 1.5, 1)
    g.fillRoundedRect(headX + headW - 11, sgY + 1, 6, 1.5, 1)
    // Refleks-prik
    g.fillStyle(0xffffff, 1)
    g.fillCircle(headX + 8, sgY + 5, 1)
    g.fillCircle(headX + headW - 8, sgY + 5, 1)
    // Sveddråbe ved skræk
    if (variant === 'scared') {
      g.fillStyle(0x88bbff, 0.95)
      g.fillCircle(headX + headW - 2, sgY + 14, 2.5)
      g.fillTriangle(headX + headW - 4, sgY + 12, headX + headW, sgY + 12, headX + headW - 2, sgY + 9)
    }

    // ============== 9. ØJENBRYN (synlig over solbriller) ==============
    g.fillStyle(0x1a0f08, 1)
    if (variant === 'scared') {
      // Hævede øjenbryn
      g.fillRoundedRect(headX + 3, sgY - 5, 12, 2, 1)
      g.fillRoundedRect(headX + headW - 15, sgY - 5, 12, 2, 1)
    } else if (variant === 'happy' || variant === 'victory') {
      // Buede / glade
      g.fillRoundedRect(headX + 4, sgY - 3, 10, 2, 1)
      g.fillRoundedRect(headX + headW - 14, sgY - 3, 10, 2, 1)
    } else {
      // Lige
      g.fillRoundedRect(headX + 4, sgY - 2, 10, 2, 1)
      g.fillRoundedRect(headX + headW - 14, sgY - 2, 10, 2, 1)
    }

    // ============== 10. BEANIE (orange) ==============
    const beanieY = headTop - 12
    g.fillStyle(0xf5a623, 1)
    g.fillRoundedRect(headX - 2, beanieY, headW + 4, 18, 8)
    // Rib-mønster (3 horisontale striber)
    g.fillStyle(0xd4881c, 1)
    g.fillRect(headX - 2, beanieY + 6, headW + 4, 2)
    g.fillRect(headX - 2, beanieY + 11, headW + 4, 2)
    // Mørkere bund-rib
    g.fillStyle(0xb46810, 1)
    g.fillRect(headX - 2, beanieY + 16, headW + 4, 2)
    // Pom-pom (sort + højlys)
    g.fillStyle(0x1a1a1a, 1)
    g.fillCircle(W / 2, beanieY - 4, 7)
    g.fillStyle(0x3a3a3a, 1)
    g.fillCircle(W / 2 - 2, beanieY - 6, 2.5)
    // Pom-pom striber (uld-effekt)
    g.lineStyle(1, 0x000000, 0.8)
    g.lineBetween(W / 2 - 5, beanieY - 4, W / 2 + 5, beanieY - 4)
    g.lineBetween(W / 2, beanieY - 9, W / 2, beanieY + 1)

    // ============== 11. VARIANT-SPECIFIKKE ADD-ONS ==============
    if (variant === 'victory') {
      // Knyttet næve op over hovedet (venstre arm løftet)
      g.fillStyle(0x0a0a0c, 1)
      g.fillRoundedRect(2, beanieY - 18, 12, 30, 4)
      g.fillStyle(0xf2c4a0, 1)
      g.fillCircle(8, beanieY - 22, 7)
      // Knogler
      g.fillStyle(0xd4a382, 1)
      g.fillRect(4, beanieY - 25, 8, 2)
      // Gyldent glow om hovedet
      g.fillStyle(0xf5a623, 0.18)
      g.fillCircle(W / 2, headTop + 16, 44)
      g.fillStyle(0xffd700, 0.12)
      g.fillCircle(W / 2, headTop + 16, 56)
    }

    if (variant === 'happy') {
      // Små stjerner ved siden af hovedet
      g.fillStyle(0xffd700, 0.95)
      this.drawStar(g, 8, headTop + 6, 4)
      this.drawStar(g, W - 8, headTop + 4, 4)
      this.drawStar(g, W - 6, headTop + 26, 3)
    }

    if (variant === 'jump') {
      // Vind-streger bag ryggen
      g.lineStyle(2.5, 0xffffff, 0.55)
      g.lineBetween(2, 60, 10, 56)
      g.lineBetween(2, 72, 10, 68)
      g.lineBetween(2, 84, 10, 80)
    }

    g.generateTexture(key, W, H)
    g.destroy()
  }

  /** Lille 5-takket stjerne */
  private static drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
    const points: number[] = []
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2
      const radius = i % 2 === 0 ? r : r * 0.45
      points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
    }
    g.fillPoints(points.map((v, i) => i % 2 === 0 ? { x: v, y: points[i + 1] } : null).filter(Boolean) as { x: number, y: number }[], true)
  }
}
