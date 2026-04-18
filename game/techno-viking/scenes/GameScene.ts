import Phaser from 'phaser'
import { TechnoAudio } from '../audio'
import {
  COLORS,
  DEPTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  HIGHWAY,
  LANE_KEYS,
  LEVEL,
  SCENE,
  SCORE,
  STAGE_NAMES,
  STORAGE,
  TIMING,
} from '../constants'
import { Follower } from '../entities/Follower'
import { Jim } from '../entities/Jim'
import { Lars } from '../entities/Lars'
import type { Note } from '../notechart'
import { buildChart, noteY } from '../notechart'
import { TEX } from '../textures'

interface NoteSprite {
  note: Note
  sprite: Phaser.GameObjects.Image
  spawned: boolean
}

/**
 * GameScene — selve rhythm-gameplayet.
 *
 * Loop per frame:
 *  1. Få musik-tid fra TechnoAudio (vi stoler ikke på this.time.now for timing)
 *  2. Scroll baggrund + fortov
 *  3. For hver note i chart: spawn når inden for TRAVEL_MS, flyt ned mod receptor
 *  4. Når note passerer miss-windowet uden hit → penalty
 *  5. Input → find nærmeste note i samme lane, dom Perfect/Great/Good/Miss
 *  6. Opdater followers, Lars stage, Jim reactions
 *
 * Scenen starter HUD-scenen parallelt og sender events ud for hvert hit/miss.
 */
export class GameScene extends Phaser.Scene {
  private audio!: TechnoAudio
  private chart: Note[] = []
  private activeNotes: NoteSprite[] = []
  private nextChartIdx = 0

  private lars!: Lars
  private jim!: Jim
  private followers: Follower[] = []

  private lastBeat = -1

  // HUD state (mirror i HUDScene via events)
  private score = 0
  private combo = 0
  private maxCombo = 0
  private perfectCount = 0
  private greatCount = 0
  private goodCount = 0
  private missCount = 0
  private vikingMeter = 0 // 0..100

  private bgFar!: Phaser.GameObjects.TileSprite
  private bgMid!: Phaser.GameObjects.TileSprite
  private street!: Phaser.GameObjects.Graphics
  private streetStripeOffset = 0
  private receptors: Phaser.GameObjects.Image[] = []
  private lanesBg!: Phaser.GameObjects.Graphics
  private beatRingFx!: Phaser.GameObjects.Image

  private gameEnded = false

  constructor() {
    super({ key: SCENE.GAME })
  }

  async create() {
    this.resetState()

    // ---- Sky + bygninger (parallax) ----
    const skyGfx = this.add.graphics().setDepth(DEPTH.SKY)
    skyGfx.fillGradientStyle(
      COLORS.SKY_TOP,
      COLORS.SKY_TOP,
      COLORS.SKY_MID,
      COLORS.SKY_MID,
      1,
    )
    skyGfx.fillRect(0, 0, GAME_WIDTH, 460)

    this.bgFar = this.add
      .tileSprite(0, 100, GAME_WIDTH, 420, TEX.BUILDING_A)
      .setOrigin(0, 0)
      .setScale(1, 1)
      .setAlpha(0.45)
      .setDepth(DEPTH.BUILDINGS)

    this.bgMid = this.add
      .tileSprite(0, 180, GAME_WIDTH, 420, TEX.BUILDING_B)
      .setOrigin(0, 0)
      .setAlpha(0.8)
      .setDepth(DEPTH.BUILDINGS + 1)

    // ---- Gade ----
    this.street = this.add.graphics().setDepth(DEPTH.STREET)
    this.drawStreet()

    // ---- Pølsevogn decoration (placeret længst ude i højre side så den ikke
    //      kolliderer med Jim-som-står-i-venstre-side) ----
    this.add
      .image(GAME_WIDTH - 30, 560, TEX.SAUSAGE_CART)
      .setOrigin(1, 1)
      .setScale(0.75)
      .setDepth(DEPTH.ENV)

    // Streetlamps yderst til begge sider (bag Jim og pølsevogn)
    this.add
      .image(GAME_WIDTH - 20, 500, TEX.STREETLAMP)
      .setOrigin(1, 1)
      .setAlpha(0.7)
      .setDepth(DEPTH.ENV - 1)
    this.add
      .image(20, 500, TEX.STREETLAMP)
      .setOrigin(0, 1)
      .setAlpha(0.7)
      .setDepth(DEPTH.ENV - 1)

    // Subtil beat-ring omkring Lars' fødder
    this.beatRingFx = this.add
      .image(0, 0, TEX.BEAT_RING)
      .setAlpha(0)
      .setDepth(DEPTH.LARS - 2)
      .setTint(COLORS.JUDGE_PERFECT)

    // ---- Lars + Jim ----
    const larsX = GAME_WIDTH / 2
    const larsY = 540
    this.lars = new Lars(this, larsX, larsY)
    // Jim står i venstre side, et stykke oppe bag Lars så han ikke skjuler
    // pølsevognen eller follower-flokken
    this.jim = new Jim(this, 130, 490)
    this.beatRingFx.setPosition(larsX, larsY + 4)

    // ---- Lane backgrounds + receptors ----
    this.lanesBg = this.add.graphics().setDepth(DEPTH.NOTE_LANE_BG)
    this.drawLaneBackground()
    for (let i = 0; i < HIGHWAY.LANE_COUNT; i++) {
      const x = this.laneX(i)
      const receptor = this.add
        .image(x, HIGHWAY.HIT_ZONE_Y, TEX.LANE_RECEPTOR)
        .setDepth(DEPTH.NOTE_LANE_BG + 1)
      this.receptors.push(receptor)

      // Lille pil-ikon i receptoren så spilleren ved hvilken retning
      const dirTex = this.laneArrowTex(i)
      this.add
        .image(x, HIGHWAY.HIT_ZONE_Y, dirTex)
        .setAlpha(0.3)
        .setScale(0.6)
        .setDepth(DEPTH.NOTE_LANE_BG + 2)
    }

    // ---- Chart ----
    this.chart = buildChart()

    // ---- Input ----
    this.setupInput()

    // ---- HUD ----
    this.scene.launch(SCENE.HUD, {
      onRetry: () => this.retryLevel(),
      onExit: () => this.exitToMenu(),
    })

    // ---- Audio start (venter på ready event fra HUD click "start") ----
    this.audio = new TechnoAudio()
    await this.audio.start()

    // 3-2-1 countdown intro
    this.runCountdown()

    // Shutdown cleanup
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    this.events.on(Phaser.Scenes.Events.DESTROY, this.shutdown, this)
  }

  private resetState() {
    this.chart = []
    this.activeNotes = []
    this.followers = []
    this.nextChartIdx = 0
    this.lastBeat = -1
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.perfectCount = 0
    this.greatCount = 0
    this.goodCount = 0
    this.missCount = 0
    this.vikingMeter = 0
    this.gameEnded = false
  }

  private drawStreet() {
    this.street.clear()
    // Fortov / gade
    this.street.fillStyle(COLORS.STREET, 1)
    this.street.fillRect(0, 470, GAME_WIDTH, GAME_HEIGHT - 470)
    // Stiplede midterstriber (perspektiv)
    this.street.fillStyle(COLORS.STREET_STRIPE, 1)
    const stripeStartY = 480
    const stripeEndY = 560
    const laneCount = 8
    const offset = this.streetStripeOffset
    for (let i = 0; i < laneCount; i++) {
      const t = (i * 20 + offset) % 160
      const y = stripeStartY + (t / 160) * (stripeEndY - stripeStartY)
      const widthScale = 1 + (y - stripeStartY) / (stripeEndY - stripeStartY) * 2
      const w = 28 * widthScale
      const h = 4 * widthScale
      this.street.fillRect(GAME_WIDTH / 2 - w / 2, y, w, h)
    }
    // Kant / puddle shimmer
    this.street.fillStyle(0x2a2a3a, 1)
    this.street.fillRect(0, 465, GAME_WIDTH, 5)
  }

  private drawLaneBackground() {
    this.lanesBg.clear()
    // Vertikal mørk strippe under lanerne så arrows står skarpt
    const totalW = HIGHWAY.LANE_COUNT * HIGHWAY.LANE_WIDTH
    const startX = HIGHWAY.CENTER_X - totalW / 2
    this.lanesBg.fillStyle(0x000000, 0.55)
    this.lanesBg.fillRoundedRect(startX - 8, 0, totalW + 16, HIGHWAY.HIT_ZONE_Y + 60, 14)
    // Lane divisioner
    this.lanesBg.lineStyle(1, 0xffffff, 0.12)
    for (let i = 1; i < HIGHWAY.LANE_COUNT; i++) {
      const x = startX + i * HIGHWAY.LANE_WIDTH
      this.lanesBg.beginPath()
      this.lanesBg.moveTo(x, 20)
      this.lanesBg.lineTo(x, HIGHWAY.HIT_ZONE_Y + 40)
      this.lanesBg.strokePath()
    }
    // Hit line
    this.lanesBg.lineStyle(2, 0xffffff, 0.4)
    this.lanesBg.beginPath()
    this.lanesBg.moveTo(startX, HIGHWAY.HIT_ZONE_Y)
    this.lanesBg.lineTo(startX + totalW, HIGHWAY.HIT_ZONE_Y)
    this.lanesBg.strokePath()
  }

  private laneX(lane: number): number {
    const totalW = HIGHWAY.LANE_COUNT * HIGHWAY.LANE_WIDTH
    const startX = HIGHWAY.CENTER_X - totalW / 2 + HIGHWAY.LANE_WIDTH / 2
    return startX + lane * HIGHWAY.LANE_WIDTH
  }

  private laneArrowTex(lane: number): string {
    return [TEX.ARROW_LEFT, TEX.ARROW_DOWN, TEX.ARROW_UP, TEX.ARROW_RIGHT][lane]
  }

  private setupInput() {
    const kb = this.input.keyboard!
    // Arrow keys
    kb.on('keydown-LEFT', () => this.onLaneHit(0))
    kb.on('keydown-DOWN', () => this.onLaneHit(1))
    kb.on('keydown-UP', () => this.onLaneHit(2))
    kb.on('keydown-RIGHT', () => this.onLaneHit(3))
    // WASD
    kb.on('keydown-A', () => this.onLaneHit(0))
    kb.on('keydown-S', () => this.onLaneHit(1))
    kb.on('keydown-W', () => this.onLaneHit(2))
    kb.on('keydown-D', () => this.onLaneHit(3))

    // Touch / click på lanerne (for mobil)
    for (let i = 0; i < HIGHWAY.LANE_COUNT; i++) {
      const x = this.laneX(i)
      const hotzone = this.add
        .rectangle(x, HIGHWAY.HIT_ZONE_Y, HIGHWAY.LANE_WIDTH, 140, 0xffffff, 0.001)
        .setDepth(DEPTH.HUD + 1)
      hotzone.setInteractive({ useHandCursor: true })
      hotzone.on('pointerdown', () => this.onLaneHit(i))
    }
  }

  private runCountdown() {
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2 - 40
    const steps = [
      { text: '3', color: '#ff3b6b' },
      { text: '2', color: '#ffd447' },
      { text: '1', color: '#4de0a1' },
      { text: 'DANS!', color: '#ffffff' },
    ]
    let i = 0
    const show = () => {
      if (i >= steps.length) return
      const step = steps[i]
      const t = this.add
        .text(cx, cy, step.text, {
          fontFamily: 'Space Grotesk, system-ui, sans-serif',
          fontSize: '120px',
          color: step.color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.DIALOG)
        .setStroke('#000000', 6)
      t.setAlpha(0)
      t.setScale(0.3)
      this.tweens.add({
        targets: t,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.3, to: 1.2 },
        duration: 160,
        yoyo: true,
        hold: 300,
        ease: 'Cubic.out',
        onComplete: () => t.destroy(),
      })
      i++
      this.time.delayedCall(600, show)
    }
    show()
  }

  override update(_time: number, delta: number) {
    if (!this.audio?.isRunning()) return

    const now = this.audio.now()

    // End condition
    if (!this.gameEnded && now > LEVEL.DURATION_MS) {
      this.endGame()
      return
    }

    // Beat tracking
    const beatIdx = Math.floor((now / 60000) * LEVEL.BPM)
    if (beatIdx !== this.lastBeat) {
      this.lastBeat = beatIdx
      this.onBeat(beatIdx)
    }

    // Scroll background — faster med combo (følelsen af "hastigere parade")
    const scrollSpeed = Phaser.Math.Clamp(
      LEVEL.SCROLL_BASE + this.combo * 2,
      LEVEL.SCROLL_BASE,
      LEVEL.SCROLL_MAX,
    )
    this.bgFar.tilePositionX += (scrollSpeed / 3) * (delta / 1000)
    this.bgMid.tilePositionX += (scrollSpeed / 1.6) * (delta / 1000)
    this.streetStripeOffset = (this.streetStripeOffset + scrollSpeed * (delta / 1000)) % 160
    this.drawStreet()

    // Spawn chart notes der er inden for TRAVEL_MS
    while (
      this.nextChartIdx < this.chart.length &&
      this.chart[this.nextChartIdx].hitTimeMs - now <= HIGHWAY.TRAVEL_MS
    ) {
      this.spawnNote(this.chart[this.nextChartIdx])
      this.nextChartIdx++
    }

    // Opdater aktive notes
    for (const ns of this.activeNotes) {
      const n = ns.note
      if (n.hit) continue
      const y = noteY(now, n.hitTimeMs)
      ns.sprite.y = y
      // Subtle glow pulse
      ns.sprite.setScale(1 + Math.sin(now / 60) * 0.04)

      // Check miss (timeout — note passerede gennem hit-zonen uden input)
      if (now - n.hitTimeMs > TIMING.MISS) {
        n.hit = true
        n.judgement = 'miss'
        this.missCount++
        this.applyMiss(n.lane, ns.sprite)
      }
    }

    // Rens færdige notes
    this.activeNotes = this.activeNotes.filter(ns => {
      if (ns.note.hit && ns.sprite.alpha <= 0.05) {
        ns.sprite.destroy()
        return false
      }
      return true
    })

    // Update Jim
    this.jim.update(now)
  }

  private spawnNote(n: Note) {
    const x = this.laneX(n.lane)
    const tex = n.type === 'beer' ? TEX.BEER_NOTE : this.laneArrowTex(n.lane)
    const sprite = this.add
      .image(x, HIGHWAY.SPAWN_Y, tex)
      .setDepth(DEPTH.NOTE)
      .setScale(0.95)
    if (n.type === 'beer') {
      // Subtle wobble
      this.tweens.add({
        targets: sprite,
        angle: { from: -6, to: 6 },
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    }
    this.activeNotes.push({ note: n, sprite, spawned: true })
  }

  private onBeat(beatIdx: number) {
    const measureBeat = beatIdx % 4
    const isDownbeat = measureBeat === 0

    this.lars.onBeat(isDownbeat)
    this.jim.onBeat()

    // Follower flocking
    for (const f of this.followers) {
      f.onBeat(this.lars.x, this.lars.y, isDownbeat)
    }

    // Pulse receptors
    for (const r of this.receptors) {
      this.tweens.add({
        targets: r,
        scale: { from: 1.1, to: 1 },
        alpha: { from: 1, to: 0.7 },
        duration: 180,
        ease: 'Cubic.out',
      })
    }

    // Beat ring fra Lars' fødder (kun på downbeat)
    if (isDownbeat) {
      this.beatRingFx.setAlpha(0.8).setScale(0.8)
      this.beatRingFx.setPosition(this.lars.x, this.lars.y + 4)
      this.tweens.add({
        targets: this.beatRingFx,
        scale: { from: 0.8, to: 3.2 },
        alpha: { from: 0.8, to: 0 },
        duration: 420,
        ease: 'Cubic.out',
      })
    }
  }

  private onLaneHit(lane: number) {
    if (this.gameEnded) return
    const now = this.audio.now()

    // Find nærmeste un-hit note i denne lane inden for MISS-window
    let best: NoteSprite | null = null
    let bestDt = Infinity
    for (const ns of this.activeNotes) {
      if (ns.note.lane !== lane || ns.note.hit) continue
      const dt = Math.abs(now - ns.note.hitTimeMs)
      if (dt < bestDt) {
        bestDt = dt
        best = ns
      }
    }

    // Visuel input feedback (lane flash) uanset om der er hit
    this.flashLane(lane)

    if (!best || bestDt > TIMING.MISS) {
      // "Blank press" — tæller ikke som miss men ingen score
      return
    }

    const abs = bestDt
    let judge: 'perfect' | 'great' | 'good' | 'miss'
    let scoreGain = 0
    if (abs <= TIMING.PERFECT) {
      judge = 'perfect'
      scoreGain = SCORE.PERFECT
      this.perfectCount++
    } else if (abs <= TIMING.GREAT) {
      judge = 'great'
      scoreGain = SCORE.GREAT
      this.greatCount++
    } else if (abs <= TIMING.GOOD) {
      judge = 'good'
      scoreGain = SCORE.GOOD
      this.goodCount++
    } else {
      judge = 'miss'
      this.missCount++
    }

    best.note.hit = true
    best.note.judgement = judge

    // Combo-multiplier
    if (judge === 'miss') {
      this.applyMiss(lane, best.sprite)
      return
    }

    this.combo++
    this.maxCombo = Math.max(this.maxCombo, this.combo)

    const multiplier = 1 + Math.min(3, Math.floor(this.combo / 20) * 0.5)
    let finalGain = Math.round(scoreGain * multiplier)
    if (best.note.type === 'beer') finalGain *= 2
    this.score += finalGain

    // Viking meter
    const meterGain = judge === 'perfect' ? 3 : judge === 'great' ? 2 : 1
    this.vikingMeter = Phaser.Math.Clamp(this.vikingMeter + meterGain, 0, 100)

    // Addér follower(s) — perfect = 2, great = 1, good = 1 (min), beer = +3 bonus
    const followersAdded =
      best.note.type === 'beer' ? 3 : judge === 'perfect' ? 2 : 1
    for (let i = 0; i < followersAdded; i++) {
      this.addFollower()
    }

    // Transform check
    const stageChanged = this.lars.updateFollowerCount(this.followers.length)
    if (stageChanged) {
      this.flashStageBanner()
    }

    // FX
    this.playHitFx(judge, lane, best.sprite, best.note.type === 'beer')
    this.audio.playHitSfx(best.note.type === 'beer' ? 'beer' : judge)

    // HUD
    this.events.emit('tv-hud', {
      score: this.score,
      combo: this.combo,
      followers: this.followers.length,
      vikingMeter: this.vikingMeter,
      stageIndex: this.lars.stageIndex,
    })
    this.events.emit('tv-judgement', { judge, x: this.laneX(lane), type: best.note.type })
  }

  private applyMiss(lane: number, sprite: Phaser.GameObjects.Image) {
    // Fade note ud, reset combo, lille camera shake, viking meter -5
    this.combo = 0
    this.vikingMeter = Math.max(0, this.vikingMeter - 5)

    // Mist 1-2 followers
    const lose = Math.min(this.followers.length, 1 + Math.random() < 0.5 ? 1 : 0)
    for (let i = 0; i < lose; i++) this.removeFollower()

    // Viking stage kan også falde tilbage
    this.lars.updateFollowerCount(this.followers.length)

    this.tweens.add({
      targets: sprite,
      alpha: 0,
      y: sprite.y + 30,
      duration: 300,
      ease: 'Cubic.out',
    })
    this.cameras.main.shake(80, 0.004)

    this.audio.playHitSfx('miss')
    this.events.emit('tv-hud', {
      score: this.score,
      combo: this.combo,
      followers: this.followers.length,
      vikingMeter: this.vikingMeter,
      stageIndex: this.lars.stageIndex,
    })
    this.events.emit('tv-judgement', { judge: 'miss', x: this.laneX(lane), type: 'arrow' })
  }

  private flashLane(lane: number) {
    const x = this.laneX(lane)
    const flash = this.add
      .rectangle(x, HIGHWAY.HIT_ZONE_Y, HIGHWAY.LANE_WIDTH - 8, 140, 0xffffff, 0.35)
      .setDepth(DEPTH.NOTE_LANE_BG + 1)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 160,
      onComplete: () => flash.destroy(),
    })
  }

  private playHitFx(
    judge: 'perfect' | 'great' | 'good',
    lane: number,
    noteSprite: Phaser.GameObjects.Image,
    isBeer: boolean,
  ) {
    const x = this.laneX(lane)
    const y = HIGHWAY.HIT_ZONE_Y
    const color = isBeer
      ? COLORS.LANE_BEER
      : judge === 'perfect'
        ? COLORS.JUDGE_PERFECT
        : judge === 'great'
          ? COLORS.JUDGE_GREAT
          : COLORS.JUDGE_GOOD

    // Spark
    const spark = this.add
      .image(x, y, TEX.HIT_SPARK)
      .setTint(color)
      .setDepth(DEPTH.HIT_FX)
      .setScale(0.5)
      .setAlpha(0.9)
    this.tweens.add({
      targets: spark,
      scale: 2.5,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.out',
      onComplete: () => spark.destroy(),
    })

    // Note fade up
    this.tweens.add({
      targets: noteSprite,
      alpha: 0,
      scale: 1.4,
      y: y - 30,
      duration: 220,
      ease: 'Cubic.out',
    })
  }

  private addFollower() {
    const f = new Follower(this, this.lars.x, this.lars.y, this.followers.length)
    this.followers.push(f)
  }

  private removeFollower() {
    const f = this.followers.pop()
    if (!f) return
    this.tweens.add({
      targets: f.sprite,
      alpha: 0,
      y: f.sprite.y + 40,
      duration: 280,
      onComplete: () => f.destroy(),
    })
  }

  private flashStageBanner() {
    const cx = GAME_WIDTH / 2
    const cy = 220
    const name = STAGE_NAMES[this.lars.stageIndex]
    const banner = this.add.container(cx, cy).setDepth(DEPTH.DIALOG)
    const bg = this.add
      .rectangle(0, 0, 520, 80, 0x1a0a0a, 0.92)
      .setStrokeStyle(3, COLORS.LARS_TATTOO_GLOW)
    const label = this.add
      .text(0, -8, '↑ STAGE UP ↑', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#ff9ac2',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    const title = this.add
      .text(0, 16, name.toUpperCase(), {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffd447',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    banner.add([bg, label, title])
    banner.setScale(0.3).setAlpha(0)
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 240,
      ease: 'Back.out',
    })
    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: cy - 20,
        duration: 260,
        onComplete: () => banner.destroy(),
      })
    })

    this.audio.playHitSfx('crowd')
  }

  private endGame() {
    this.gameEnded = true
    this.audio.stop()

    // Persist highscore
    const prevHi = Number(localStorage.getItem(STORAGE.HIGHSCORE) || 0)
    const prevMaxCombo = Number(localStorage.getItem(STORAGE.MAX_COMBO) || 0)
    if (this.score > prevHi) {
      localStorage.setItem(STORAGE.HIGHSCORE, String(this.score))
    }
    if (this.maxCombo > prevMaxCombo) {
      localStorage.setItem(STORAGE.MAX_COMBO, String(this.maxCombo))
    }

    this.cameras.main.fadeOut(500, 10, 5, 15)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENE.HUD)
      this.scene.start(SCENE.RESULTS, {
        score: this.score,
        maxCombo: this.maxCombo,
        perfect: this.perfectCount,
        great: this.greatCount,
        good: this.goodCount,
        miss: this.missCount,
        followers: this.followers.length,
        stageName: STAGE_NAMES[this.lars.stageIndex],
        isNewHi: this.score > prevHi,
      })
    })
  }

  private retryLevel() {
    this.audio?.stop()
    this.scene.stop(SCENE.HUD)
    this.scene.restart()
  }

  private exitToMenu() {
    this.audio?.stop()
    this.scene.stop(SCENE.HUD)
    this.scene.start(SCENE.MENU)
  }

  private shutdown() {
    this.audio?.stop()
    for (const ns of this.activeNotes) ns.sprite.destroy()
    this.activeNotes = []
    for (const f of this.followers) f.destroy()
    this.followers = []
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
  }
}
