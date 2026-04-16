import Phaser from 'phaser'
import {
  ASSET,
  BOSS_KILL_POINTS,
  DEPTH,
  ENEMY_KILL_POINTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_POINTS,
  SCENE,
  STARTING_LIVES,
  WORLD_GRAVITY,
} from '../constants'
import { LarsPlayer } from '../entities/LarsPlayer'
import { SurtrBoss } from '../entities/bosses/SurtrBoss'
import { BiomeParticles } from '../fx/BiomeParticles'
import { HitFx } from '../fx/HitFx'
import { Sound } from '../audio/Sound'

const LEVEL_WIDTH = 5200
const GROUND_Y = GAME_HEIGHT - 80
const BOSS_ARENA_X = 4700

type EnemyKind = 'drauger' | 'fenris' | 'huginn'

interface PlatformDef { x: number, y: number, w?: number }
interface EnemySpawn {
  x: number
  y: number
  kind: EnemyKind
  patrolDist?: number
  sinAmplitude?: number // kun for huginn
  sinSpeed?: number
}
interface PickupSpawn { x: number, y: number }

/**
 * Level 1: Moserne — første level i Vejen til Valhalla.
 *
 * Polish-version (ikke MVP):
 * - 3 fjende-typer: mose-drauger (patrol + walk-anim), fenris-hvalp (hurtigere),
 *   huginn-krage (flyver i sinus-bane)
 * - Mist-partikler (2 lag) for sump-stemning
 * - 15 øl-pickups fordelt over hele banen
 * - Dalmatiner & Porsche-Easter-eggs (via texturer, se EnemyTextureBuilder)
 * - Surtr-boss i arena ved x=4700 med 3 faser
 * - Jim-crow intro: flyver ind efter 2 sek, dropper scroll, tekst vises
 * - Level-complete screen med summary
 */
export class Level1Scene extends Phaser.Scene {
  private lars!: LarsPlayer
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private bossRocks!: Phaser.Physics.Arcade.Group
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgMid!: Phaser.GameObjects.TileSprite
  private bgNear!: Phaser.GameObjects.TileSprite
  private score = 0
  private gameOverShown = false
  private boss?: SurtrBoss
  private bossSpawned = false
  private bossDefeated = false
  private jimCrow?: Phaser.GameObjects.Sprite
  private introPlayed = false

  constructor() {
    super({ key: SCENE.LEVEL1 })
  }

  create() {
    this.score = 0
    this.gameOverShown = false
    this.bossSpawned = false
    this.bossDefeated = false
    this.introPlayed = false
    this.boss = undefined
    this.jimCrow = undefined

    // Verdens-grænser
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT)
    this.physics.world.gravity.y = WORLD_GRAVITY

    // Parallax-baggrunde
    this.bgFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, ASSET.BG_FAR_L1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.BG_FAR)
    this.bgMid = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, ASSET.BG_MID_L1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.BG_MID)
    this.bgNear = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, ASSET.BG_NEAR_L1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.BG_NEAR)

    // Biome-atmosfære (tåge)
    BiomeParticles.createMist(this, 0x9ac8a0)
    BiomeParticles.createLowFog(this, 0x607a60)

    // Ground + platforme
    this.platforms = this.physics.add.staticGroup()
    this.makeGround()
    this.makePlatforms()

    // Boss-arena-væg (synlig kolonne der blokerer boss-areal)
    this.makeBossArena()

    // Lars
    this.lars = new LarsPlayer(this, 120, GROUND_Y - 120)
    this.lars.lives = STARTING_LIVES
    this.physics.add.collider(this.lars.sprite, this.platforms)

    // Enemies
    this.enemies = this.physics.add.group({ allowGravity: true, bounceX: 0, bounceY: 0 })
    this.makeEnemies()
    this.physics.add.collider(this.enemies, this.platforms)
    this.physics.add.overlap(this.lars.sprite, this.enemies, this.handleEnemyOverlap, undefined, this)

    // Pickups
    this.pickups = this.physics.add.group({ allowGravity: false })
    this.makePickups()
    this.physics.add.overlap(this.lars.sprite, this.pickups, this.handlePickup, undefined, this)

    // Boss-projektiler (rocks)
    this.bossRocks = this.physics.add.group({ allowGravity: true })
    this.physics.add.collider(this.bossRocks, this.platforms, (rock) => {
      // Rocks smadrer når de rammer jorden
      const r = rock as Phaser.Physics.Arcade.Sprite
      HitFx.pickupBurst(this, r.x, r.y, 0xff4020)
      r.destroy()
    })
    this.physics.add.overlap(this.lars.sprite, this.bossRocks, (_l, rock) => {
      const r = rock as Phaser.Physics.Arcade.Sprite
      HitFx.pickupBurst(this, r.x, r.y, 0xff4020)
      r.destroy()
      const hit = this.lars.takeHit(this.time.now)
      if (hit) this.scene.get(SCENE.HUD).events.emit('lives', this.lars.lives)
    })

    // Camera
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT)
    this.cameras.main.startFollow(this.lars.sprite, true, 0.1, 0.1)
    this.cameras.main.setDeadzone(GAME_WIDTH * 0.25, 200)
    this.cameras.main.fadeIn(500, 0, 0, 0)

    // Start HUD
    this.scene.launch(SCENE.HUD, {
      lives: this.lars.lives,
      score: 0,
      level: 'MOSERNE',
    })

    // ESC = tilbage til menu
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.stop(SCENE.HUD)
      this.scene.start(SCENE.MENU)
    })

    // Intro-cutscene efter 1.8 sek (lade fade-in afslutte først)
    this.time.delayedCall(1800, () => this.playJimCrowIntro())

    Sound.music('level1')
  }

  override update(time: number, dt: number) {
    if (this.gameOverShown) return

    this.lars.update(time, dt)

    // Parallax
    const camX = this.cameras.main.scrollX
    this.bgFar.tilePositionX = camX * 0.15
    this.bgMid.tilePositionX = camX * 0.45
    this.bgNear.tilePositionX = camX * 0.8

    // Fjender AI
    this.enemies.children.iterate((obj: Phaser.GameObjects.GameObject) => {
      if (!obj.active) return null
      const e = obj as Phaser.Physics.Arcade.Sprite & {
        startX?: number
        startY?: number
        patrolDist?: number
        dir?: number
        kind?: EnemyKind
        sinAmplitude?: number
        sinSpeed?: number
        sinTime?: number
        speedBase?: number
      }
      if (!e.body) return null
      const startX = e.startX ?? e.x
      const dist = e.patrolDist ?? 120
      let dir = e.dir ?? 1
      const baseSpeed = e.speedBase ?? 60
      if (e.x > startX + dist) dir = -1
      else if (e.x < startX - dist) dir = 1
      e.dir = dir
      e.setVelocityX(baseSpeed * dir)
      e.setFlipX(dir < 0)

      // Huginn-krage — ignorerer tyngdekraft, svæver i sinus
      if (e.kind === 'huginn') {
        const body = e.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(false)
        e.sinTime = (e.sinTime ?? 0) + dt * 0.001
        const startY = e.startY ?? e.y
        const amp = e.sinAmplitude ?? 40
        const spd = e.sinSpeed ?? 2
        e.y = startY + Math.sin(e.sinTime * spd) * amp
        e.setVelocityY(0)
      }
      return null
    })

    // Scared-mood ved nærhed
    if (!this.gameOverShown) {
      let nearestDist = Infinity
      this.enemies.children.iterate((obj: Phaser.GameObjects.GameObject) => {
        const e = obj as Phaser.Physics.Arcade.Sprite
        if (!e.active) return null
        const d = Phaser.Math.Distance.Between(this.lars.sprite.x, this.lars.sprite.y, e.x, e.y)
        if (d < nearestDist) nearestDist = d
        return null
      })
      if (nearestDist < 80) this.lars.setMood('scared', 200)
    }

    // Spawn boss når Lars krydser tærsklen
    if (!this.bossSpawned && this.lars.sprite.x > BOSS_ARENA_X - 300) {
      this.spawnBoss()
    }

    // Opdater boss
    if (this.boss && !this.boss.isDead()) {
      this.boss.update(time, dt)
    }

    // Faldt ud af verden
    if (this.lars.sprite.y > GAME_HEIGHT + 100) {
      const hit = this.lars.takeHit(time)
      if (hit) this.respawnLars()
    }

    // Level complete
    if (this.bossDefeated && !this.gameOverShown) {
      if (time > this.bossDefeatTime + 2500) {
        this.handleLevelComplete()
      }
    }

    if (this.lars.isDead() && !this.gameOverShown) {
      this.handleGameOver()
    }
  }

  // ---------- Setup ----------

  private makeGround() {
    for (let x = 0; x < LEVEL_WIDTH; x += 64) {
      const tile = this.add.image(x, GROUND_Y + 20, ASSET.TEX_GROUND).setOrigin(0, 0.5)
      this.platforms.add(tile)
    }
    this.platforms.refresh()
  }

  private makePlatforms() {
    const defs: PlatformDef[] = [
      { x: 500, y: GROUND_Y - 140 },
      { x: 850, y: GROUND_Y - 220 },
      { x: 1250, y: GROUND_Y - 170 },
      { x: 1650, y: GROUND_Y - 260 },
      { x: 2050, y: GROUND_Y - 200, w: 140 },
      { x: 2450, y: GROUND_Y - 290 },
      { x: 2850, y: GROUND_Y - 220 },
      { x: 3250, y: GROUND_Y - 310 },
      { x: 3650, y: GROUND_Y - 240 },
      { x: 4050, y: GROUND_Y - 280 },
      { x: 4350, y: GROUND_Y - 180 },
    ]
    for (const d of defs) {
      const plat = this.add.image(d.x, d.y, ASSET.TEX_PLATFORM).setOrigin(0.5, 0.5)
      if (d.w) plat.setDisplaySize(d.w, 24)
      this.platforms.add(plat)
    }
    this.platforms.refresh()
  }

  private makeBossArena() {
    // Entrance-totem (subtil markør lige FØR boss-zonen)
    const totem = this.add.rectangle(BOSS_ARENA_X - 350, GROUND_Y - 60, 12, 120, 0x3a2010)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.WORLD)
    this.add.text(BOSS_ARENA_X - 350, GROUND_Y - 200, '⚔', {
      fontSize: '38px',
      color: '#F5A623',
    }).setOrigin(0.5)
    void totem
  }

  private makeEnemies() {
    const spawns: EnemySpawn[] = [
      // Mose-draugers (3) — patruljerer på jorden
      { x: 650, y: GROUND_Y - 30, kind: 'drauger', patrolDist: 100 },
      { x: 1850, y: GROUND_Y - 30, kind: 'drauger', patrolDist: 120 },
      { x: 3400, y: GROUND_Y - 30, kind: 'drauger', patrolDist: 120 },
      // Fenris-hvalpe (2) — hurtige, mindre
      { x: 1350, y: GROUND_Y - 20, kind: 'fenris', patrolDist: 150 },
      { x: 3000, y: GROUND_Y - 20, kind: 'fenris', patrolDist: 130 },
      // Huginn-krager (3) — flyver i sinus
      { x: 1600, y: GROUND_Y - 220, kind: 'huginn', patrolDist: 180, sinAmplitude: 40, sinSpeed: 1.6 },
      { x: 2700, y: GROUND_Y - 280, kind: 'huginn', patrolDist: 160, sinAmplitude: 50, sinSpeed: 1.8 },
      { x: 3900, y: GROUND_Y - 260, kind: 'huginn', patrolDist: 200, sinAmplitude: 35, sinSpeed: 1.4 },
    ]

    for (const s of spawns) {
      const tex =
        s.kind === 'drauger' ? ASSET.TEX_MOSE_DRAUGER
          : s.kind === 'fenris' ? ASSET.TEX_FENRIS_HVALP
            : ASSET.TEX_HUGINN_KRAGE

      const e = this.enemies.create(s.x, s.y, tex) as Phaser.Physics.Arcade.Sprite & {
        startX: number
        startY: number
        patrolDist: number
        dir: number
        kind: EnemyKind
        sinAmplitude?: number
        sinSpeed?: number
        sinTime?: number
        speedBase: number
      }
      e.setDepth(DEPTH.ENEMIES)
      e.setCollideWorldBounds(false)
      e.startX = s.x
      e.startY = s.y
      e.patrolDist = s.patrolDist ?? 100
      e.dir = 1
      e.kind = s.kind
      e.sinTime = 0
      e.sinAmplitude = s.sinAmplitude
      e.sinSpeed = s.sinSpeed

      if (s.kind === 'drauger') {
        e.speedBase = 60
        e.body!.setSize(36, 52, true)
      } else if (s.kind === 'fenris') {
        e.speedBase = 120 // hurtigere
        e.body!.setSize(42, 30, true)
      } else {
        e.speedBase = 100
        e.body!.setSize(36, 28, true)
        const body = e.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(false)
      }
    }
  }

  private makePickups() {
    // 15 øl-pickups fordelt over hele banen
    const spawns: PickupSpawn[] = [
      { x: 350, y: GROUND_Y - 60 },
      { x: 500, y: GROUND_Y - 180 },
      { x: 850, y: GROUND_Y - 260 },
      { x: 1100, y: GROUND_Y - 60 },
      { x: 1250, y: GROUND_Y - 210 },
      { x: 1650, y: GROUND_Y - 300 },
      { x: 1950, y: GROUND_Y - 60 },
      { x: 2250, y: GROUND_Y - 220 },
      { x: 2450, y: GROUND_Y - 330 },
      { x: 2700, y: GROUND_Y - 60 },
      { x: 2850, y: GROUND_Y - 260 },
      { x: 3250, y: GROUND_Y - 350 },
      { x: 3500, y: GROUND_Y - 60 },
      { x: 3650, y: GROUND_Y - 280 },
      { x: 4050, y: GROUND_Y - 320 },
    ]
    for (const s of spawns) {
      const p = this.pickups.create(s.x, s.y, ASSET.TEX_BEER) as Phaser.Physics.Arcade.Sprite
      p.setDepth(DEPTH.PICKUPS)
      this.tweens.add({
        targets: p,
        y: p.y - 8,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      // Lille spin på etiket
      this.tweens.add({
        targets: p,
        angle: 8,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  // ---------- Intro: Jim-crow dropper scroll ----------

  private playJimCrowIntro() {
    if (this.introPlayed) return
    this.introPlayed = true

    const startX = this.lars.sprite.x + 600
    const dropX = this.lars.sprite.x + 140
    const flyY = 120

    this.jimCrow = this.add.sprite(startX, flyY, ASSET.TEX_JIM_CROW)
      .setDepth(DEPTH.PARTICLES)
      .setFlipX(true)

    // Flap animation (scaleY pulse)
    this.tweens.add({
      targets: this.jimCrow,
      scaleY: 0.85,
      scaleX: 1.05,
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Fly ind, drop scroll, fly ud
    this.tweens.add({
      targets: this.jimCrow,
      x: dropX,
      y: flyY - 20,
      duration: 2200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Drop scroll
        if (!this.jimCrow) return
        const scroll = this.add.sprite(this.jimCrow.x, this.jimCrow.y + 10, ASSET.TEX_SCROLL)
          .setDepth(DEPTH.PICKUPS)
        this.physics.add.existing(scroll)
        const body = scroll.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(true)
        body.setVelocityY(50)
        this.physics.add.collider(scroll, this.platforms, () => {
          body.setVelocity(0, 0)
          body.setAllowGravity(false)
          // Vis dialog
          this.showJimDialogue()
          // Fade scroll efter et stykke tid
          this.time.delayedCall(4500, () => {
            this.tweens.add({
              targets: scroll,
              alpha: 0,
              duration: 600,
              onComplete: () => scroll.destroy(),
            })
          })
        })

        // Krage flyver videre væk
        this.tweens.add({
          targets: this.jimCrow,
          x: this.lars.sprite.x - 400,
          y: 60,
          duration: 2500,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.jimCrow?.destroy()
            this.jimCrow = undefined
          },
        })
      },
    })
  }

  private showJimDialogue() {
    const cam = this.cameras.main
    const boxW = 560
    const boxH = 90
    const boxX = cam.worldView.centerX
    const boxY = cam.worldView.y + GAME_HEIGHT - 130

    const box = this.add.rectangle(boxX, boxY, boxW, boxH, 0x0a0a0f, 0.9)
      .setStrokeStyle(2, 0xf5a623)
      .setScrollFactor(0)
      .setDepth(DEPTH.DIALOG)
    const title = this.add.text(boxX - boxW / 2 + 14, boxY - boxH / 2 + 10, 'Jim Lyngvild', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '16px',
      color: '#F5A623',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(DEPTH.DIALOG)

    const text = this.add.text(boxX - boxW / 2 + 14, boxY - boxH / 2 + 34,
      '"Lars. Mød mig på toppen af bjerget.\nOg pas på mosedraugerne — de bider."', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '17px',
      color: '#ffffff',
      wordWrap: { width: boxW - 28 },
    }).setScrollFactor(0).setDepth(DEPTH.DIALOG)

    // Fade-in
    box.setAlpha(0); title.setAlpha(0); text.setAlpha(0)
    this.tweens.add({
      targets: [box, title, text],
      alpha: 1,
      duration: 400,
    })

    // Fade-out efter 4 sek
    this.time.delayedCall(4000, () => {
      this.tweens.add({
        targets: [box, title, text],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          box.destroy()
          title.destroy()
          text.destroy()
        },
      })
    })
  }

  // ---------- Boss ----------

  private spawnBoss() {
    if (this.bossSpawned) return
    this.bossSpawned = true

    // Boss spawner ved højre kant af arenaen
    this.boss = new SurtrBoss(
      this,
      BOSS_ARENA_X + 200,
      GROUND_Y - 80,
      this.lars.sprite,
      this.bossRocks,
    )
    this.physics.add.collider(this.boss.sprite, this.platforms)
    this.physics.add.overlap(this.lars.sprite, this.boss.sprite, this.handleBossOverlap, undefined, this)

    // Boss-intro-tekst
    const cam = this.cameras.main
    const title = this.add.text(cam.worldView.centerX, cam.worldView.y + 140, 'SURTR', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#FF4020',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH.DIALOG).setScrollFactor(0).setAlpha(0)
    const subtitle = this.add.text(cam.worldView.centerX, cam.worldView.y + 200, 'ILDJÆTTEN AF MOSERNE', {
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
      fontSize: '20px',
      color: '#F5A623',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.DIALOG).setScrollFactor(0).setAlpha(0)
    this.tweens.add({
      targets: [title, subtitle],
      alpha: 1,
      duration: 600,
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        title.destroy()
        subtitle.destroy()
      },
    })

    HitFx.shake(this, 'big')

    // HUD får besked om boss
    this.scene.get(SCENE.HUD).events.emit('boss-start', {
      name: 'SURTR',
      hp: this.boss.hp,
      hpMax: this.boss.hpMax,
    })

    // Lyt til boss-events → HUD
    this.events.on('boss-hp', (d: { hp: number, hpMax: number }) => {
      this.scene.get(SCENE.HUD).events.emit('boss-hp', d)
    })
    this.events.on('boss-death', () => {
      this.scene.get(SCENE.HUD).events.emit('boss-death')
      this.handleBossDeath()
    })
  }

  private handleBossOverlap = (_lars: unknown, bossSprite: unknown) => {
    if (!this.boss) return
    const body = this.lars.sprite.body as Phaser.Physics.Arcade.Body
    const bossBody = (bossSprite as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body
    if (!body || !bossBody) return

    // Stomp? (samme logik som fjender)
    const isStomp = body.velocity.y > 80 && this.lars.sprite.y < (bossSprite as Phaser.Physics.Arcade.Sprite).y - 30
    if (isStomp) {
      const hit = this.boss.takeHit(this.time.now)
      if (hit) {
        this.lars.sprite.setVelocityY(-500)
        HitFx.popText(this, this.lars.sprite.x, this.lars.sprite.y - 20, '-1 HP', '#FF4040')
      }
      return
    }

    // Ellers tag damage
    const hit = this.lars.takeHit(this.time.now)
    if (hit) this.scene.get(SCENE.HUD).events.emit('lives', this.lars.lives)
  }

  private bossDefeatTime = 0

  private handleBossDeath() {
    this.bossDefeated = true
    this.bossDefeatTime = this.time.now
    this.score += BOSS_KILL_POINTS
    this.scene.get(SCENE.HUD).events.emit('score', this.score)
    this.lars.setMood('victory', 2500)
    HitFx.popText(this, this.lars.sprite.x, this.lars.sprite.y - 60, `+${BOSS_KILL_POINTS}`, '#FFD700', { fontSize: '28px', rise: 80, duration: 1500 })
    Sound.sfx('boss-death')
  }

  // ---------- Collision ----------

  private handlePickup = (_lars: unknown, pickup: unknown) => {
    const p = pickup as Phaser.Physics.Arcade.Sprite
    if (!p.active) return
    p.disableBody(true, true)
    this.score += ITEM_POINTS
    this.scene.get(SCENE.HUD).events.emit('score', this.score)
    this.lars.setMood('happy', 400)
    Sound.sfx('pickup')
    HitFx.pickupBurst(this, p.x, p.y, 0xffd700)
    HitFx.popText(this, p.x, p.y - 20, `+${ITEM_POINTS}`, '#F5A623')
  }

  private handleEnemyOverlap = (_lars: unknown, enemy: unknown) => {
    const e = enemy as Phaser.Physics.Arcade.Sprite
    const larsBody = this.lars.sprite.body as Phaser.Physics.Arcade.Body
    const enemyBody = e.body as Phaser.Physics.Arcade.Body
    if (!e.active || !larsBody || !enemyBody) return

    // Stomp: Lars falder ned ovenpå
    const isStomp = larsBody.velocity.y > 50 && this.lars.sprite.y < e.y - 10
    if (isStomp) {
      HitFx.pickupBurst(this, e.x, e.y, 0x3a5a2a)
      e.disableBody(true, true)
      this.score += ENEMY_KILL_POINTS
      this.scene.get(SCENE.HUD).events.emit('score', this.score)
      this.lars.sprite.setVelocityY(-400)
      Sound.sfx('stomp')
      HitFx.popText(this, e.x, e.y - 20, `+${ENEMY_KILL_POINTS}`, '#00D68F')
      return
    }

    const hit = this.lars.takeHit(this.time.now)
    if (hit) this.scene.get(SCENE.HUD).events.emit('lives', this.lars.lives)
  }

  private respawnLars() {
    this.lars.sprite.setPosition(Math.max(120, this.lars.sprite.x - 200), GROUND_Y - 100)
    this.lars.sprite.setVelocity(0, 0)
    this.scene.get(SCENE.HUD).events.emit('lives', this.lars.lives)
  }

  // ---------- End-states ----------

  private handleGameOver() {
    this.gameOverShown = true
    this.cameras.main.fade(600, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENE.HUD)
      this.scene.start(SCENE.GAMEOVER, { won: false, score: this.score })
    })
  }

  private handleLevelComplete() {
    this.gameOverShown = true
    Sound.sfx('level-complete')
    this.cameras.main.fade(900, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENE.HUD)
      this.scene.start(SCENE.GAMEOVER, {
        won: true,
        score: this.score,
        level: 'MOSERNE',
        nextTeaser: 'Skoven venter...',
      })
    })
  }
}
