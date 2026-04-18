import Phaser from 'phaser'
import { COLORS } from './constants'

/**
 * Techno Viking — procedural texture builder.
 *
 * Vi tegner alt via Phaser.GameObjects.Graphics → generateTexture().
 * Fordel: zero asset-loading, hurtig iteration, fuld kontrol over farver.
 * Ulempe: Lars' silhuet er "stiliseret", ikke fotoreal — men det matcher
 * GDD'ens target vibe (rave/silhuetbillede).
 */

export const TEX = {
  // Lars frames (faces camera, march cycle A/B)
  LARS_CASUAL_A: 'tv-lars-casual-a',
  LARS_CASUAL_B: 'tv-lars-casual-b',
  LARS_WARM_A: 'tv-lars-warm-a',
  LARS_WARM_B: 'tv-lars-warm-b',
  LARS_LOOSE_A: 'tv-lars-loose-a',
  LARS_LOOSE_B: 'tv-lars-loose-b',
  LARS_SHIFT_A: 'tv-lars-shift-a',
  LARS_SHIFT_B: 'tv-lars-shift-b',
  LARS_TECHNO_A: 'tv-lars-techno-a',
  LARS_TECHNO_B: 'tv-lars-techno-b',

  // Jim
  JIM_IDLE: 'tv-jim-idle',
  JIM_POINT: 'tv-jim-point',
  JIM_CACKLE: 'tv-jim-cackle',

  // Follower sprites (silhuetter)
  FOLLOWER_1: 'tv-follower-1',
  FOLLOWER_2: 'tv-follower-2',
  FOLLOWER_3: 'tv-follower-3',
  FOLLOWER_ARMS_UP: 'tv-follower-arms',

  // Note highway
  ARROW_LEFT: 'tv-arrow-left',
  ARROW_DOWN: 'tv-arrow-down',
  ARROW_UP: 'tv-arrow-up',
  ARROW_RIGHT: 'tv-arrow-right',
  BEER_NOTE: 'tv-beer-note',
  LANE_RECEPTOR: 'tv-lane-receptor',

  // Env
  BUILDING_A: 'tv-building-a',
  BUILDING_B: 'tv-building-b',
  STREETLAMP: 'tv-streetlamp',
  SAUSAGE_CART: 'tv-sausage-cart',
  PUDDLE: 'tv-puddle',

  // FX
  HIT_SPARK: 'tv-hit-spark',
  BEAT_RING: 'tv-beat-ring',
  STAR_PARTICLE: 'tv-star-p',
} as const

/**
 * Call én gang i BootScene.create().
 */
export function buildAllTextures(scene: Phaser.Scene) {
  buildLarsFrames(scene)
  buildJimFrames(scene)
  buildFollowers(scene)
  buildArrows(scene)
  buildEnv(scene)
  buildFx(scene)
}

// =============================================================================
// LARS
// =============================================================================

type LarsStageOpts = {
  armsUp: boolean
  tattooGlow: number // 0..1
  beardWild: number // 0..1 (længde-scaler)
  mouthOpen: number // 0..1
  shinyPate: number // 0..1
}

/**
 * Lars tegnes som en stilisered 3/4-front silhuet ~120x180 px.
 * Vi laver 5 stages × 2 frames = 10 teksturer.
 */
function buildLarsFrames(scene: Phaser.Scene) {
  const stages: Array<[string, string, LarsStageOpts, LarsStageOpts]> = [
    [TEX.LARS_CASUAL_A, TEX.LARS_CASUAL_B,
      { armsUp: false, tattooGlow: 0, beardWild: 0.3, mouthOpen: 0, shinyPate: 0.4 },
      { armsUp: false, tattooGlow: 0, beardWild: 0.3, mouthOpen: 0, shinyPate: 0.4 }],
    [TEX.LARS_WARM_A, TEX.LARS_WARM_B,
      { armsUp: false, tattooGlow: 0.15, beardWild: 0.4, mouthOpen: 0.2, shinyPate: 0.6 },
      { armsUp: false, tattooGlow: 0.15, beardWild: 0.4, mouthOpen: 0.2, shinyPate: 0.6 }],
    [TEX.LARS_LOOSE_A, TEX.LARS_LOOSE_B,
      { armsUp: false, tattooGlow: 0.35, beardWild: 0.6, mouthOpen: 0.4, shinyPate: 0.8 },
      { armsUp: true, tattooGlow: 0.35, beardWild: 0.6, mouthOpen: 0.4, shinyPate: 0.8 }],
    [TEX.LARS_SHIFT_A, TEX.LARS_SHIFT_B,
      { armsUp: true, tattooGlow: 0.6, beardWild: 0.8, mouthOpen: 0.6, shinyPate: 1.0 },
      { armsUp: true, tattooGlow: 0.6, beardWild: 0.8, mouthOpen: 0.6, shinyPate: 1.0 }],
    [TEX.LARS_TECHNO_A, TEX.LARS_TECHNO_B,
      { armsUp: true, tattooGlow: 1.0, beardWild: 1.0, mouthOpen: 1.0, shinyPate: 1.0 },
      { armsUp: true, tattooGlow: 1.0, beardWild: 1.0, mouthOpen: 1.0, shinyPate: 1.0 }],
  ]
  for (const [keyA, keyB, optA, optB] of stages) {
    drawLars(scene, keyA, optA, 'a')
    drawLars(scene, keyB, optB, 'b')
  }
}

function drawLars(scene: Phaser.Scene, key: string, o: LarsStageOpts, step: 'a' | 'b') {
  const W = 140
  const H = 200
  const g = scene.add.graphics()

  // Subtle ground shadow
  g.fillStyle(0x000000, 0.35)
  g.fillEllipse(W / 2, H - 8, 70, 10)

  // Swing: ben bevæger sig mellem frame a/b
  const swing = step === 'a' ? -6 : 6

  // Ben (cargo shorts)
  g.fillStyle(COLORS.LARS_SHORTS, 1)
  g.fillRect(W / 2 - 22 + swing * 0.3, H - 80, 18, 48)
  g.fillRect(W / 2 + 4 - swing * 0.3, H - 80, 18, 48)

  // Støvler
  g.fillStyle(0x161616, 1)
  g.fillRect(W / 2 - 24 + swing * 0.3, H - 34, 22, 10)
  g.fillRect(W / 2 + 2 - swing * 0.3, H - 34, 22, 10)

  // Krop (sort tee / hoodie)
  g.fillStyle(COLORS.LARS_HOODIE, 1)
  g.fillRoundedRect(W / 2 - 34, H - 130, 68, 55, 8)

  // Arme — enten ned langs siden eller oppe i raven-pose
  const skin = COLORS.LARS_SKIN
  if (o.armsUp) {
    // Løftede arme — 2 streger op
    g.lineStyle(14, skin, 1)
    g.beginPath()
    g.moveTo(W / 2 - 28, H - 110)
    g.lineTo(W / 2 - 44, H - 165)
    g.moveTo(W / 2 + 28, H - 110)
    g.lineTo(W / 2 + 44, H - 165)
    g.strokePath()
    // Næver
    g.fillStyle(skin, 1)
    g.fillCircle(W / 2 - 44, H - 165, 9)
    g.fillCircle(W / 2 + 44, H - 165, 9)
  } else {
    // Arme ned, lille swing
    g.lineStyle(14, skin, 1)
    g.beginPath()
    g.moveTo(W / 2 - 30, H - 120)
    g.lineTo(W / 2 - 30 - swing * 0.2, H - 80)
    g.moveTo(W / 2 + 30, H - 120)
    g.lineTo(W / 2 + 30 + swing * 0.2, H - 80)
    g.strokePath()
    g.fillStyle(skin, 1)
    g.fillCircle(W / 2 - 30 - swing * 0.2, H - 80, 8)
    g.fillCircle(W / 2 + 30 + swing * 0.2, H - 80, 8)
  }

  // Tattoo-glow på overarme (stages)
  if (o.tattooGlow > 0) {
    const glowAlpha = 0.25 + o.tattooGlow * 0.5
    g.fillStyle(COLORS.LARS_TATTOO_GLOW, glowAlpha)
    g.fillCircle(W / 2 - 34, H - 118, 10 + o.tattooGlow * 4)
    g.fillCircle(W / 2 + 34, H - 118, 10 + o.tattooGlow * 4)
  }

  // Hoved
  g.fillStyle(skin, 1)
  g.fillCircle(W / 2, H - 148, 26)

  // Skinnende isse (højdelys)
  if (o.shinyPate > 0) {
    g.fillStyle(0xffffff, 0.15 + o.shinyPate * 0.3)
    g.fillEllipse(W / 2 - 4, H - 160, 22, 10)
  }

  // Solbriller (runde, sorte med stærke briller = transformed)
  const shadeGlow = o.tattooGlow > 0.5
  g.fillStyle(0x0a0a0a, 1)
  g.fillRoundedRect(W / 2 - 22, H - 154, 20, 12, 4)
  g.fillRoundedRect(W / 2 + 2, H - 154, 20, 12, 4)
  // Bro mellem briller
  g.fillRect(W / 2 - 2, H - 150, 4, 3)
  if (shadeGlow) {
    g.lineStyle(2, COLORS.LARS_TATTOO_GLOW, 0.8)
    g.strokeRoundedRect(W / 2 - 22, H - 154, 20, 12, 4)
    g.strokeRoundedRect(W / 2 + 2, H - 154, 20, 12, 4)
  }

  // Mund
  g.fillStyle(0x1a0a0a, 1)
  const mouthH = 2 + o.mouthOpen * 6
  g.fillRoundedRect(W / 2 - 6, H - 135, 12, mouthH, 2)

  // Skæg
  g.fillStyle(COLORS.LARS_BEARD, 1)
  const beardLen = 14 + o.beardWild * 20
  // Tegn skæg som trekant-ish polygon under hagen
  g.beginPath()
  g.moveTo(W / 2 - 18, H - 134)
  g.lineTo(W / 2 + 18, H - 134)
  g.lineTo(W / 2 + 10, H - 134 + beardLen)
  g.lineTo(W / 2, H - 130 + beardLen + 4)
  g.lineTo(W / 2 - 10, H - 134 + beardLen)
  g.closePath()
  g.fillPath()

  // Wild hår-streger når techno-stage
  if (o.beardWild > 0.8) {
    g.lineStyle(2, COLORS.LARS_BEARD, 0.9)
    g.beginPath()
    g.moveTo(W / 2 - 16, H - 130)
    g.lineTo(W / 2 - 24, H - 118)
    g.moveTo(W / 2 + 16, H - 130)
    g.lineTo(W / 2 + 24, H - 118)
    g.strokePath()
  }

  g.generateTexture(key, W, H)
  g.destroy()
}

// =============================================================================
// JIM LYNGVILD
// =============================================================================

function buildJimFrames(scene: Phaser.Scene) {
  drawJim(scene, TEX.JIM_IDLE, 'idle')
  drawJim(scene, TEX.JIM_POINT, 'point')
  drawJim(scene, TEX.JIM_CACKLE, 'cackle')
}

function drawJim(scene: Phaser.Scene, key: string, mode: 'idle' | 'point' | 'cackle') {
  const W = 120
  const H = 180
  const g = scene.add.graphics()

  // Skygge
  g.fillStyle(0x000000, 0.3)
  g.fillEllipse(W / 2, H - 6, 60, 8)

  // Robe / kåbe — rød, lang
  g.fillStyle(COLORS.JIM_ROBE, 1)
  g.fillRoundedRect(W / 2 - 32, H - 120, 64, 95, 6)
  // Pels-kant forneden og ved hals
  g.fillStyle(COLORS.JIM_FUR, 1)
  g.fillRoundedRect(W / 2 - 34, H - 35, 68, 12, 4)
  g.fillRoundedRect(W / 2 - 34, H - 125, 68, 14, 4)

  // Hoved
  g.fillStyle(COLORS.JIM_SKIN, 1)
  g.fillCircle(W / 2, H - 135, 22)

  // Langt lyst hår (bagud)
  g.fillStyle(0xe8d59a, 1)
  g.fillRoundedRect(W / 2 - 28, H - 138, 56, 30, 10)

  // Ansigts-tatoveringer (rød)
  g.lineStyle(2, COLORS.JIM_TATTOO, 0.95)
  g.beginPath()
  g.moveTo(W / 2 - 14, H - 144)
  g.lineTo(W / 2 - 6, H - 128)
  g.moveTo(W / 2 + 14, H - 144)
  g.lineTo(W / 2 + 6, H - 128)
  g.moveTo(W / 2 - 10, H - 132)
  g.lineTo(W / 2 + 10, H - 132)
  g.strokePath()

  // Øjne — stærk blå
  g.fillStyle(COLORS.JIM_EYES, 1)
  g.fillCircle(W / 2 - 7, H - 138, 3)
  g.fillCircle(W / 2 + 7, H - 138, 3)
  g.fillStyle(0x000000, 1)
  g.fillCircle(W / 2 - 7, H - 138, 1.5)
  g.fillCircle(W / 2 + 7, H - 138, 1.5)

  // Mund
  if (mode === 'cackle') {
    g.fillStyle(0x1a0000, 1)
    g.fillRoundedRect(W / 2 - 8, H - 125, 16, 7, 3)
    g.fillStyle(0xffffff, 1)
    g.fillRect(W / 2 - 6, H - 124, 12, 2)
  } else if (mode === 'point') {
    g.fillStyle(0x1a0000, 1)
    g.fillRoundedRect(W / 2 - 4, H - 124, 10, 3, 2)
  } else {
    g.fillStyle(0x1a0000, 1)
    g.fillRect(W / 2 - 4, H - 122, 8, 2)
  }

  // Arme / pegefinger
  if (mode === 'point') {
    // Peger mod højre (toward Lars)
    g.lineStyle(12, COLORS.JIM_SKIN, 1)
    g.beginPath()
    g.moveTo(W / 2 + 24, H - 100)
    g.lineTo(W / 2 + 50, H - 110)
    g.strokePath()
    g.fillStyle(COLORS.JIM_SKIN, 1)
    g.fillTriangle(W / 2 + 50, H - 115, W / 2 + 50, H - 105, W / 2 + 62, H - 110)
  } else {
    // Arme korslagt
    g.lineStyle(14, COLORS.JIM_ROBE, 1)
    g.beginPath()
    g.moveTo(W / 2 - 22, H - 100)
    g.lineTo(W / 2 + 22, H - 85)
    g.moveTo(W / 2 + 22, H - 100)
    g.lineTo(W / 2 - 22, H - 85)
    g.strokePath()
  }

  g.generateTexture(key, W, H)
  g.destroy()
}

// =============================================================================
// FOLLOWERS — silhuetter i forskellige farver
// =============================================================================

function buildFollowers(scene: Phaser.Scene) {
  const variants: Array<[string, number, boolean]> = [
    [TEX.FOLLOWER_1, 0x2a1f2e, false],
    [TEX.FOLLOWER_2, 0x1a2a3a, false],
    [TEX.FOLLOWER_3, 0x3a2a1a, false],
    [TEX.FOLLOWER_ARMS_UP, 0x1a1a1a, true],
  ]
  for (const [key, color, armsUp] of variants) {
    drawFollower(scene, key, color, armsUp)
  }
}

function drawFollower(scene: Phaser.Scene, key: string, color: number, armsUp: boolean) {
  const W = 70
  const H = 100
  const g = scene.add.graphics()

  // Krop
  g.fillStyle(color, 1)
  g.fillRoundedRect(W / 2 - 16, H - 60, 32, 40, 6)
  // Hoved
  g.fillCircle(W / 2, H - 72, 12)
  // Arme
  if (armsUp) {
    g.lineStyle(6, color, 1)
    g.beginPath()
    g.moveTo(W / 2 - 14, H - 52)
    g.lineTo(W / 2 - 22, H - 90)
    g.moveTo(W / 2 + 14, H - 52)
    g.lineTo(W / 2 + 22, H - 90)
    g.strokePath()
  } else {
    g.lineStyle(5, color, 1)
    g.beginPath()
    g.moveTo(W / 2 - 14, H - 52)
    g.lineTo(W / 2 - 18, H - 28)
    g.moveTo(W / 2 + 14, H - 52)
    g.lineTo(W / 2 + 18, H - 28)
    g.strokePath()
  }
  // Ben
  g.fillStyle(0x0a0a0a, 1)
  g.fillRect(W / 2 - 10, H - 22, 8, 18)
  g.fillRect(W / 2 + 2, H - 22, 8, 18)

  // Ekstra: lille hvid pixel i hovedet (øjne)
  g.fillStyle(0xffffff, 0.5)
  g.fillRect(W / 2 - 4, H - 74, 2, 2)
  g.fillRect(W / 2 + 2, H - 74, 2, 2)

  g.generateTexture(key, W, H)
  g.destroy()
}

// =============================================================================
// ARROWS + BEER NOTES + RECEPTORS
// =============================================================================

function buildArrows(scene: Phaser.Scene) {
  drawArrow(scene, TEX.ARROW_LEFT, COLORS.LANE_LEFT, 'left')
  drawArrow(scene, TEX.ARROW_DOWN, COLORS.LANE_DOWN, 'down')
  drawArrow(scene, TEX.ARROW_UP, COLORS.LANE_UP, 'up')
  drawArrow(scene, TEX.ARROW_RIGHT, COLORS.LANE_RIGHT, 'right')
  drawBeerNote(scene, TEX.BEER_NOTE)
  drawReceptor(scene, TEX.LANE_RECEPTOR)
}

function drawArrow(
  scene: Phaser.Scene,
  key: string,
  color: number,
  dir: 'left' | 'down' | 'up' | 'right',
) {
  const W = 80
  const H = 80
  const g = scene.add.graphics()

  // Glow bag
  g.fillStyle(color, 0.2)
  g.fillCircle(W / 2, H / 2, 38)
  g.fillStyle(color, 0.4)
  g.fillCircle(W / 2, H / 2, 28)

  // Core arrow shape
  g.fillStyle(color, 1)
  const cx = W / 2
  const cy = H / 2
  const s = 22 // half-size
  if (dir === 'up') {
    g.fillTriangle(cx, cy - s, cx - s, cy + s * 0.3, cx + s, cy + s * 0.3)
    g.fillRect(cx - 7, cy - 2, 14, s - 2)
  } else if (dir === 'down') {
    g.fillTriangle(cx, cy + s, cx - s, cy - s * 0.3, cx + s, cy - s * 0.3)
    g.fillRect(cx - 7, cy - s + 2, 14, s - 2)
  } else if (dir === 'left') {
    g.fillTriangle(cx - s, cy, cx + s * 0.3, cy - s, cx + s * 0.3, cy + s)
    g.fillRect(cx - 2, cy - 7, s - 2, 14)
  } else {
    g.fillTriangle(cx + s, cy, cx - s * 0.3, cy - s, cx - s * 0.3, cy + s)
    g.fillRect(cx - s + 2, cy - 7, s - 2, 14)
  }

  // White inner highlight
  g.fillStyle(0xffffff, 0.6)
  g.fillCircle(W / 2 - 6, H / 2 - 8, 5)

  g.generateTexture(key, W, H)
  g.destroy()
}

function drawBeerNote(scene: Phaser.Scene, key: string) {
  const W = 80
  const H = 80
  const g = scene.add.graphics()

  // Glow
  g.fillStyle(COLORS.LANE_BEER, 0.2)
  g.fillCircle(W / 2, H / 2, 38)
  g.fillStyle(COLORS.LANE_BEER, 0.4)
  g.fillCircle(W / 2, H / 2, 28)

  // Krus base
  g.fillStyle(0xfdc84a, 1)
  g.fillRoundedRect(W / 2 - 14, H / 2 - 18, 24, 36, 4)

  // Skum
  g.fillStyle(0xffffff, 1)
  g.fillRoundedRect(W / 2 - 14, H / 2 - 22, 24, 10, 5)
  g.fillCircle(W / 2 - 10, H / 2 - 24, 5)
  g.fillCircle(W / 2, H / 2 - 26, 6)
  g.fillCircle(W / 2 + 8, H / 2 - 23, 5)

  // Hank
  g.lineStyle(4, 0xfdc84a, 1)
  g.strokeRoundedRect(W / 2 + 10, H / 2 - 10, 12, 20, 6)

  g.generateTexture(key, W, H)
  g.destroy()
}

function drawReceptor(scene: Phaser.Scene, key: string) {
  const W = 80
  const H = 80
  const g = scene.add.graphics()
  g.lineStyle(3, 0xffffff, 0.6)
  g.strokeCircle(W / 2, H / 2, 32)
  g.lineStyle(2, 0xffffff, 0.25)
  g.strokeCircle(W / 2, H / 2, 26)
  g.generateTexture(key, W, H)
  g.destroy()
}

// =============================================================================
// ENV — bygninger, lygtepæle, pølsevogn
// =============================================================================

function buildEnv(scene: Phaser.Scene) {
  drawBuilding(scene, TEX.BUILDING_A, 0x1d1b2e, 0xffd25a)
  drawBuilding(scene, TEX.BUILDING_B, 0x171728, 0xff6aa0)
  drawStreetlamp(scene, TEX.STREETLAMP)
  drawSausageCart(scene, TEX.SAUSAGE_CART)
  drawPuddle(scene, TEX.PUDDLE)
}

function drawBuilding(scene: Phaser.Scene, key: string, fill: number, window: number) {
  const W = 180
  const H = 420
  const g = scene.add.graphics()
  g.fillStyle(fill, 1)
  g.fillRect(0, 0, W, H)
  // Windows grid
  g.fillStyle(window, 0.85)
  for (let y = 20; y < H - 40; y += 46) {
    for (let x = 14; x < W - 14; x += 34) {
      if (Math.random() > 0.35) {
        g.fillRect(x, y, 18, 26)
      }
    }
  }
  // Top edge
  g.fillStyle(0x000000, 0.5)
  g.fillRect(0, 0, W, 6)
  g.generateTexture(key, W, H)
  g.destroy()
}

function drawStreetlamp(scene: Phaser.Scene, key: string) {
  const W = 40
  const H = 260
  const g = scene.add.graphics()
  // Pole
  g.fillStyle(0x1a1a1a, 1)
  g.fillRect(W / 2 - 2, 20, 4, H - 20)
  // Lamp head
  g.fillStyle(0xffd47a, 1)
  g.fillCircle(W / 2, 18, 14)
  g.fillStyle(0xffd47a, 0.3)
  g.fillCircle(W / 2, 18, 24)
  g.generateTexture(key, W, H)
  g.destroy()
}

function drawSausageCart(scene: Phaser.Scene, key: string) {
  const W = 180
  const H = 160
  const g = scene.add.graphics()
  // Vogn
  g.fillStyle(0xd9a24a, 1)
  g.fillRoundedRect(10, 50, W - 20, 80, 10)
  // Tag (rød/hvid stribet)
  g.fillStyle(0xc23a3a, 1)
  g.fillTriangle(10, 50, W / 2, 10, W - 10, 50)
  g.fillStyle(0xffffff, 1)
  for (let i = 0; i < 4; i++) {
    g.fillTriangle(20 + i * 40, 48, 40 + i * 40, 25, 60 + i * 40, 48)
  }
  // Skilt
  g.fillStyle(0x1a1a1a, 1)
  g.fillRoundedRect(W / 2 - 30, 60, 60, 18, 3)
  g.fillStyle(0xffd25a, 1)
  g.fillRect(W / 2 - 25, 65, 10, 8)
  g.fillRect(W / 2 - 10, 65, 10, 8)
  g.fillRect(W / 2 + 5, 65, 10, 8)
  // Hjul
  g.fillStyle(0x0a0a0a, 1)
  g.fillCircle(40, 140, 14)
  g.fillCircle(W - 40, 140, 14)
  g.fillStyle(0x5a5a5a, 1)
  g.fillCircle(40, 140, 6)
  g.fillCircle(W - 40, 140, 6)
  g.generateTexture(key, W, H)
  g.destroy()
}

function drawPuddle(scene: Phaser.Scene, key: string) {
  const W = 120
  const H = 30
  const g = scene.add.graphics()
  g.fillStyle(0x3a4a60, 0.5)
  g.fillEllipse(W / 2, H / 2, W * 0.9, H * 0.8)
  g.fillStyle(0x6a8ab0, 0.3)
  g.fillEllipse(W / 2 - 10, H / 2 - 4, W * 0.4, H * 0.35)
  g.generateTexture(key, W, H)
  g.destroy()
}

// =============================================================================
// FX
// =============================================================================

function buildFx(scene: Phaser.Scene) {
  // Hit spark — radial gradient-ish ring
  const g1 = scene.add.graphics()
  g1.fillStyle(0xffffff, 0.9)
  g1.fillCircle(32, 32, 10)
  g1.fillStyle(0xffd447, 0.7)
  g1.fillCircle(32, 32, 20)
  g1.fillStyle(0xff3b6b, 0.3)
  g1.fillCircle(32, 32, 30)
  g1.generateTexture(TEX.HIT_SPARK, 64, 64)
  g1.destroy()

  // Beat ring — hollow circle
  const g2 = scene.add.graphics()
  g2.lineStyle(4, 0xffffff, 0.9)
  g2.strokeCircle(40, 40, 30)
  g2.generateTexture(TEX.BEAT_RING, 80, 80)
  g2.destroy()

  // Star particle — small dot
  const g3 = scene.add.graphics()
  g3.fillStyle(0xffffff, 1)
  g3.fillCircle(8, 8, 6)
  g3.generateTexture(TEX.STAR_PARTICLE, 16, 16)
  g3.destroy()
}
