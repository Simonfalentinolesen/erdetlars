import Phaser from 'phaser'
import {
  ASSET,
  COIN_POINTS,
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

const LEVEL_WIDTH = 4800 // 4x screen-bredder
const GROUND_Y = GAME_HEIGHT - 80

interface PlatformDef { x: number, y: number, w?: number }
interface EnemySpawn { x: number, y: number, patrolDist?: number }
interface PickupSpawn { x: number, y: number }

/**
 * Level 1: Moserne — første level i Vejen til Valhalla.
 *
 * Designvalg:
 * - Procedurelt placerede platforme + fjender (data-driven)
 * - Parallax-baggrunde scroller med kameraet (3 lag, eksisterende V1-assets)
 * - Mose-drauger patruljerer; spilleren kan stomp'e dem ved at lande oven på dem
 * - Øl-pickups giver point + happy-mood
 * - Boss (Surtr) ved x=4500 — V1-V2 milepæl: hvis vi når hertil, virker arkitekturen
 *
 * HUD køres i separat scene (overlay) så vi kan opdatere score uden at re-render world.
 */
export class Level1Scene extends Phaser.Scene {
  private lars!: LarsPlayer
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private pickups!: Phaser.Physics.Arcade.Group
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgMid!: Phaser.GameObjects.TileSprite
  private bgNear!: Phaser.GameObjects.TileSprite
  private score = 0
  private gameOverShown = false

  constructor() {
    super({ key: SCENE.LEVEL1 })
  }

  create() {
    this.score = 0
    this.gameOverShown = false

    // Verdens-grænser — bredere end view
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT)
    this.physics.world.gravity.y = WORLD_GRAVITY

    // Parallax baggrunde — TileSprite scroller automatisk når vi sætter tilePositionX
    this.bgFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, ASSET.BG_FAR_L1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.BG_FAR)
    this.bgMid = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, ASSET.BG_MID_L1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.BG_MID)
    this.bgNear = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, ASSET.BG_NEAR_L1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.BG_NEAR)

    // Ground (en lang flad linje for nu — kan tilføje huller senere)
    this.platforms = this.physics.add.staticGroup()
    this.makeGround()
    this.makePlatforms()

    // Lars
    this.lars = new LarsPlayer(this, 100, GROUND_Y - 100)
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

    // Camera følger Lars
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT)
    this.cameras.main.startFollow(this.lars.sprite, true, 0.1, 0.1)
    this.cameras.main.setDeadzone(GAME_WIDTH * 0.25, 200)
    this.cameras.main.fadeIn(400, 0, 0, 0)

    // Start HUD overlay
    this.scene.launch(SCENE.HUD, { lives: this.lars.lives, score: 0, level: 'MOSERNE' })

    // ESC = tilbage til menu
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.stop(SCENE.HUD)
      this.scene.start(SCENE.MENU)
    })
  }

  update(time: number, dt: number) {
    if (this.gameOverShown) return

    this.lars.update(time, dt)

    // Parallax — lag scroller med forskellige hastigheder
    const camX = this.cameras.main.scrollX
    this.bgFar.tilePositionX = camX * 0.2
    this.bgMid.tilePositionX = camX * 0.5
    this.bgNear.tilePositionX = camX * 0.85

    // Patrol enemies — flyt dem frem og tilbage indenfor patrolDist
    this.enemies.children.iterate((obj: Phaser.GameObjects.GameObject) => {
      const e = obj as Phaser.Physics.Arcade.Sprite & { startX?: number, patrolDist?: number, dir?: number }
      if (!e.body) return null
      const startX = e.startX ?? e.x
      const dist = e.patrolDist ?? 120
      let dir = e.dir ?? 1
      if (e.x > startX + dist) dir = -1
      else if (e.x < startX - dist) dir = 1
      e.dir = dir
      e.setVelocityX(60 * dir)
      e.setFlipX(dir < 0)
      return null
    })

    // Scared-mood hvis fjende er tæt på
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

    // Faldt i hul / under verden
    if (this.lars.sprite.y > GAME_HEIGHT + 100) {
      const hit = this.lars.takeHit(time)
      if (hit) this.respawnLars()
    }

    // Goal: nået enden
    if (this.lars.sprite.x > LEVEL_WIDTH - 80 && !this.gameOverShown) {
      this.handleLevelComplete()
    }

    // Død
    if (this.lars.isDead() && !this.gameOverShown) {
      this.handleGameOver()
    }
  }

  // ---------- Setup ----------

  private makeGround() {
    // Flad ground hele vejen — V2 MVP
    for (let x = 0; x < LEVEL_WIDTH; x += 64) {
      const tile = this.add.image(x, GROUND_Y + 16, ASSET.TEX_GROUND).setOrigin(0, 0.5)
      this.platforms.add(tile)
    }
    // Refresh static body bounds efter add'd children
    this.platforms.refresh()
  }

  private makePlatforms() {
    const defs: PlatformDef[] = [
      { x: 600, y: GROUND_Y - 140 },
      { x: 900, y: GROUND_Y - 220 },
      { x: 1300, y: GROUND_Y - 160 },
      { x: 1700, y: GROUND_Y - 240 },
      { x: 2100, y: GROUND_Y - 180 },
      { x: 2500, y: GROUND_Y - 260, w: 140 },
      { x: 2900, y: GROUND_Y - 200 },
      { x: 3300, y: GROUND_Y - 280 },
      { x: 3700, y: GROUND_Y - 180 },
      { x: 4100, y: GROUND_Y - 240 },
    ]
    for (const d of defs) {
      const plat = this.add.image(d.x, d.y, ASSET.TEX_PLATFORM).setOrigin(0.5, 0.5)
      if (d.w) plat.setDisplaySize(d.w, 20)
      this.platforms.add(plat)
    }
    this.platforms.refresh()
  }

  private makeEnemies() {
    const spawns: EnemySpawn[] = [
      { x: 700, y: GROUND_Y - 30, patrolDist: 80 },
      { x: 1500, y: GROUND_Y - 30, patrolDist: 100 },
      { x: 2300, y: GROUND_Y - 30, patrolDist: 120 },
      { x: 3100, y: GROUND_Y - 30, patrolDist: 100 },
      { x: 3900, y: GROUND_Y - 30, patrolDist: 80 },
    ]
    for (const s of spawns) {
      const e = this.enemies.create(s.x, s.y, ASSET.TEX_MOSE_DRAUGER) as Phaser.Physics.Arcade.Sprite & { startX: number, patrolDist: number, dir: number }
      e.setDepth(DEPTH.ENEMIES)
      e.setCollideWorldBounds(false)
      e.body!.setSize(30, 46, true)
      e.startX = s.x
      e.patrolDist = s.patrolDist ?? 100
      e.dir = 1
    }
  }

  private makePickups() {
    const spawns: PickupSpawn[] = [
      { x: 400, y: GROUND_Y - 60 },
      { x: 600, y: GROUND_Y - 180 },
      { x: 900, y: GROUND_Y - 260 },
      { x: 1300, y: GROUND_Y - 200 },
      { x: 1700, y: GROUND_Y - 280 },
      { x: 2100, y: GROUND_Y - 220 },
      { x: 2500, y: GROUND_Y - 300 },
      { x: 2900, y: GROUND_Y - 240 },
      { x: 3300, y: GROUND_Y - 320 },
      { x: 3700, y: GROUND_Y - 220 },
      { x: 4100, y: GROUND_Y - 280 },
      { x: 4400, y: GROUND_Y - 60 },
    ]
    for (const s of spawns) {
      const p = this.pickups.create(s.x, s.y, ASSET.TEX_BEER) as Phaser.Physics.Arcade.Sprite
      p.setDepth(DEPTH.PICKUPS)
      // Float-animation
      this.tweens.add({
        targets: p,
        y: p.y - 6,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  // ---------- Collision handlers ----------

  private handlePickup(_lars: unknown, pickup: unknown) {
    const p = pickup as Phaser.Physics.Arcade.Sprite
    if (!p.active) return
    p.disableBody(true, true)
    this.score += ITEM_POINTS
    this.scene.get(SCENE.HUD).events.emit('score', this.score)
    this.lars.setMood('happy', 400)
    // Lille pop-text
    const pop = this.add.text(p.x, p.y - 20, '+100', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '20px',
      color: '#F5A623',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTH.PARTICLES)
    this.tweens.add({
      targets: pop,
      y: pop.y - 40,
      alpha: 0,
      duration: 700,
      onComplete: () => pop.destroy(),
    })
  }

  private handleEnemyOverlap(_lars: unknown, enemy: unknown) {
    const e = enemy as Phaser.Physics.Arcade.Sprite
    const larsBody = this.lars.sprite.body as Phaser.Physics.Arcade.Body
    const enemyBody = e.body as Phaser.Physics.Arcade.Body
    if (!e.active || !larsBody || !enemyBody) return

    // Stomp: Lars falder ned ovenpå (positive y velocity + Lars over fjendens center)
    const isStomp = larsBody.velocity.y > 50 && this.lars.sprite.y < e.y - 10
    if (isStomp) {
      e.disableBody(true, true)
      this.score += ENEMY_KILL_POINTS
      this.scene.get(SCENE.HUD).events.emit('score', this.score)
      // Lille bounce op
      this.lars.sprite.setVelocityY(-400)
      // Pop
      const pop = this.add.text(e.x, e.y - 20, '+250', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '22px',
        color: '#00D68F',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(DEPTH.PARTICLES)
      this.tweens.add({
        targets: pop,
        y: pop.y - 50,
        alpha: 0,
        duration: 700,
        onComplete: () => pop.destroy(),
      })
      return
    }

    // Ellers: tager skade
    const hit = this.lars.takeHit(this.time.now)
    if (hit) {
      this.scene.get(SCENE.HUD).events.emit('lives', this.lars.lives)
    }
  }

  // ---------- State changes ----------

  private respawnLars() {
    this.lars.sprite.setPosition(Math.max(100, this.lars.sprite.x - 200), GROUND_Y - 100)
    this.lars.sprite.setVelocity(0, 0)
    this.scene.get(SCENE.HUD).events.emit('lives', this.lars.lives)
  }

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
    this.lars.setMood('victory', 2000)
    this.cameras.main.fade(800, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENE.HUD)
      this.scene.start(SCENE.GAMEOVER, { won: true, score: this.score })
    })
  }
}
