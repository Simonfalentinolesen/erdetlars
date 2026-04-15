<script setup lang="ts">
import jimData from '~/data/valhalla/jim-dialogue.json'

const router = useRouter()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const gameContainerRef = ref<HTMLElement | null>(null)

// ==================== GAME STATE ====================
const gameState = ref<'loading' | 'cutscene' | 'playing' | 'boss' | 'levelcomplete' | 'dead' | 'paused' | 'credits'>('loading')
const currentLevel = ref(1)
const score = ref(0)
const lives = ref(3)
const time = ref(0)

// Cutscene
const cutsceneLines = ref<{ speaker: string; text: string; mood: string }[]>([])
const cutsceneIndex = ref(0)
const cutsceneCallback = ref<(() => void) | null>(null)
const typewriterText = ref('')
const typewriterDone = ref(false)

// Collectibles
const levelOl = ref(0)
const levelJim = ref(0)
const levelDal = ref(0)
const OL_REQ = [3, 5, 8, 10, 15, 0]

// Background images
const bgFar = ref<HTMLImageElement | null>(null)
const bgMid = ref<HTMLImageElement | null>(null)
const bgNear = ref<HTMLImageElement | null>(null)

// ==================== CANVAS ENGINE ====================
let ctx: CanvasRenderingContext2D | null = null
let W = 0, H = 0
let animFrame: number | null = null
let lastTime = 0
const keysDown = new Set<string>()
let tapped = false

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  W = rect.width; H = rect.height
  canvas.width = W * dpr; canvas.height = H * dpr
  ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
}

// ==================== PLAYER ====================
const GRAVITY = 1200
const JUMP_FORCE = -500
const MOVE_SPEED = 180
const RUN_SPEED = 270

// World-to-screen zoom factor. Applied in render() after camera translate.
// Everything inside the camera-transform block is scaled by this.
// HUD, parallax backgrounds, and post-processing stay in screen space.
//
// Per-level overrides (Level 5 = Pong, needs full scene visible).
// Levels 1-4 and 6 get an aggressive close-up so Lars fills the frame.
const WORLD_ZOOM_BY_LEVEL: Record<number, number> = {
  1: 4.0,   // Moser — close-up cinematic
  2: 4.0,   // Skov
  3: 3.8,   // Klipper — slightly less so you can see jumps ahead
  4: 3.8,   // Ild — same reason (lava pits are big)
  5: 1.0,   // Pong — MUST show full scene
  6: 3.2,   // Valhalla feast — see NPCs at once
}
function getWorldZoom(): number {
  return WORLD_ZOOM_BY_LEVEL[currentLevel.value] ?? 4.0
}

let px = 60, py = 0, pvx = 0, pvy = 0
let onGround = false, facing = 1, invTimer = 0
let playerPower = 'none' as string
let powerTimer = 0

// Lars mood — affects how he's drawn. Transient moods auto-revert via larsMoodTimer.
// 'scared' is a continuous state (set whenever enemies are close) and doesn't use timer.
let larsMood: 'normal' | 'happy' | 'victory' | 'scared' = 'normal'
let larsMoodTimer = 0
let larsBounceTimer = 0 // brief hop when picking up items

// Screen shake — applied as an offset BEFORE the camera transform.
// shakeAmt decays over time; shakeTrigger sets fresh magnitude.
let shakeAmt = 0
function triggerShake(mag: number) {
  if (mag > shakeAmt) shakeAmt = mag
}

// Hit-stop — freezes game for N seconds. Used on big hits for punch.
let hitStopTimer = 0

// Level transition fade (0 = no fade, 1 = fully black)
let levelFade = 0
let levelFadeDir = 0 // -1 fading out, +1 fading in, 0 idle
let pendingLevelAdvance = false
let larsTrailAccum = 0

// Credits scroll state
let creditsScrollY = 0

// Highscore (loaded on mount)
const highscore = ref(0)

function setLarsMood(mood: 'normal' | 'happy' | 'victory' | 'scared', duration: number) {
  // Victory outranks happy outranks scared outranks normal (never overwrite victory)
  if (larsMood === 'victory' && larsMoodTimer > 0 && mood !== 'victory') return
  larsMood = mood
  larsMoodTimer = duration
}

function getPlayerH() { return playerPower === 'big' ? 44 : 34 }
function getPlayerW() { return playerPower === 'big' ? 32 : 26 }

// ==================== WORLD OBJECTS ====================
interface Platform { x: number; y: number; w: number; h: number; type: string }
interface Enemy { x: number; y: number; w: number; h: number; type: string; alive: boolean; dir: number; speed: number; rs: number; re: number; hp: number; phase: number; attackTimer: number; projectileX: number; projectileY: number; projectileActive: boolean }
interface Item { x: number; y: number; type: string; collected: boolean }
interface JimPos { x: number; y: number; dialogKey: string; triggered: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string }

let platforms: Platform[] = []
let enemies: Enemy[] = []
let items: Item[] = []
let jimPositions: JimPos[] = []
let particles: Particle[] = []
let goalX = 0
let goalReached = false
let cameraX = 0
let cameraY = 0 // For vertical scrolling in Level 2+
let levelWidth = 3000
let levelHeight = 0 // 0 = no vertical scroll
let checkpointX = 60

// ==================== JIM COMPANION ====================
let jimX = 0, jimY = 0, jimVx = 0, jimVy = 0
let jimOnGround = false, jimActive = false
let jimComment = '', jimCommentTimer = 0
let jimPrankActive = '' as string // 'drunk' | 'heavy' | 'swap' | 'wind' | 'fire' | 'dalmatian' | ''
let jimPrankTimer = 0
let jimMood: 'normal' | 'evil' | 'laughing' | 'pointing' = 'normal'
let jimMoodTimer = 0
let jimEvilIntensity = 0 // 0–1 — grows through Level 4–5 as Loke is revealed
let jimTriggeredSwapL1 = false
let jimTriggeredWindL3 = false
let jimTriggeredFireL4 = false
let dalmatinerActive = false
let dalmatinerX = 0, dalmatinerY = 0, dalmatinerVx = 0, dalmatinerCaught = false

function setJimMood(mood: 'normal' | 'evil' | 'laughing' | 'pointing', duration: number) {
  jimMood = mood; jimMoodTimer = duration
}

// Jim micro-laughs (random tiny bubbles between proper one-liners)
const JIM_LAUGHS = ['HA!', 'HEH.', 'Lars...', 'Nå ja.', 'Hmpf.', 'Lækkert.']

// Jim one-liner comments (shown floating above Jim)
const JIM_ONELINERS_L2 = [
  'Charmerende sted...', 'Pas på rødderne.', 'Jeg elsker denne skov.',
  'Hørte du det?', 'Vi er ikke alene.', 'Lugt den luft, Lars.',
  'Min hund ville elske det her.', 'Rør ikke den svamp.',
  'Interessant...', 'Kom nu, Lars.', 'Den vej.',
]

const JIM_ONELINERS_L1 = [
  'Mosen er vådere i år.', 'Pas på ulvene.', 'Lars, du virker tynd.',
  'Odin venter.', 'Kom nu, Lars. Vi skal nå det.',
]

// ==================== PARTICLES ====================
function spawnParticles(x: number, y: number, count: number, color: string, spread = 100) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * spread,
      vy: (Math.random() - 0.5) * spread - 30,
      life: 0.5 + Math.random() * 0.8,
      maxLife: 0.5 + Math.random() * 0.8,
      size: 1 + Math.random() * 3,
      color,
    })
  }
}

// Atmospheric fog particles
function spawnFog() {
  if (particles.length > 200) return
  particles.push({
    x: cameraX + Math.random() * W,
    y: H * 0.3 + Math.random() * H * 0.5,
    vx: 10 + Math.random() * 20,
    vy: -2 + Math.random() * 4,
    life: 3 + Math.random() * 4,
    maxLife: 3 + Math.random() * 4,
    size: 20 + Math.random() * 40,
    color: 'fog',
  })
}

// Rain drops
function spawnRain() {
  if (Math.random() > 0.3) return
  particles.push({
    x: cameraX + Math.random() * W,
    y: -10,
    vx: -20,
    vy: 300 + Math.random() * 200,
    life: 2, maxLife: 2,
    size: 1, color: 'rain',
  })
}

// Level 2 atmosphere: falling leaves
function spawnLeaf() {
  if (particles.length > 250) return
  particles.push({
    x: cameraX + Math.random() * W,
    y: cameraY - 20,
    vx: -15 + Math.random() * 30,
    vy: 30 + Math.random() * 50,
    life: 5 + Math.random() * 5,
    maxLife: 5 + Math.random() * 5,
    size: 3 + Math.random() * 4,
    color: 'leaf',
  })
}

// Level 2: glowing spores rising from mushrooms
function spawnSpore(sx: number, sy: number) {
  particles.push({
    x: sx + (Math.random() - 0.5) * 20,
    y: sy,
    vx: (Math.random() - 0.5) * 10,
    vy: -20 - Math.random() * 30,
    life: 2 + Math.random() * 3,
    maxLife: 2 + Math.random() * 3,
    size: 1.5 + Math.random() * 2,
    color: 'spore',
  })
}

// Level 2: fireflies
function spawnFirefly() {
  if (particles.length > 250) return
  particles.push({
    x: cameraX + Math.random() * W,
    y: cameraY + Math.random() * H,
    vx: (Math.random() - 0.5) * 40,
    vy: (Math.random() - 0.5) * 30,
    life: 3 + Math.random() * 4,
    maxLife: 3 + Math.random() * 4,
    size: 2,
    color: 'firefly',
  })
}

// Level 2: green fog
function spawnGreenFog() {
  if (particles.length > 250) return
  particles.push({
    x: cameraX + Math.random() * W,
    y: cameraY + H * 0.4 + Math.random() * H * 0.4,
    vx: 5 + Math.random() * 15,
    vy: -1 + Math.random() * 2,
    life: 4 + Math.random() * 5,
    maxLife: 4 + Math.random() * 5,
    size: 25 + Math.random() * 45,
    color: 'greenfog',
  })
}

// ==================== LEVEL 1 GENERATION ====================
function buildLevel1() {
  platforms = []; enemies = []; items = []; jimPositions = []; particles = []
  const gndY = H - 50
  levelWidth = 3200
  goalX = levelWidth - 100

  // === GROUND PLATFORMS ===
  // Start area - Lars' cage
  platforms.push({ x: 0, y: gndY, w: 400, h: 40, type: 'mud' })

  // Section 1: Tutorial (400-1200)
  platforms.push({ x: 420, y: gndY, w: 300, h: 40, type: 'wood' })
  platforms.push({ x: 740, y: gndY, w: 250, h: 40, type: 'mud' })
  platforms.push({ x: 1010, y: gndY, w: 200, h: 40, type: 'wood' })
  // Floating platforms
  platforms.push({ x: 550, y: gndY - 70, w: 80, h: 16, type: 'wood' })
  platforms.push({ x: 850, y: gndY - 90, w: 70, h: 16, type: 'stone' })

  // Section 2: First enemies (1200-2000)
  platforms.push({ x: 1230, y: gndY, w: 200, h: 40, type: 'mud' })
  platforms.push({ x: 1460, y: gndY, w: 150, h: 40, type: 'wood' })
  platforms.push({ x: 1640, y: gndY, w: 200, h: 40, type: 'mud' })
  platforms.push({ x: 1870, y: gndY, w: 150, h: 40, type: 'wood' })
  // Floating
  platforms.push({ x: 1350, y: gndY - 80, w: 70, h: 16, type: 'wood' })
  platforms.push({ x: 1550, y: gndY - 100, w: 60, h: 16, type: 'stone' })
  platforms.push({ x: 1750, y: gndY - 70, w: 80, h: 16, type: 'wood' })

  // Section 3: Vertical climb (2000-2600)
  platforms.push({ x: 2050, y: gndY, w: 120, h: 40, type: 'stone' })
  platforms.push({ x: 2100, y: gndY - 70, w: 80, h: 16, type: 'wood' })
  platforms.push({ x: 2200, y: gndY - 140, w: 70, h: 16, type: 'stone' })
  platforms.push({ x: 2150, y: gndY - 210, w: 80, h: 16, type: 'wood' })
  platforms.push({ x: 2280, y: gndY - 160, w: 90, h: 16, type: 'stone' })
  platforms.push({ x: 2380, y: gndY - 100, w: 100, h: 40, type: 'mud' })
  platforms.push({ x: 2380, y: gndY, w: 200, h: 40, type: 'mud' })

  // Boss arena (2600-3200)
  platforms.push({ x: 2600, y: gndY, w: 500, h: 40, type: 'stone' })
  // Goal platform
  platforms.push({ x: goalX - 30, y: gndY, w: 120, h: 40, type: 'stone' })

  // === ITEMS ===
  // Øl spread throughout (8 total, need 3)
  const olPositions = [
    [300, gndY - 30], [580, gndY - 100], [780, gndY - 30], [880, gndY - 120],
    [1100, gndY - 30], [1500, gndY - 30], [1780, gndY - 100], [2230, gndY - 170],
  ]
  olPositions.forEach(([ix, iy], i) => items.push({ x: ix, y: iy, type: 'ol', collected: false }))

  // Jim tokens (hidden)
  items.push({ x: 870, y: gndY - 130, type: 'jim_token', collected: false })
  items.push({ x: 2170, y: gndY - 250, type: 'jim_token', collected: false })

  // Dalmatiner (very hidden - on high platform)
  items.push({ x: 2220, y: gndY - 180, type: 'dalmatiner', collected: false })

  // Power-up
  items.push({ x: 1700, y: gndY - 30, type: 'powerup_big', collected: false })

  // === ENEMIES ===
  // Section 2 enemies (none in section 1 - tutorial)
  enemies.push({ x: 1350, y: gndY - 35, w: 25, h: 35, type: 'guard', alive: true, dir: 1, speed: 40, rs: 1250, re: 1420, hp: 1, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false })
  enemies.push({ x: 1700, y: gndY - 25, w: 30, h: 25, type: 'wolf', alive: true, dir: -1, speed: 70, rs: 1650, re: 1850, hp: 1, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false })
  enemies.push({ x: 1900, y: gndY - 35, w: 25, h: 35, type: 'guard', alive: true, dir: 1, speed: 45, rs: 1880, re: 2020, hp: 1, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false })

  // Section 3 enemy
  enemies.push({ x: 2420, y: gndY - 35, w: 25, h: 35, type: 'guard', alive: true, dir: -1, speed: 50, rs: 2390, re: 2560, hp: 1, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false })

  // === BOSS: BØDDELEN ===
  enemies.push({
    x: 2800, y: gndY - 60, w: 45, h: 60, type: 'boss',
    alive: true, dir: -1, speed: 60, rs: 2620, re: 3050,
    hp: 6, phase: 1, attackTimer: 2,
    projectileX: 0, projectileY: 0, projectileActive: false,
  })

  // === JIM POSITIONS ===
  jimPositions = [
    { x: 200, y: gndY - 80, dialogKey: 'midLevel', triggered: false },
    { x: 2550, y: gndY - 50, dialogKey: 'preBoss', triggered: false },
  ]

  checkpointX = 60
}

// ==================== LEVEL 2: DEN SORTE SKOV ====================
// Platform types: 'root' (mossy root), 'bark' (tree bark), 'mushroom' (glowing), 'branch' (thin)
function buildLevel2() {
  platforms = []; enemies = []; items = []; jimPositions = []; particles = []
  const gndY = H - 50
  levelWidth = 3600
  levelHeight = 400 // Enable vertical scrolling
  goalX = levelWidth - 100

  // === SEKTION 1: Skovbunden (0-900) - Horisontal intro ===
  platforms.push({ x: 0, y: gndY, w: 300, h: 35, type: 'root' })
  platforms.push({ x: 340, y: gndY, w: 200, h: 35, type: 'root' })
  platforms.push({ x: 580, y: gndY, w: 250, h: 35, type: 'root' })
  platforms.push({ x: 400, y: gndY - 70, w: 65, h: 14, type: 'mushroom' })
  platforms.push({ x: 650, y: gndY - 85, w: 70, h: 14, type: 'branch' })
  platforms.push({ x: 870, y: gndY, w: 150, h: 35, type: 'root' })

  // === SEKTION 2: Klatring op (900-1600) - VERTICAL ===
  platforms.push({ x: 900, y: gndY, w: 100, h: 35, type: 'root' })
  platforms.push({ x: 950, y: gndY - 70, w: 75, h: 14, type: 'bark' })
  platforms.push({ x: 880, y: gndY - 140, w: 80, h: 14, type: 'mushroom' })
  platforms.push({ x: 960, y: gndY - 210, w: 70, h: 14, type: 'branch' })
  platforms.push({ x: 890, y: gndY - 280, w: 75, h: 14, type: 'bark' })
  platforms.push({ x: 970, y: gndY - 340, w: 80, h: 14, type: 'mushroom' })
  // Side platforms during climb
  platforms.push({ x: 1050, y: gndY - 170, w: 60, h: 14, type: 'branch' })
  platforms.push({ x: 1100, y: gndY - 250, w: 65, h: 14, type: 'bark' })
  platforms.push({ x: 1000, y: gndY - 380, w: 120, h: 20, type: 'bark' }) // Top of climb - landing

  // === SEKTION 3: Trætoppene (1100-2200) - Højt oppe, horisontal ===
  const treeTopY = gndY - 350
  platforms.push({ x: 1150, y: treeTopY, w: 150, h: 18, type: 'branch' })
  platforms.push({ x: 1340, y: treeTopY - 30, w: 80, h: 14, type: 'mushroom' })
  platforms.push({ x: 1460, y: treeTopY + 10, w: 120, h: 18, type: 'bark' })
  platforms.push({ x: 1620, y: treeTopY - 20, w: 70, h: 14, type: 'branch' })
  platforms.push({ x: 1730, y: treeTopY + 15, w: 100, h: 18, type: 'bark' })
  platforms.push({ x: 1870, y: treeTopY - 10, w: 80, h: 14, type: 'mushroom' })
  platforms.push({ x: 1990, y: treeTopY + 5, w: 130, h: 18, type: 'branch' })
  platforms.push({ x: 2150, y: treeTopY + 20, w: 100, h: 18, type: 'bark' })

  // === SEKTION 4: Nedstigning (2200-2900) - Back to ground ===
  platforms.push({ x: 2280, y: treeTopY + 70, w: 70, h: 14, type: 'branch' })
  platforms.push({ x: 2350, y: treeTopY + 140, w: 80, h: 14, type: 'bark' })
  platforms.push({ x: 2430, y: treeTopY + 210, w: 75, h: 14, type: 'mushroom' })
  platforms.push({ x: 2500, y: treeTopY + 270, w: 80, h: 14, type: 'branch' })
  platforms.push({ x: 2580, y: gndY - 70, w: 90, h: 14, type: 'bark' })
  platforms.push({ x: 2650, y: gndY, w: 200, h: 35, type: 'root' })

  // === SEKTION 5: Boss lysning (2900-3600) ===
  platforms.push({ x: 2900, y: gndY, w: 600, h: 35, type: 'root' })
  platforms.push({ x: 3000, y: gndY - 90, w: 70, h: 14, type: 'mushroom' })
  platforms.push({ x: 3200, y: gndY - 100, w: 70, h: 14, type: 'branch' })
  platforms.push({ x: goalX - 30, y: gndY, w: 120, h: 35, type: 'root' })

  // === ITEMS ===
  // Øl (10 stk, krav: 5)
  const olSpots = [
    [200, gndY - 30], [420, gndY - 100], [680, gndY - 115],
    [960, gndY - 80], [940, gndY - 300], [1070, gndY - 280],
    [1380, treeTopY - 60], [1650, treeTopY - 50], [1900, treeTopY - 40],
    [2450, treeTopY + 180],
  ]
  olSpots.forEach(([x, y]) => items.push({ x, y, type: 'ol', collected: false }))

  // Jim tokens (2, on high/hidden spots)
  items.push({ x: 1350, y: treeTopY - 70, type: 'jim_token', collected: false })
  items.push({ x: 2000, y: treeTopY - 30, type: 'jim_token', collected: false })

  // Dalmatiner (hidden on a treetop mushroom)
  items.push({ x: 1880, y: treeTopY - 45, type: 'dalmatiner', collected: false })

  // Power-ups
  items.push({ x: 1500, y: treeTopY - 20, type: 'powerup_big', collected: false })

  // === ENEMIES ===
  // Shadow hunters in the forest floor
  const mkEnemy = (x: number, y: number, t: string, sp: number, r: number) => ({
    x, y, w: t === 'raven' ? 20 : t === 'spider' ? 28 : 24, h: t === 'raven' ? 15 : t === 'spider' ? 22 : 30,
    type: t, alive: true, dir: 1, speed: sp, rs: x - r, re: x + r,
    hp: 1, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false,
  })

  enemies.push(mkEnemy(500, gndY - 30, 'shadow', 80, 80))
  enemies.push(mkEnemy(750, gndY - 30, 'shadow', 85, 70))
  // Ravens in the canopy
  enemies.push(mkEnemy(1250, treeTopY - 20, 'raven', 100, 100))
  enemies.push(mkEnemy(1700, treeTopY - 15, 'raven', 110, 80))
  // Spiders on the descent
  enemies.push(mkEnemy(2400, treeTopY + 200, 'spider', 45, 50))
  enemies.push(mkEnemy(2620, gndY - 35, 'spider', 50, 60))

  // BOSS: HJORTEMANDEN
  enemies.push({
    x: 3150, y: gndY - 50, w: 35, h: 50, type: 'boss_deer',
    alive: true, dir: -1, speed: 110, rs: 2920, re: 3450,
    hp: 5, phase: 1, attackTimer: 2,
    projectileX: 0, projectileY: 0, projectileActive: false,
  })

  // === JIM COMPANION ===
  jimActive = true
  jimX = px + 50; jimY = py
  jimComment = ''; jimCommentTimer = 0
  jimPrankActive = ''; jimPrankTimer = 0
  jimMood = 'normal'; jimMoodTimer = 0
  jimTriggeredSwapL1 = false; jimTriggeredWindL3 = false; jimTriggeredFireL4 = false
  dalmatinerActive = false; dalmatinerCaught = false

  // Jim dialog triggers (cutscene-based)
  jimPositions = [
    { x: 450, y: gndY - 80, dialogKey: 'midLevel', triggered: false },
    { x: 2850, y: gndY - 50, dialogKey: 'preBoss', triggered: false },
  ]

  // === JIM PRANK TRIGGERS (position-based) ===
  // At x=700: Jim makes Lars drunk (inverted controls)
  // At x=1800: Jim ties a stone to Lars (lower jump)
  // At x=2200: Dalmatiner chase sidequest

  checkpointX = 60
}

// ==================== LEVEL 3: BLODKLIPPERNE ====================
// Platform types: 'cliff' (grey stone, wide), 'bridge' (wood, narrow), 'ice' (blue, slippery)
// Unique mechanic: WIND pushes Lars sideways, diagonal rain, wider jumps, faster pace
let windForce = 0 // Applied in update when level 3 active
const JIM_ONELINERS_L3 = [
  'Hold fast, Lars!', 'Stormen tager til!', 'Se de vrag dernede...',
  'Modigt. Dumt. Men modigt.', 'Vinden bærer dødens lugt.', 'Spring nu!',
  'Havet er sultent i dag.', 'Blod og salt. Denne klippes parfume.',
]

function buildLevel3() {
  platforms = []; enemies = []; items = []; jimPositions = []; particles = []
  const gndY = H - 50
  levelWidth = 4000
  levelHeight = 0
  goalX = levelWidth - 100

  // Jim companion active
  jimActive = true
  jimX = px + 50; jimY = py
  jimComment = ''; jimCommentTimer = 0
  jimPrankActive = ''; jimPrankTimer = 0
  jimMood = 'normal'; jimMoodTimer = 0
  jimTriggeredSwapL1 = false; jimTriggeredWindL3 = false; jimTriggeredFireL4 = false
  dalmatinerActive = false; dalmatinerCaught = false

  const mkE = (x: number, y: number, t: string, sp: number, r: number) => ({
    x, y, w: t === 'spear' ? 22 : t === 'berserker_ghost' ? 28 : 25, h: t === 'spear' ? 35 : t === 'berserker_ghost' ? 35 : 35,
    type: t, alive: true, dir: 1, speed: sp, rs: x - r, re: x + r,
    hp: 1, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false,
  })

  // === SEKTION 1: Klippestien (0-1000) - Bred, vindblæst ===
  platforms.push({ x: 0, y: gndY, w: 250, h: 35, type: 'cliff' })
  platforms.push({ x: 300, y: gndY, w: 180, h: 35, type: 'cliff' })
  platforms.push({ x: 530, y: gndY, w: 200, h: 35, type: 'bridge' })
  platforms.push({ x: 780, y: gndY, w: 220, h: 35, type: 'cliff' })
  platforms.push({ x: 400, y: gndY - 70, w: 60, h: 14, type: 'cliff' })
  platforms.push({ x: 650, y: gndY - 80, w: 55, h: 14, type: 'ice' })

  // === SEKTION 2: Slagmarken (1000-2000) - Fjender, store spring ===
  platforms.push({ x: 1050, y: gndY, w: 160, h: 35, type: 'cliff' })
  platforms.push({ x: 1260, y: gndY, w: 140, h: 35, type: 'bridge' })
  platforms.push({ x: 1450, y: gndY, w: 180, h: 35, type: 'cliff' })
  platforms.push({ x: 1680, y: gndY, w: 150, h: 35, type: 'cliff' })
  platforms.push({ x: 1880, y: gndY, w: 140, h: 35, type: 'bridge' })
  // Floating
  platforms.push({ x: 1150, y: gndY - 90, w: 60, h: 14, type: 'cliff' })
  platforms.push({ x: 1350, y: gndY - 75, w: 70, h: 14, type: 'ice' })
  platforms.push({ x: 1560, y: gndY - 100, w: 55, h: 14, type: 'cliff' })
  platforms.push({ x: 1750, y: gndY - 80, w: 65, h: 14, type: 'cliff' })

  // === SEKTION 3: Havets rand (2000-2800) - Smalle klippestier ===
  platforms.push({ x: 2070, y: gndY, w: 120, h: 35, type: 'cliff' })
  platforms.push({ x: 2240, y: gndY - 20, w: 100, h: 35, type: 'cliff' })
  platforms.push({ x: 2390, y: gndY + 10, w: 110, h: 35, type: 'bridge' })
  platforms.push({ x: 2550, y: gndY - 10, w: 130, h: 35, type: 'cliff' })
  platforms.push({ x: 2730, y: gndY, w: 100, h: 35, type: 'ice' })
  // High path (alternative)
  platforms.push({ x: 2100, y: gndY - 120, w: 60, h: 14, type: 'cliff' })
  platforms.push({ x: 2250, y: gndY - 150, w: 55, h: 14, type: 'cliff' })
  platforms.push({ x: 2400, y: gndY - 130, w: 65, h: 14, type: 'ice' })
  platforms.push({ x: 2550, y: gndY - 110, w: 60, h: 14, type: 'cliff' })

  // === SEKTION 4: Boss arena (2900-4000) ===
  platforms.push({ x: 2880, y: gndY, w: 300, h: 35, type: 'cliff' })
  platforms.push({ x: 3230, y: gndY, w: 250, h: 35, type: 'cliff' })
  platforms.push({ x: 3530, y: gndY, w: 350, h: 35, type: 'cliff' })
  platforms.push({ x: 3050, y: gndY - 80, w: 70, h: 14, type: 'cliff' })
  platforms.push({ x: 3350, y: gndY - 90, w: 60, h: 14, type: 'ice' })
  platforms.push({ x: goalX - 30, y: gndY, w: 120, h: 35, type: 'cliff' })

  // === ITEMS (need 8 øl + 2 Jim + 1 dalmatiner) ===
  const olSpots = [
    [180, gndY - 30], [420, gndY - 100], [680, gndY - 110], [810, gndY - 30],
    [1180, gndY - 120], [1380, gndY - 105], [1580, gndY - 130], [1720, gndY - 30],
    [2130, gndY - 150], [2420, gndY - 160], [2600, gndY - 30], [2760, gndY - 30],
  ]
  olSpots.forEach(([x, y]) => items.push({ x, y, type: 'ol', collected: false }))

  items.push({ x: 1570, y: gndY - 140, type: 'jim_token', collected: false })
  items.push({ x: 2270, y: gndY - 180, type: 'jim_token', collected: false })
  items.push({ x: 2430, y: gndY - 170, type: 'dalmatiner', collected: false })
  items.push({ x: 1900, y: gndY - 30, type: 'powerup_big', collected: false })

  // === ENEMIES - War-themed ===
  // Fallen warriors (skeleton-like, slow but tough)
  enemies.push(mkE(500, gndY - 35, 'skeleton', 50, 70))
  enemies.push(mkE(1200, gndY - 35, 'skeleton', 55, 60))
  enemies.push(mkE(1700, gndY - 35, 'skeleton', 60, 80))
  // Spear throwers (stationary, throw projectiles)
  enemies.push(mkE(1450, gndY - 35, 'spear', 0, 0))
  enemies.push(mkE(2300, gndY - 35, 'spear', 0, 0))
  // Berserker ghosts (fast, erratic)
  enemies.push(mkE(2600, gndY - 35, 'berserker_ghost', 120, 100))

  // BOSS: DEN FALDNE BERSÆRK
  enemies.push({
    x: 3400, y: gndY - 60, w: 50, h: 60, type: 'boss_berserker',
    alive: true, dir: -1, speed: 90, rs: 2920, re: 3800,
    hp: 7, phase: 1, attackTimer: 2,
    projectileX: 0, projectileY: 0, projectileActive: false,
  })

  // Jim dialog positions
  jimPositions = [
    { x: 600, y: gndY - 80, dialogKey: 'midLevel', triggered: false },
    { x: 2850, y: gndY - 50, dialogKey: 'preBoss', triggered: false },
  ]

  checkpointX = 60
}

// ==================== LEVEL 4: RITUALILDEN ====================
// Platform types: 'altar' (stone+fire), 'ember' (hot coal), 'torch' (pillar), 'bone' (skeleton)
// Unique: fire damage zones, ember particles everywhere, warm orange palette
const JIM_ONELINERS_L4 = [
  'Varmt nok?', 'Rør ikke ilden.', 'Smukt ritual...',
  'Guderne kigger.', 'Offer!', 'Brændt kød. Mmmm.',
  'Denne ild har brændt i tusind år.', 'Pas på kullet.',
]
let fireDamageTimer = 0 // Periodic fire damage in certain zones

function buildLevel4() {
  platforms = []; enemies = []; items = []; jimPositions = []; particles = []
  const gndY = H - 50
  levelWidth = 3800
  levelHeight = 0
  goalX = levelWidth - 100

  // Jim companion
  jimActive = true
  jimX = px + 50; jimY = py
  jimComment = ''; jimCommentTimer = 0
  jimPrankActive = ''; jimPrankTimer = 0
  jimMood = 'normal'; jimMoodTimer = 0
  jimTriggeredSwapL1 = false; jimTriggeredWindL3 = false; jimTriggeredFireL4 = false
  dalmatinerActive = false; dalmatinerCaught = false
  fireDamageTimer = 0

  const mkE = (x: number, y: number, t: string, sp: number, r: number, hp = 1) => ({
    x, y, w: 25, h: 35, type: t, alive: true, dir: 1, speed: sp, rs: x - r, re: x + r,
    hp, phase: 0, attackTimer: 0, projectileX: 0, projectileY: 0, projectileActive: false,
  })

  // === SEKTION 1: Offerpladsen (0-900) ===
  platforms.push({ x: 0, y: gndY, w: 280, h: 35, type: 'altar' })
  platforms.push({ x: 320, y: gndY, w: 200, h: 35, type: 'ember' })
  platforms.push({ x: 560, y: gndY, w: 180, h: 35, type: 'altar' })
  platforms.push({ x: 790, y: gndY, w: 150, h: 35, type: 'bone' })
  platforms.push({ x: 400, y: gndY - 75, w: 50, h: 50, type: 'torch' })
  platforms.push({ x: 650, y: gndY - 80, w: 55, h: 14, type: 'bone' })

  // === SEKTION 2: Vulkankammeret (900-1800) - VERTICAL CLIMB over lava ===
  platforms.push({ x: 980, y: gndY, w: 120, h: 35, type: 'altar' })
  // Lava pit section - NO ground, must hop up torches
  platforms.push({ x: 1050, y: gndY - 70, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: 1150, y: gndY - 140, w: 50, h: 14, type: 'bone' })
  platforms.push({ x: 1100, y: gndY - 210, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: 1200, y: gndY - 280, w: 55, h: 14, type: 'altar' })
  platforms.push({ x: 1140, y: gndY - 350, w: 45, h: 50, type: 'torch' })
  // Top of climb - horizontal at height
  platforms.push({ x: 1250, y: gndY - 320, w: 120, h: 20, type: 'altar' })
  platforms.push({ x: 1410, y: gndY - 300, w: 80, h: 14, type: 'bone' })
  platforms.push({ x: 1530, y: gndY - 270, w: 45, h: 50, type: 'torch' })
  // Descent back down
  platforms.push({ x: 1620, y: gndY - 200, w: 60, h: 14, type: 'ember' })
  platforms.push({ x: 1560, y: gndY - 130, w: 50, h: 14, type: 'bone' })
  platforms.push({ x: 1640, y: gndY - 60, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: 1700, y: gndY, w: 150, h: 35, type: 'altar' })

  // === SEKTION 3: Runepassagen (1800-2700) - puzzle-agtig ===
  platforms.push({ x: 1860, y: gndY, w: 130, h: 35, type: 'altar' })
  platforms.push({ x: 2040, y: gndY, w: 120, h: 35, type: 'ember' })
  platforms.push({ x: 2210, y: gndY - 30, w: 100, h: 35, type: 'altar' })
  platforms.push({ x: 2360, y: gndY + 10, w: 110, h: 35, type: 'ember' })
  platforms.push({ x: 2520, y: gndY, w: 150, h: 35, type: 'altar' })
  // High path via torches
  platforms.push({ x: 1920, y: gndY - 90, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: 2100, y: gndY - 120, w: 50, h: 14, type: 'bone' })
  platforms.push({ x: 2280, y: gndY - 100, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: 2450, y: gndY - 130, w: 55, h: 14, type: 'bone' })
  platforms.push({ x: 2600, y: gndY - 80, w: 45, h: 50, type: 'torch' })

  // === SEKTION 4: Boss arena (2750-3800) ===
  platforms.push({ x: 2720, y: gndY, w: 250, h: 35, type: 'altar' })
  platforms.push({ x: 3020, y: gndY, w: 200, h: 35, type: 'ember' })
  platforms.push({ x: 3270, y: gndY, w: 250, h: 35, type: 'altar' })
  platforms.push({ x: 3570, y: gndY, w: 180, h: 35, type: 'altar' })
  platforms.push({ x: 2900, y: gndY - 80, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: 3150, y: gndY - 90, w: 45, h: 50, type: 'torch' })
  platforms.push({ x: goalX - 30, y: gndY, w: 120, h: 35, type: 'altar' })

  // === ITEMS (need 10 øl + 3 Jim + 2 dalmatiner) ===
  const olSpots = [
    [180, gndY - 30], [380, gndY - 30], [590, gndY - 30], [670, gndY - 110],
    [1020, gndY - 30], [1100, gndY - 110], [1300, gndY - 130], [1500, gndY - 30],
    [1650, gndY - 30], [1950, gndY - 120], [2130, gndY - 150], [2400, gndY - 30],
    [2550, gndY - 30], [2630, gndY - 110],
  ]
  olSpots.forEach(([x, y]) => items.push({ x, y, type: 'ol', collected: false }))

  items.push({ x: 1280, y: gndY - 140, type: 'jim_token', collected: false })
  items.push({ x: 2120, y: gndY - 160, type: 'jim_token', collected: false })
  items.push({ x: 2480, y: gndY - 160, type: 'jim_token', collected: false })
  items.push({ x: 830, y: gndY - 30, type: 'dalmatiner', collected: false })
  items.push({ x: 2300, y: gndY - 140, type: 'dalmatiner', collected: false })
  items.push({ x: 1400, y: gndY - 30, type: 'powerup_big', collected: false })

  // === ENEMIES - Fire cult themed ===
  // Fire priests (slow, throw fire)
  enemies.push(mkE(550, gndY - 35, 'fire_priest', 35, 60))
  enemies.push(mkE(1200, gndY - 35, 'fire_priest', 40, 50))
  enemies.push(mkE(2050, gndY - 35, 'fire_priest', 45, 70))
  // Mask warriors (fast, melee)
  enemies.push(mkE(900, gndY - 35, 'mask_warrior', 75, 80))
  enemies.push(mkE(1650, gndY - 35, 'mask_warrior', 80, 70))
  enemies.push(mkE(2400, gndY - 35, 'mask_warrior', 85, 90))
  // Fire wolves (burning, fast)
  enemies.push(mkE(1500, gndY - 25, 'fire_wolf', 100, 80))

  // BOSS: BLÓTMODEREN - Sinmara (ild-jættens hustru)
  enemies.push({
    x: 3300, y: gndY - 55, w: 40, h: 55, type: 'boss_fire',
    alive: true, dir: -1, speed: 70, rs: 2750, re: 3550,
    hp: 8, phase: 1, attackTimer: 2,
    projectileX: 0, projectileY: 0, projectileActive: false,
  })

  // Jim positions
  jimPositions = [
    { x: 500, y: gndY - 80, dialogKey: 'midLevel', triggered: false },
    { x: 2680, y: gndY - 50, dialogKey: 'preBoss', triggered: false },
  ]

  checkpointX = 60
}

// ==================== LEVEL 5: LOKES OVERFART ====================
// COMPLETELY DIFFERENT GAMEPLAY: Boat auto-scrolls, dodge obstacles, Loke illusions
// No platforms. Boat IS the ground. Fog everywhere. RED RED RED.
let boatX = 0, boatY = 0, boatRock = 0
let boatSpeed = 80
let boatDistance = 0
let odinBallX = 0, odinBallY = 0, odinBallVx = 0, odinBallVy = 0
let odinBallActive = false, odinBounces = 0
let lokePhase = 0 // 0=start, 1=illusions begin, 2=transformation, 3=arrival
let lokeIllusions: { x: number; y: number; real: boolean; timer: number }[] = []
let beerCans: { x: number; y: number; vx: number; vy: number; alive: boolean }[] = []
let larsBoatOffset = 0 // Lars position offset on boat (-1 to 1)
let larsMoveTimes = [15, 30, 50] // Bounces at which Lars moves
let larsMoveCount = 0
let extraBalls: { x: number; y: number; vx: number; vy: number; active: boolean }[] = []
let piaActive = false; let piaTimer = 0
let ghostPaddleActive = false; let ghostPaddleTimer = 0
let bigLarsActive = false; let bigLarsTimer = 0

interface FogObstacle { x: number; y: number; type: 'wreck' | 'hand' | 'rock' | 'shield'; passed: boolean }
let fogObstacles: FogObstacle[] = []
let obstacleTimer = 0

const JIM_ONELINERS_L5 = [
  'Smukt, ikke?', 'Det røde... det kalder.', 'Hører du stemmer?',
  'Vi er tæt på...', 'Tågen hvisker.', 'Se ikke ned, Lars.',
  'Jeg har altid elsket det røde.', 'Næsten fremme...',
  'Stoler du på mig?', 'Det burde du måske ikke.',
]

function buildLevel5() {
  platforms = []; enemies = []; items = []; jimPositions = []; particles = []
  levelWidth = 6000 // Long boat journey
  levelHeight = 0
  goalX = levelWidth - 200

  // Jim companion active but different - he's on the boat
  jimActive = true
  jimComment = ''; jimCommentTimer = 0
  jimPrankActive = ''; jimPrankTimer = 0
  jimMood = 'normal'; jimMoodTimer = 0
  jimTriggeredSwapL1 = false; jimTriggeredWindL3 = false; jimTriggeredFireL4 = false
  dalmatinerActive = false; dalmatinerCaught = false

  // Boat setup - use fallback 500 if H not ready, corrected in update()
  boatX = 200
  boatY = H > 200 ? H - 120 : 500
  boatRock = 0
  boatSpeed = 80
  boatDistance = 0
  lokePhase = 0
  lokeIllusions = []
  fogObstacles = []
  obstacleTimer = 1

  // No platforms - boat is the paddle

  // Odin ball + projectiles + extras
  odinBallActive = false; odinBounces = 0
  beerCans = []; extraBalls = []
  larsBoatOffset = 0; larsMoveCount = 0
  piaActive = false; piaTimer = 0
  ghostPaddleActive = false; ghostPaddleTimer = 0
  bigLarsActive = false; bigLarsTimer = 0
  odinBallX = boatX + 120
  odinBallY = boatY - 30
  odinBallVx = 0; odinBallVy = 0

  // Items in a GRID at the top (breakout-style targets to hit with the ball)
  const cols = 8, rows = 3
  const gridW = W * 0.85, gridH = 100
  const gridX = (W - gridW) / 2, gridY = 70
  const cellW = gridW / cols, cellH = gridH / rows
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let type: 'ol' | 'jim_token' | 'dalmatiner' = 'ol'
      if (row === 0 && col % 3 === 1) type = 'jim_token'
      if (row === 1 && col === 4) type = 'dalmatiner'
      if (row === 0 && col === 6) type = 'dalmatiner'
      items.push({
        x: gridX + col * cellW + cellW / 2,
        y: gridY + row * cellH + cellH / 2,
        type, collected: false,
      })
    }
  }

  // Dialog triggers based on bounces (handled in update)
  jimPositions = []

  checkpointX = 0
}

// ==================== LEVEL 6: VALHALLA - DEN EVIGE FEST ====================
// COMPLETELY DIFFERENT: Exploration, NPCs, feast, Jim/Loke reveal, eternal loop
// No platforming, no gravity, no enemies. Lars WALKS through the great hall.
interface NPC { x: number; y: number; name: string; dialogue: string[]; interacted: boolean; type: 'warrior' | 'valkyrie' | 'skald' | 'king' }
let npcs: NPC[] = []
let valhallaPhase = 0 // 0=explore, 1=feast, 2=drinkgame, 3=reveal, 4=eternal, 5=escaped
let drinkGameActive = false, drinkGameRound = 0, drinkGameMarker = 0, drinkGameScore = 0
let revealProgress = 0 // 0 to 1, visual transformation
let eternalLoopCount = 0
let talkingToNpc: NPC | null = null, npcDialogIndex = 0
let showNpcPrompt = false, nearestNpcName = ''

const JIM_ONELINERS_L6 = [
  'Smukt sted, ikke?', 'Drik! Spis!', 'Hør den musik...',
  'Krigerne hilser dig.', 'Du hører til her, Lars.',
  'Mjøden er uendelig.', 'Festen stopper aldrig.',
  'Har du talt med kongen?', 'Valkyrierne holder øje med dig.',
]

function buildLevel6() {
  platforms = []; enemies = []; items = []; jimPositions = []; particles = []
  const gndY = H > 200 ? H - 60 : 540
  levelWidth = 3500
  levelHeight = 0
  goalX = 99999 // No traditional goal in Valhalla

  // Jim companion
  jimActive = true
  jimComment = ''; jimCommentTimer = 0
  jimPrankActive = ''; jimPrankTimer = 0
  jimMood = 'normal'; jimMoodTimer = 0
  jimTriggeredSwapL1 = false; jimTriggeredWindL3 = false; jimTriggeredFireL4 = false

  // Single flat floor (the great hall)
  platforms.push({ x: -200, y: gndY, w: levelWidth + 400, h: 50, type: 'stone' })

  // Valhalla state
  valhallaPhase = 0; drinkGameActive = false; drinkGameRound = 0
  drinkGameMarker = 0; drinkGameScore = 0; revealProgress = 0
  eternalLoopCount = 0; talkingToNpc = null; showNpcPrompt = false

  // NPCs spread through the hall
  npcs = [
    { x: 400, y: gndY - 35, name: 'Bjørn Jernside', dialogue: ['Skål, kriger! Du er kommet langt.', 'Mjøden er varm og kæmperne er mange.', 'Her kæmper vi om dagen og fester om natten. For evigt.'], interacted: false, type: 'warrior' },
    { x: 800, y: gndY - 35, name: 'Freya Skjoldmø', dialogue: ['En ny sjæl i hallen. Velkommen.', 'Du har kæmpet godt, Lars. Det kan jeg se på dine ar.', 'Drik. Du har fortjent det.'], interacted: false, type: 'valkyrie' },
    { x: 1200, y: gndY - 35, name: 'Ragnar Mjødbrygger', dialogue: ['SKÅL! Prøv min mjød!', 'Vil du spille et drikkespil? Gå til det store bord!'], interacted: false, type: 'warrior' },
    { x: 1600, y: gndY - 35, name: 'Bragi Skalden', dialogue: ['Jeg har sunget om din rejse, Lars.', 'Gennem mose, skov, klipper og ild.', 'Over det røde hav. Til denne hal.', 'Dit saga er... næsten skrevet færdig.'], interacted: false, type: 'skald' },
    { x: 2000, y: gndY - 35, name: 'Odin Alfader', dialogue: ['Lars.', 'Du har bevist dit værd.', 'Denne hal er din belønning. Eller din fælde.', 'Det afhænger af perspektivet.'], interacted: false, type: 'king' },
    { x: 2800, y: gndY - 35, name: 'Sigrun Valkyrie', dialogue: ['Festen varer evigt her.', 'Har du lagt mærke til det? Ingen går nogensinde.', 'Ingen KAN gå.', '...medmindre du kender vejen.'], interacted: false, type: 'valkyrie' },
    { x: 3080, y: gndY - 35, name: 'Den Gamle Porsche-Ejer', dialogue: ['I min tid kørte vi i 911\'ere.', 'Flad sekser. Nul elektronik. Ren olie.', 'I dag... mjød.', 'Men jeg husker hver eneste gearskift, Lars.'], interacted: false, type: 'porsche' },
  ]

  // Mjød, mad, guld items spread through hall
  for (let ix = 200; ix < levelWidth - 200; ix += 150) {
    const type = Math.random() > 0.7 ? 'jim_token' : Math.random() > 0.5 ? 'dalmatiner' : 'ol'
    items.push({ x: ix + Math.random() * 80, y: gndY - 20, type, collected: false })
  }

  // Jim dialog triggers
  jimPositions = [
    { x: 1400, y: gndY - 80, dialogKey: 'feast', triggered: false },
  ]

  // Drinkgame zone at x=1200
  // Reveal zone at x=2500

  checkpointX = 60
}

const LEVEL_NAMES = ['FANGENS MOSER', 'DEN SORTE SKOV', 'BLODKLIPPERNE', 'RITUALILDEN', 'LOKES OVERFART', 'VALHALLA']

// ==================== CUTSCENE SYSTEM ====================
function startCutscene(lines: typeof cutsceneLines.value, callback: () => void) {
  cutsceneLines.value = lines
  cutsceneIndex.value = 0
  cutsceneCallback.value = callback
  typewriterText.value = ''
  typewriterDone.value = false
  gameState.value = 'cutscene'
  startTypewriter()
}

let typewriterInterval: ReturnType<typeof setInterval> | null = null
function startTypewriter() {
  const line = cutsceneLines.value[cutsceneIndex.value]
  if (!line) return
  typewriterText.value = ''
  typewriterDone.value = false
  let i = 0
  if (typewriterInterval) clearInterval(typewriterInterval)
  typewriterInterval = setInterval(() => {
    if (i < line.text.length) {
      typewriterText.value += line.text[i]
      i++
    } else {
      typewriterDone.value = true
      if (typewriterInterval) clearInterval(typewriterInterval)
    }
  }, 35)
}

function advanceCutscene() {
  if (!typewriterDone.value) {
    // Skip to full text
    if (typewriterInterval) clearInterval(typewriterInterval)
    typewriterText.value = cutsceneLines.value[cutsceneIndex.value]?.text || ''
    typewriterDone.value = true
    return
  }
  cutsceneIndex.value++
  if (cutsceneIndex.value >= cutsceneLines.value.length) {
    gameState.value = 'playing'
    cutsceneCallback.value?.()
    return
  }
  startTypewriter()
}

// ==================== GAME LOOP ====================
function update(dt: number) {
  time.value += dt
  if (deadDelay > 0) deadDelay -= dt

  // Level transition fade driver
  if (levelFadeDir === -1) {
    levelFade += dt / 0.8 // 0.8s fade out
    if (levelFade >= 1) {
      levelFade = 1
      levelFadeDir = 0
      doActualAdvanceLevel()
    }
  } else if (levelFadeDir === 1) {
    levelFade -= dt / 0.8
    if (levelFade <= 0) {
      levelFade = 0
      levelFadeDir = 0
    }
  }

  // Hit-stop freezes all update logic for a beat (impact emphasis)
  if (hitStopTimer > 0) { hitStopTimer -= dt; return }

  // Decay screen shake
  if (shakeAmt > 0) { shakeAmt = Math.max(0, shakeAmt - dt * 30) }

  // Lars mood timer (happy/victory revert to normal when expired).
  // 'scared' is set fresh every frame by enemy proximity check; it decays naturally.
  if (larsMoodTimer > 0) {
    larsMoodTimer -= dt
    if (larsMoodTimer <= 0 && larsMood !== 'scared') larsMood = 'normal'
  }
  if (larsBounceTimer > 0) larsBounceTimer -= dt

  // Atmospheric effects - different per level
  if (gameState.value === 'playing' || gameState.value === 'boss') {
    if (currentLevel.value === 1) {
      if (Math.random() < 0.08) spawnFog()
      spawnRain()
    } else if (currentLevel.value === 2) {
      if (Math.random() < 0.06) spawnGreenFog()
      if (Math.random() < 0.04) spawnLeaf()
      if (Math.random() < 0.03) spawnFirefly()
      if (Math.random() < 0.02) {
        const mushPlat = platforms.find(p => p.type === 'mushroom' && p.x > cameraX - 50 && p.x < cameraX + W + 50)
        if (mushPlat) spawnSpore(mushPlat.x + mushPlat.w / 2, mushPlat.y)
      }
    } else if (currentLevel.value === 3) {
      // Heavy diagonal storm rain
      for (let r = 0; r < 3; r++) {
        particles.push({
          x: cameraX + Math.random() * W + 100, y: -10,
          vx: -80 - Math.random() * 60, vy: 400 + Math.random() * 200,
          life: 1.5, maxLife: 1.5, size: 1, color: 'storm_rain',
        })
      }
      // Sea spray from below
      if (Math.random() < 0.05) {
        particles.push({
          x: cameraX + Math.random() * W, y: H + 5,
          vx: (Math.random() - 0.5) * 60, vy: -100 - Math.random() * 80,
          life: 1 + Math.random(), maxLife: 1 + Math.random(), size: 2 + Math.random() * 3, color: 'sea_spray',
        })
      }
      // Wind force fluctuation
      // Strong wind gusts that actually push Lars around
      windForce = Math.sin(time.value * 0.8) * 120 + Math.sin(time.value * 2.3) * 80
      // Occasional mega gust
      if (Math.sin(time.value * 0.3) > 0.85) windForce *= 2
      // Jim's wind prank: double it!
      if (jimPrankActive === 'wind') windForce *= 2
    } else if (currentLevel.value === 4) {
      // LOTS of rising embers (more than before)
      for (let em = 0; em < 2; em++) {
        if (Math.random() < 0.2) {
          particles.push({ x: cameraX + Math.random() * W, y: H + 5, vx: (Math.random() - 0.5) * 40, vy: -80 - Math.random() * 100, life: 2 + Math.random() * 3, maxLife: 2 + Math.random() * 3, size: 1 + Math.random() * 3, color: 'ember' })
        }
      }
      // THICK smoke/fog everywhere (much more than before)
      if (Math.random() < 0.1) {
        particles.push({ x: cameraX + Math.random() * W, y: H * 0.2 + Math.random() * H * 0.6, vx: 8 + Math.random() * 12, vy: -3 + Math.random() * 6, life: 3 + Math.random() * 4, maxLife: 3 + Math.random() * 4, size: 25 + Math.random() * 50, color: 'fire_smoke' })
      }
      // Smoke from altars/torches
      if (Math.random() < 0.06) {
        const sp = platforms.find(p => (p.type === 'altar' || p.type === 'torch') && p.x > cameraX - 50 && p.x < cameraX + W + 50)
        if (sp) particles.push({ x: sp.x + sp.w / 2 + (Math.random() - 0.5) * 20, y: sp.y - 5, vx: (Math.random() - 0.5) * 15, vy: -40 - Math.random() * 50, life: 2 + Math.random() * 3, maxLife: 2 + Math.random() * 3, size: 10 + Math.random() * 20, color: 'fire_smoke' })
      }
      // LAVA ERUPTIONS from below (volcanic geysers) — Jim's fire prank doubles frequency
      const eruptRate = jimPrankActive === 'fire' ? 0.04 : 0.015
      if (Math.random() < eruptRate) {
        const lavaX = cameraX + Math.random() * W
        for (let lv = 0; lv < 8; lv++) {
          particles.push({ x: lavaX + (Math.random() - 0.5) * 15, y: H + 5, vx: (Math.random() - 0.5) * 50, vy: -150 - Math.random() * 200, life: 1.5 + Math.random() * 1.5, maxLife: 1.5 + Math.random() * 1.5, size: 2 + Math.random() * 4, color: 'lava' })
        }
      }
      // Jim fire-prank: extra column of fire right where Lars is standing
      if (jimPrankActive === 'fire' && Math.random() < 0.3) {
        for (let fc = 0; fc < 5; fc++) {
          particles.push({ x: px + (Math.random() - 0.5) * 60, y: py + 50, vx: (Math.random() - 0.5) * 30, vy: -200 - Math.random() * 150, life: 1 + Math.random(), maxLife: 1 + Math.random(), size: 2 + Math.random() * 4, color: 'lava' })
        }
      }
    } else if (currentLevel.value === 5) {
      // HEAVY RED FOG - constant, thick, beautiful
      for (let rf = 0; rf < 3; rf++) {
        if (Math.random() < 0.15) {
          particles.push({ x: cameraX + W + 20, y: Math.random() * H, vx: -30 - Math.random() * 40, vy: (Math.random() - 0.5) * 10, life: 4 + Math.random() * 5, maxLife: 4 + Math.random() * 5, size: 30 + Math.random() * 60, color: 'red_fog' })
        }
      }
      // Red embers
      if (Math.random() < 0.08) {
        particles.push({ x: cameraX + Math.random() * W, y: H + 5, vx: -10 + Math.random() * 20, vy: -20 - Math.random() * 40, life: 3 + Math.random() * 3, maxLife: 3 + Math.random() * 3, size: 1 + Math.random() * 2, color: 'red_ember' })
      }

      // === ODIN PONG - Boat is paddle, Odin's head is ball ===
      if (gameState.value === 'playing') {
        cameraX = 0 // Fixed camera for pong
        // Ensure boat is near bottom of screen
        if (H > 200) boatY = H - 120
        boatRock = Math.sin(time.value * 1.5) * 3

        // Boat (paddle) movement - left/right with keys
        const moveSpeed = 600 // FAST paddle
        let left5 = keysDown.has('ArrowLeft') || keysDown.has('KeyA')
        let right5 = keysDown.has('ArrowRight') || keysDown.has('KeyD')
        // Loke's drunk prank inverts
        if (jimPrankActive === 'drunk') { const tmp = left5; left5 = right5; right5 = tmp }
        if (left5) boatX -= moveSpeed * dt
        if (right5) boatX += moveSpeed * dt
        // Lock boat within screen bounds (tight)
        const paddleVisualW = jimPrankActive === 'shrink' ? 130 : 240
        boatX = Math.max(5, Math.min(W - paddleVisualW - 30, boatX))

        // Lars LOCKED to boat - no gravity, no falling
        // Lars position shifts based on larsBoatOffset (-0.3 to 0.3)
        const larsOnBoat = 110 + larsBoatOffset * 80
        px = boatX + larsOnBoat; py = boatY - 40 + boatRock
        pvy = 0; onGround = true

        // SHOOT with Space/Up - only when ball is already active and have ammo
        if (odinBallActive && odinBounces > 0 && (tapped || keysDown.has('Space') || keysDown.has('ArrowUp'))) {
          tapped = false; keysDown.delete('Space'); keysDown.delete('ArrowUp')
          odinBounces--
          beerCans.push({ x: boatX + 120, y: boatY - 15, vx: 0, vy: -500, alive: true })
          spawnParticles(boatX + 120, boatY - 10, 3, '#F5A623', 30)
        }

        // Skull shots hit items!
        for (const shot of beerCans) {
          if (!shot.alive) continue
          shot.y += shot.vy * dt
          if (shot.y < 0) { shot.alive = false; continue }
          for (const item of items) {
            if (item.collected) continue
            if (Math.abs(shot.x - item.x) < 20 && Math.abs(shot.y - item.y) < 20) {
              item.collected = true; shot.alive = false
              if (item.type === 'ol') { levelOl.value++; score.value += 50; spawnParticles(item.x, item.y, 8, '#F5A623', 50) }
              else if (item.type === 'jim_token') { levelJim.value++; score.value += 100; spawnParticles(item.x, item.y, 10, '#E84393', 60) }
              else if (item.type === 'dalmatiner') { levelDal.value++; score.value += 150; spawnParticles(item.x, item.y, 12, '#FFFFFF', 70) }
            }
          }
        }
        beerCans = beerCans.filter(b => b.alive)

        // Odin's head (ball) - sits on boat until Space launches it
        if (!odinBallActive) {
          // Ball rests on the boat, waiting to be launched
          odinBallX = boatX + 120
          odinBallY = boatY - 30
          odinBallVx = 0; odinBallVy = 0
          // Launch with Space/Up/tap
          if (tapped || keysDown.has('Space') || keysDown.has('ArrowUp')) {
            tapped = false; keysDown.delete('Space'); keysDown.delete('ArrowUp')
            odinBallVx = (Math.random() - 0.5) * 120
            odinBallVy = -180
            odinBallActive = true
          }
          // Ball follows boat while resting
        } else {
          // Ball is active - apply physics

        odinBallX += odinBallVx * dt
        odinBallY += odinBallVy * dt

        // Wall bounces (tight to screen edges)
        if (odinBallX < 12) { odinBallVx = Math.abs(odinBallVx); odinBallX = 12 }
        if (odinBallX > W - 12) { odinBallVx = -Math.abs(odinBallVx); odinBallX = W - 12 }
        // Ceiling bounce
        if (odinBallY < 55) { odinBallVy = Math.abs(odinBallVy); odinBallY = 55 }

        // Boat paddle collision (shrinks when Loke pranks!)
        const paddleW = jimPrankActive === 'shrink' ? 120 : 255
        const boatLeft = boatX + (255 - paddleW) / 2 - 15
        const boatRight = boatLeft + paddleW
        const boatTop = boatY - 10 + boatRock
        const paddleCenter = (boatLeft + boatRight) / 2
        if (odinBallY + 12 >= boatTop && odinBallY < boatTop + 20 && odinBallX > boatLeft && odinBallX < boatRight && odinBallVy > 0) {
          odinBallVy = -Math.abs(odinBallVy) - 15
          // Angle based on where ball hits relative to CENTER of paddle
          // Left of center = ball goes left, right of center = ball goes right
          const hitPos = (odinBallX - paddleCenter) / (paddleW / 2) // -1 to 1
          odinBallVx = hitPos * 220
          odinBounces++
          score.value += 10
          spawnParticles(odinBallX, boatTop, 5, '#F5A623', 40)

          // Lars moves 3 times total (at bounce 15, 30, 50)
          if (larsMoveCount < 3 && odinBounces >= larsMoveTimes[larsMoveCount]) {
            larsMoveCount++
            larsBoatOffset = (Math.random() - 0.5) * 0.6 // -0.3 to 0.3
            jimComment = larsMoveCount === 1 ? 'Lars! Stå stille!' : larsMoveCount === 2 ? 'LARS! Hold op med at flytte dig!' : 'Lars er umulig...'
            jimCommentTimer = 4
          }

          // Speed up gradually
          odinBallVy -= Math.min(odinBounces * 3, 60)
        }

        // Ball falls below boat = lose a life, ball goes back to boat
        if (odinBallY > H + 20) {
          takeDamage()
          odinBallActive = false
          spawnParticles(W / 2, H - 20, 10, '#8B2030', 80)
        }
        } // end ball active else block

        // Collectibles floating at top - hit them with the ball OR shots
        for (const item of items) {
          if (item.collected) continue
          if (Math.abs(odinBallX - item.x) < 18 && Math.abs(odinBallY - item.y) < 18) {
            item.collected = true
            odinBallVy *= -1 // Bounce off item
            if (item.type === 'ol') { levelOl.value++; score.value += 50; spawnParticles(item.x, item.y, 8, '#F5A623', 50) }
            else if (item.type === 'jim_token') { levelJim.value++; score.value += 100; spawnParticles(item.x, item.y, 10, '#E84393', 60) }
            else if (item.type === 'dalmatiner') { levelDal.value++; score.value += 150; spawnParticles(item.x, item.y, 12, '#FFFFFF', 70) }
          }
        }

        // Loke phases based on bounces
        if (odinBounces > 8 && lokePhase === 0) lokePhase = 1
        if (odinBounces > 20 && lokePhase === 1) lokePhase = 2
        if (odinBounces > 35 && lokePhase === 2) lokePhase = 3

        // === LOKE'S CHAOS EVENTS (good AND bad!) ===
        if (jimPrankTimer > 0) jimPrankTimer -= dt
        else jimPrankActive = ''
        if (piaTimer > 0) piaTimer -= dt
        else piaActive = false
        if (ghostPaddleTimer > 0) ghostPaddleTimer -= dt
        else ghostPaddleActive = false
        if (bigLarsTimer > 0) bigLarsTimer -= dt
        else bigLarsActive = false

        // Update extra balls (MEGA BOLDE)
        for (const eb of extraBalls) {
          if (!eb.active) continue
          eb.x += eb.vx * dt; eb.y += eb.vy * dt
          if (eb.x < 12 || eb.x > W - 12) eb.vx *= -1
          if (eb.y < 55) eb.vy = Math.abs(eb.vy)
          // Extra balls hit items!
          for (const item of items) {
            if (item.collected) continue
            if (Math.abs(eb.x - item.x) < 16 && Math.abs(eb.y - item.y) < 16) {
              item.collected = true; eb.vy *= -1
              if (item.type === 'ol') { levelOl.value++; score.value += 50; spawnParticles(item.x, item.y, 6, '#F5A623', 40) }
              else if (item.type === 'jim_token') { levelJim.value++; score.value += 100; spawnParticles(item.x, item.y, 8, '#E84393', 50) }
              else if (item.type === 'dalmatiner') { levelDal.value++; score.value += 150; spawnParticles(item.x, item.y, 10, '#FFFFFF', 60) }
            }
          }
          // Extra balls bounce on paddle too
          if (eb.y + 10 >= boatTop && eb.y < boatTop + 20 && eb.x > boatLeft && eb.x < boatRight && eb.vy > 0) {
            eb.vy = -Math.abs(eb.vy)
          }
          if (eb.y > H + 30) eb.active = false
        }
        extraBalls = extraBalls.filter(eb => eb.active)

        // Ghost paddle bounces ball from top
        if (ghostPaddleActive && odinBallActive) {
          const ghostY = 200
          if (odinBallY - 12 <= ghostY && odinBallY > ghostY - 15 && odinBallVy < 0) {
            odinBallVy = Math.abs(odinBallVy) * 0.8
            spawnParticles(odinBallX, ghostY, 3, '#8B2030', 30)
          }
        }

        // Pia freezes boat
        if (piaActive) {
          boatX = boatX // Can't move!
        }

        // Trigger chaos events
        if (lokePhase >= 1 && Math.random() < 0.004 && !jimPrankActive && !piaActive) {
          const chaosType = Math.floor(Math.random() * 12)

          if (chaosType === 0) {
            // INVERTEREDE CONTROLS (BAD)
            jimPrankActive = 'drunk'; jimPrankTimer = 4
            jimComment = 'Venstre er h\u00f8jre nu! Ha!'
            jimCommentTimer = 4
          } else if (chaosType === 1) {
            // MINI-B\u00c5D (BAD)
            jimPrankActive = 'shrink'; jimPrankTimer = 5
            jimComment = 'Din b\u00e5d er lidt... lille nu.'
            jimCommentTimer = 4
          } else if (chaosType === 2) {
            // M\u00d8RKE (BAD)
            jimPrankActive = 'dark'; jimPrankTimer = 3
            jimComment = 'Kan du se noget? Nej? Godt.'
            jimCommentTimer = 3
          } else if (chaosType === 3) {
            // USYNLIG BOLD (BAD)
            jimPrankActive = 'invisible_ball'; jimPrankTimer = 2.5
            jimComment = 'Hvor er hovedet? Hm...'
            jimCommentTimer = 3
          } else if (chaosType === 4) {
            // PIA RINGER! (BAD - freezes boat)
            piaActive = true; piaTimer = 2.5
            jimComment = 'PIA RINGER! Lars kan ikke bev\u00e6ge sig!'
            jimCommentTimer = 3
          } else if (chaosType === 5 && lokePhase >= 2) {
            // NIDHOGG (BAD - fire)
            jimComment = 'NIDHOGG KOMMER!'
            jimCommentTimer = 3
            for (let fire = 0; fire < 20; fire++) {
              particles.push({ x: W * 0.8, y: H * 0.15, vx: -100 - Math.random() * 150, vy: 80 + Math.random() * 100, life: 2 + Math.random() * 2, maxLife: 2 + Math.random() * 2, size: 3 + Math.random() * 5, color: 'dragonfire' })
            }
          } else if (chaosType === 6) {
            // KAST LARS (BAD/FUNNY - Lars flies up)
            jimComment = 'WHEEE! Flyvende Lars!'
            jimCommentTimer = 3
            // Lars as particle flying up
            for (let lp = 0; lp < 8; lp++) {
              particles.push({ x: px + 13, y: py + 17, vx: (Math.random() - 0.5) * 60, vy: -150 - Math.random() * 100, life: 1.5, maxLife: 1.5, size: 3, color: '#D4A574' })
            }
          } else if (chaosType === 7) {
            // === GOOD EVENTS ===
            // MEGA BOLDE! (GOOD - extra real balls!)
            jimComment = 'FLERE HOVEDER! Odin er gener\u00f8s!'
            jimCommentTimer = 4
            for (let mb = 0; mb < 4; mb++) {
              extraBalls.push({ x: W * 0.2 + Math.random() * W * 0.6, y: H * 0.3, vx: (Math.random() - 0.5) * 200, vy: -120 - Math.random() * 100, active: true })
            }
          } else if (chaosType === 8) {
            // TYK LARS (FUNNY - purely visual)
            bigLarsActive = true; bigLarsTimer = 5
            jimComment = 'Har du taget p\u00e5, Lars?'
            jimCommentTimer = 4
          } else if (chaosType === 9) {
            // STOR LARS (FUNNY - blocks view)
            bigLarsActive = true; bigLarsTimer = 4
            jimComment = 'Du er en STOR mand, Lars.'
            jimCommentTimer = 3
          } else if (chaosType === 10) {
            // DOBBELT PADDLE (GOOD - ghost boat at top)
            ghostPaddleActive = true; ghostPaddleTimer = 6
            jimComment = 'To b\u00e5de! Jeg er gener\u00f8s i dag.'
            jimCommentTimer = 4
          } else if (chaosType === 11) {
            // GRATIS SKUD (GOOD)
            odinBounces += 5
            jimComment = '5 gratis skud! Sk\u00e5l!'
            jimCommentTimer = 3
            spawnParticles(W / 2, H / 2, 15, '#F5A623', 100)
          }
        }

        // Loke illusions in fog
        if (lokePhase >= 1 && Math.random() < 0.006) {
          lokeIllusions.push({ x: Math.random() * W, y: 60 + Math.random() * (H * 0.3), real: Math.random() > 0.7, timer: 3 })
        }
        for (const il of lokeIllusions) il.timer -= dt
        lokeIllusions = lokeIllusions.filter(il => il.timer > 0)

        // Win condition: collect enough items
        const allCollected = items.every(i => i.collected)
        if (allCollected && !goalReached) {
          goalReached = true
          const d = getLevelDialog('arrival')
          if (d) startCutscene(d, () => { gameState.value = 'levelcomplete' })
          else gameState.value = 'levelcomplete'
        }
      }

      // Jim one-liners
      if (jimCommentTimer > -2) jimCommentTimer -= dt
      if (jimCommentTimer <= 0 && Math.random() < 0.008) {
        jimComment = JIM_ONELINERS_L5[Math.floor(Math.random() * JIM_ONELINERS_L5.length)]
        jimCommentTimer = 6 + Math.random() * 8
      }
    } else if (currentLevel.value === 6) {
      // VALHALLA atmosphere: golden embers rising, warm smoke
      if (Math.random() < 0.1) {
        particles.push({ x: cameraX + Math.random() * W, y: H + 5, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 60, life: 3 + Math.random() * 3, maxLife: 3 + Math.random() * 3, size: 1.5 + Math.random() * 2, color: 'gold_ember' })
      }
      if (Math.random() < 0.04) {
        particles.push({ x: cameraX + Math.random() * W, y: H * 0.3 + Math.random() * H * 0.4, vx: 8 + Math.random() * 10, vy: -5 + Math.random() * 5, life: 3 + Math.random() * 4, maxLife: 3 + Math.random() * 4, size: 20 + Math.random() * 35, color: 'warm_smoke' })
      }

      // === VALHALLA GAMEPLAY ===
      if (gameState.value === 'playing') {
        const gndY = H > 200 ? H - 60 : 540

        // NO gravity, NO jumping - Lars walks on the hall floor
        pvy = 0; py = gndY - getPlayerH(); onGround = true

        // NPC proximity detection
        showNpcPrompt = false; nearestNpcName = ''
        for (const npc of npcs) {
          if (Math.abs(px + getPlayerW() / 2 - npc.x) < 50) {
            showNpcPrompt = true; nearestNpcName = npc.name
            // Talk to NPC with Space/Up
            if (tapped || keysDown.has('Space') || keysDown.has('ArrowUp')) {
              tapped = false; keysDown.delete('Space'); keysDown.delete('ArrowUp')
              if (!talkingToNpc) {
                talkingToNpc = npc; npcDialogIndex = 0
                npc.interacted = true
                gameState.value = 'cutscene'
                startCutscene(npc.dialogue.map(t => ({ speaker: 'npc', text: `${npc.name}: ${t}`, mood: 'neutral' })), () => {
                  talkingToNpc = null
                  // Check for drinkgame trigger
                  if (npc.name === 'Ragnar Mjødbrygger' && !drinkGameActive && valhallaPhase < 2) {
                    valhallaPhase = 2; drinkGameActive = true; drinkGameRound = 0; drinkGameScore = 0
                    const dDialog = getLevelDialog('drinkgame')
                    if (dDialog) startCutscene(dDialog, () => { gameState.value = 'playing' })
                  }
                })
              }
            }
            break
          }
        }

        // Drinkgame (simple timing: marker oscillates, press Space in gold zone)
        if (drinkGameActive && valhallaPhase === 2) {
          drinkGameMarker = (drinkGameMarker + 200 * dt) % 100 // 0-100 oscillating
          if (tapped || keysDown.has('Space')) {
            tapped = false; keysDown.delete('Space')
            const inZone = drinkGameMarker > 35 && drinkGameMarker < 65 // Sweet spot
            if (inZone) {
              drinkGameScore++; jimComment = 'SKÅL!'; jimCommentTimer = 2
              spawnParticles(px + 13, py - 10, 8, '#F5A623', 50)
            } else {
              jimComment = 'Ved siden af!'; jimCommentTimer = 2
            }
            drinkGameRound++
            if (drinkGameRound >= 3) {
              drinkGameActive = false
              score.value += drinkGameScore * 100
              jimComment = drinkGameScore >= 2 ? 'Lars kan DRIKKE!' : 'Øv... Prøv at drikke mere, Lars.'
              jimCommentTimer = 4
            }
          }
        }

        // LOKE REVEAL at x=2500 (after talking to most NPCs)
        const npcsInteracted = npcs.filter(n => n.interacted).length
        if (px > 2400 && npcsInteracted >= 4 && valhallaPhase < 3) {
          valhallaPhase = 3
          const revDialog = getLevelDialog('reveal')
          if (revDialog) {
            startCutscene(revDialog, () => {
              valhallaPhase = 4 // Eternal feast
              const etDialog = getLevelDialog('eternal')
              if (etDialog) startCutscene(etDialog, () => {
                eternalLoopCount++
                // NPC'er får ny dialog
                for (const npc of npcs) {
                  npc.interacted = false
                  npc.dialogue = ['Festen fortsætter...', 'Har du ikke været her før?', 'Tiden er underlig her.']
                }
                jimComment = 'Velkommen tilbage, Lars. Igen.'
                jimCommentTimer = 5
              })
            })
          }
        }

        // SECRET ESCAPE: Walk LEFT past x=0 after reveal
        if (valhallaPhase >= 4 && px < -50) {
          valhallaPhase = 5
          const escDialog = getLevelDialog('escape')
          if (escDialog) {
            startCutscene(escDialog, () => {
              // GAME COMPLETE! Show victory
              gameState.value = 'levelcomplete'
            })
          }
        }

        // Jim one-liners
        if (jimCommentTimer > -2) jimCommentTimer -= dt
        if (jimCommentTimer <= 0 && Math.random() < 0.006) {
          jimComment = valhallaPhase >= 3
            ? ['Festen stopper aldrig.', 'Du kan ikke gå, Lars.', 'Velkommen... igen.'][Math.floor(Math.random() * 3)]
            : JIM_ONELINERS_L6[Math.floor(Math.random() * JIM_ONELINERS_L6.length)]
          jimCommentTimer = 8 + Math.random() * 10
        }

        // Reveal visual progress (used in render)
        if (valhallaPhase === 3) revealProgress = Math.min(revealProgress + dt * 0.3, 1)
      }
    }
  }

  // Particles
  for (const p of particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
  }
  particles = particles.filter(p => p.life > 0)

  if (gameState.value !== 'playing' && gameState.value !== 'boss') return

  const pw = getPlayerW(), ph = getPlayerH()

  // === CONTROLS (Mario-style, with Jim prank effects) ===
  pvx = 0
  let left = keysDown.has('ArrowLeft') || keysDown.has('KeyA')
  let right = keysDown.has('ArrowRight') || keysDown.has('KeyD')
  const run = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')
  const speed = run ? RUN_SPEED : MOVE_SPEED

  // Jim prank: DRUNK or SWAP - inverted controls!
  if (jimPrankActive === 'drunk' || jimPrankActive === 'swap') {
    const tmp = left; left = right; right = tmp
  }

  if (left) { pvx = -speed; facing = -1 }
  if (right) { pvx = speed; facing = 1 }

  // Jim prank: HEAVY - lower jump force
  const jumpForce = jimPrankActive === 'heavy' ? JUMP_FORCE * 0.6 : JUMP_FORCE

  // Jump: ArrowUp OR Space OR tap
  if (tapped || keysDown.has('Space') || keysDown.has('ArrowUp')) {
    if (onGround) { pvy = jumpForce; onGround = false }
    tapped = false
    keysDown.delete('Space'); keysDown.delete('ArrowUp')
  }

  // Physics
  // No gravity in Level 5 (pong) or Level 6 (exploration)
  if (currentLevel.value !== 5 && currentLevel.value !== 6) pvy += GRAVITY * dt
  // Wind effect (Level 3) - directly moves Lars, can lift him off ground
  if (currentLevel.value === 3) {
    // Horizontal push - applied directly to position (bypasses pvx reset)
    px += windForce * (onGround ? 0.4 : 1.2) * dt

    // Vertical gusts - occasional updrafts that LIFT Lars
    const gustUp = Math.sin(time.value * 1.5) * Math.sin(time.value * 3.7)
    if (gustUp > 0.7 && onGround) {
      // Strong updraft - throws Lars into the air!
      pvy = -250 - gustUp * 150
      onGround = false
      spawnParticles(px + getPlayerW() / 2, py + getPlayerH(), 5, '#8899CC', 40)
    }
    // Constant slight upward force when airborne in strong wind
    if (!onGround && Math.abs(windForce) > 100) {
      pvy -= 80 * dt // Counteracts gravity slightly, makes Lars float
    }
  }
  px += pvx * dt
  py += pvy * dt
  if (px < 0) px = 0

  // Lars trail particles when running fast (Fase 6 juice)
  if (Math.abs(pvx) > 150 && onGround) {
    larsTrailAccum += dt
    if (larsTrailAccum > 0.06) {
      larsTrailAccum = 0
      particles.push({
        x: px + pw / 2, y: py + ph - 4,
        vx: -pvx * 0.1 + (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 0.4, maxLife: 0.4, size: 2 + Math.random() * 2,
        color: '#a8c5e0'
      })
    }
  }

  if (invTimer > 0) invTimer -= dt
  if (powerTimer > 0) { powerTimer -= dt; if (powerTimer <= 0) playerPower = 'none' }

  // Platform collision (generous tolerance so landing feels solid)
  onGround = false
  for (const p of platforms) {
    const feetY = py + ph
    const onTop = px + pw > p.x + 2 && px < p.x + p.w - 2
    const landingZone = feetY >= p.y - 4 && feetY <= p.y + p.h * 0.6
    if (onTop && landingZone && pvy >= 0) {
      py = p.y - ph; pvy = 0; onGround = true
      if (Math.abs(pvx) > 50) spawnParticles(px + pw / 2, p.y, 3, '#5A4A3A', 40)
    }
  }

  // Fall death (only trigger once)
  if (py > H + 80 && invTimer <= 0) {
    takeDamage()
    if (lives.value > 0) { px = checkpointX; py = H - 200; pvy = 0; invTimer = 2 }
  }

  // Camera follows Lars, accounting for WORLD_ZOOM.
  // viewW/viewH are the visible world dimensions after zoom.
  const zoom = getWorldZoom()
  const viewW = W / zoom
  const viewH = H / zoom
  const targetCamX = px - viewW * 0.4
  cameraX = Math.max(0, Math.min(targetCamX, levelWidth - viewW))
  const targetCamY = py - viewH * 0.55
  cameraY = Math.max(0, Math.min(targetCamY, H - viewH))

  // === ENEMIES ===
  for (const e of enemies) {
    if (!e.alive) continue
    if (e.type === 'boss' || e.type === 'boss_deer' || e.type === 'boss_berserker' || e.type === 'boss_fire') { updateBoss(e, dt); continue }

    e.x += e.dir * e.speed * dt
    if (e.x <= e.rs || e.x >= e.re) e.dir *= -1

    // Player collision
    if (collides(px, py, pw, ph, e.x, e.y, e.w, e.h)) {
      if (pvy > 0 && py + ph < e.y + 12) {
        e.alive = false; pvy = -300; score.value += 50
        spawnParticles(e.x + e.w / 2, e.y, 8, '#8B4513', 80)
        // Small shake + happy mood on successful stomp
        triggerShake(3)
        setLarsMood('happy', 0.4)
      } else if (invTimer <= 0) {
        takeDamage()
      }
    }
  }

  // === ITEMS ===
  for (const item of items) {
    if (item.collected) continue
    if (collides(px, py, pw, ph, item.x - 10, item.y - 10, 20, 20)) {
      item.collected = true
      // Lars grins when picking up ANY item — small joy burst
      setLarsMood('happy', 0.6)
      larsBounceTimer = 0.3
      switch (item.type) {
        case 'ol':
          levelOl.value++; score.value += 10
          spawnParticles(item.x, item.y, 6, '#F5A623', 50)
          // Extra sparkle stars for beer
          for (let ss = 0; ss < 6; ss++) {
            particles.push({
              x: item.x + (Math.random() - 0.5) * 16, y: item.y + (Math.random() - 0.5) * 16,
              vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30,
              life: 0.7, maxLife: 0.7, size: 2 + Math.random() * 2, color: 'sparkle',
            })
          }
          break
        case 'jim_token':
          levelJim.value++; score.value += 50
          spawnParticles(item.x, item.y, 10, '#E84393', 60)
          break
        case 'dalmatiner':
          levelDal.value++; score.value += 100
          spawnParticles(item.x, item.y, 12, '#FFFFFF', 70)
          break
        case 'powerup_big':
          playerPower = 'big'; powerTimer = 999
          spawnParticles(item.x, item.y, 10, '#FF2222', 60)
          setLarsMood('victory', 1.5)
          break
      }
    }
  }

  // === ENEMY PROXIMITY → SCARED MOOD ===
  // Only override if not currently happy/victory (those take priority briefly).
  if (larsMood === 'normal' || larsMood === 'scared') {
    let nearEnemy = false
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = (e.x + e.w / 2) - (px + pw / 2)
      const dy = (e.y + e.h / 2) - (py + ph / 2)
      if (Math.abs(dx) < 70 && Math.abs(dy) < 80) { nearEnemy = true; break }
    }
    if (nearEnemy) { larsMood = 'scared'; larsMoodTimer = 0.15 }
    else if (larsMood === 'scared' && larsMoodTimer <= 0) larsMood = 'normal'
  }

  // === JIM COMPANION AI (Level 2+) ===
  if (jimActive) {
    // Jim follows Lars with slight delay
    const jimTargetX = px + (facing > 0 ? -40 : 40)
    const jimTargetY = py
    jimX += (jimTargetX - jimX) * 3 * dt
    jimVy += GRAVITY * dt
    jimY += jimVy * dt

    // Jim on platforms
    jimOnGround = false
    for (const p of platforms) {
      if (jimX + 12 > p.x && jimX - 12 < p.x + p.w && jimY + 20 >= p.y && jimY + 20 <= p.y + p.h * 0.6 && jimVy >= 0) {
        jimY = p.y - 20; jimVy = 0; jimOnGround = true
      }
    }
    // Jim jumps when Lars jumps (slightly delayed)
    if (!jimOnGround && jimY > py + 50) { jimVy = JUMP_FORCE * 0.9 }
    if (jimY > H + 100) { jimY = py - 30; jimVy = 0 } // Teleport if falls too far

    // Evil intensity grows through Levels 4–5 (Loke foreshadowing)
    if (currentLevel.value === 4) jimEvilIntensity = Math.min(0.6, jimEvilIntensity + dt * 0.015)
    else if (currentLevel.value === 5) jimEvilIntensity = Math.min(1, jimEvilIntensity + dt * 0.03)

    // Mood timer
    if (jimMoodTimer > 0) {
      jimMoodTimer -= dt
      if (jimMoodTimer <= 0) jimMood = 'normal'
    }

    // Random one-liners — per level
    jimCommentTimer -= dt
    if (jimCommentTimer <= 0 && Math.random() < 0.01) {
      const pool = currentLevel.value === 1 ? JIM_ONELINERS_L1
        : currentLevel.value === 3 ? JIM_ONELINERS_L3
        : currentLevel.value === 4 ? JIM_ONELINERS_L4
        : currentLevel.value === 6 ? JIM_ONELINERS_L6
        : JIM_ONELINERS_L2
      jimComment = pool[Math.floor(Math.random() * pool.length)]
      jimCommentTimer = 5 + Math.random() * 8
    }
    // Micro-laughs interspersed (especially when evil)
    if (jimCommentTimer <= -1 && Math.random() < 0.005 + jimEvilIntensity * 0.02) {
      jimComment = JIM_LAUGHS[Math.floor(Math.random() * JIM_LAUGHS.length)]
      jimCommentTimer = 1.5
      setJimMood('laughing', 1.2)
    }
    if (jimCommentTimer <= -2) jimComment = '' // Clear after 2s

    // === JIM PRANK TRIGGERS ===
    if (jimPrankTimer > 0) {
      jimPrankTimer -= dt
      if (jimPrankTimer <= 0) { jimPrankActive = '' }
    }

    // ---- LEVEL 1: Swap prank (arrow keys invert) at x~1400 ----
    if (currentLevel.value === 1 && !jimTriggeredSwapL1 && px > 1380 && px < 1420 && !jimPrankActive) {
      jimPrankActive = 'swap'; jimPrankTimer = 4
      jimComment = 'Undskyld. Venstre er højre nu.'
      jimCommentTimer = 4
      setJimMood('laughing', 2)
      jimTriggeredSwapL1 = true
    }

    // ---- LEVEL 2: existing pranks ----
    // Drunk prank at x~700
    if (px > 680 && px < 720 && !jimPrankActive && currentLevel.value === 2) {
      jimPrankActive = 'drunk'; jimPrankTimer = 5
      jimComment = 'Skål, Lars! Drik!'
      jimCommentTimer = 5
      setJimMood('laughing', 2)
    }
    // Heavy stone prank at x~1800 (treetops)
    if (px > 1780 && px < 1820 && !jimPrankActive && currentLevel.value === 2 && jimPrankTimer <= 0) {
      jimPrankActive = 'heavy'; jimPrankTimer = 8
      jimComment = 'Ups! En sten i bukserne!'
      jimCommentTimer = 5
      setJimMood('pointing', 1.5)
    }
    // Dalmatiner sidequest at x~2200
    if (px > 2180 && px < 2220 && !dalmatinerActive && !dalmatinerCaught && currentLevel.value === 2) {
      dalmatinerActive = true
      dalmatinerX = px + 100; dalmatinerY = py - 20; dalmatinerVx = 80
      jimComment = 'MIN HUND! Fang den, Lars!'
      jimCommentTimer = 6
      setJimMood('pointing', 3)
    }

    // ---- LEVEL 3: Wind prank (double wind) at x~2000 ----
    if (currentLevel.value === 3 && !jimTriggeredWindL3 && px > 1980 && px < 2020 && !jimPrankActive) {
      jimPrankActive = 'wind'; jimPrankTimer = 3
      jimComment = 'Mærk stormen, Lars!'
      jimCommentTimer = 3
      setJimMood('pointing', 2)
      jimTriggeredWindL3 = true
    }

    // ---- LEVEL 4: Extra fire prank at x~1500 ----
    if (currentLevel.value === 4 && !jimTriggeredFireL4 && px > 1480 && px < 1520 && !jimPrankActive) {
      jimPrankActive = 'fire'; jimPrankTimer = 4
      jimComment = 'Jeg har tændt lidt ekstra for dig.'
      jimCommentTimer = 4
      setJimMood('evil', 4)
      jimTriggeredFireL4 = true
    }

    // Jim foreshadowing: his shadow is wrong (drawn in render)
  }

  // === DALMATINER CHASE ===
  if (dalmatinerActive && !dalmatinerCaught) {
    dalmatinerX += dalmatinerVx * dt
    // Dalmatiner bounces between platforms
    dalmatinerY += 200 * dt // gravity-ish
    for (const p of platforms) {
      if (dalmatinerX + 10 > p.x && dalmatinerX - 10 < p.x + p.w && dalmatinerY + 15 >= p.y && dalmatinerY + 15 <= p.y + 20) {
        dalmatinerY = p.y - 15; dalmatinerVx = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 40)
      }
    }
    // Catch the dalmatiner
    if (collides(px, py, pw, ph, dalmatinerX - 10, dalmatinerY - 10, 20, 20)) {
      dalmatinerCaught = true; dalmatinerActive = false
      score.value += 200
      jimComment = 'HA! Godt fanget!'
      jimCommentTimer = 4
      spawnParticles(dalmatinerX, dalmatinerY, 15, '#FFFFFF', 80)
    }
  }

  // === JIM ENCOUNTERS (dialog cutscenes) ===
  for (const jp of jimPositions) {
    if (jp.triggered) continue
    if (Math.abs(px - jp.x) < 80) {
      jp.triggered = true
      const dialog = getLevelDialog(jp.dialogKey)
      if (dialog) startCutscene(dialog, () => {})
    }
  }

  // === GOAL ===
  const bossAlive = enemies.some(e => (e.type === 'boss' || e.type === 'boss_deer' || e.type === 'boss_berserker' || e.type === 'boss_fire') && e.alive)
  if (!goalReached && px + pw > goalX && px < goalX + 60) {
    if (bossAlive) {
      // Can't finish - boss is still alive! Push Lars back firmly
      px = goalX - pw - 30 // Push back further to avoid re-trigger
      pvx = -100 // Bounce back
      if (jimCommentTimer <= 0) {
        jimComment = 'Bossen lever stadig, Lars!'
        jimCommentTimer = 3
      }
    } else if (levelOl.value < OL_REQ[currentLevel.value - 1]) {
      // Not enough items
      px = goalX - pw - 30
      pvx = -100
      if (jimCommentTimer <= 0) {
        jimComment = 'Saml flere \u00f8l f\u00f8rst!'
        jimCommentTimer = 3
      }
    } else if (levelOl.value >= OL_REQ[currentLevel.value - 1]) {
      goalReached = true
      setTimeout(() => {
        const postDialog = getLevelDialog('postBoss')
        if (postDialog) {
          startCutscene(postDialog, () => { gameState.value = 'levelcomplete' })
        } else {
          gameState.value = 'levelcomplete'
        }
      }, 800)
    }
  }

  // Checkpoint update
  if (px > checkpointX + 400) checkpointX = px - 100
}

// ==================== BOSS: BØDDELEN ====================
function updateBoss(e: Enemy, dt: number) {
  if (gameState.value !== 'playing' && gameState.value !== 'boss') return
  gameState.value = 'boss'

  const pw = getPlayerW(), ph = getPlayerH()
  e.attackTimer -= dt

  // Movement: walk towards Lars
  if (e.attackTimer > 0.5) {
    const dir = px > e.x ? 1 : -1
    e.x += dir * e.speed * dt
    e.dir = dir
  }

  // Attack patterns based on phase
  if (e.attackTimer <= 0) {
    // Charge attack - rush faster
    e.speed = 100 + e.phase * 30
    e.attackTimer = 2.0 - e.phase * 0.3

    // Throw projectile (axe) in phase 1+
    if (e.phase >= 1 && !e.projectileActive) {
      e.projectileActive = true
      e.projectileX = e.x + e.w / 2
      e.projectileY = e.y + 15
    }

    // Draugr special: WIND BLAST (pushes Lars away)
    if (e.type === 'boss_berserker' && e.phase >= 2) {
      const blastDir = px > e.x ? 1 : -1
      pvx += blastDir * 400 // Massive push
      pvy -= 150 // Slight uplift
      spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 20, '#8899CC', 150)
    }

    setTimeout(() => { e.speed = 60 + e.phase * 20 }, 600)
  }

  // Projectile
  if (e.projectileActive) {
    const pDir = px > e.projectileX ? 1 : -1
    e.projectileX += pDir * 280 * dt
    if (Math.abs(e.projectileX - e.x) > 450) e.projectileActive = false

    if (collides(px, py, pw, ph, e.projectileX - 12, e.projectileY - 8, 24, 16) && invTimer <= 0) {
      takeDamage()
      e.projectileActive = false
    }
  }

  // Stomp detection
  if (collides(px, py, pw, ph, e.x, e.y, e.w, e.h)) {
    if (pvy > 0 && py + ph < e.y + 15) {
      e.hp--; pvy = -350; invTimer = 0.5
      spawnParticles(e.x + e.w / 2, e.y, 15, '#FF4444', 100)
      // Juice: screen shake + brief hit-stop on every boss-hit
      triggerShake(4)
      hitStopTimer = 0.06

      if (e.hp <= 0) {
        // DRAUGR RESURRECTION: comes back twice with less HP!
        if (e.type === 'boss_berserker' && e.phase < 3) {
          e.phase++
          e.hp = Math.max(3, 7 - e.phase * 2) // 5 HP, then 3 HP
          e.speed = 80 + e.phase * 25 // Gets faster each time
          e.attackTimer = 1.5
          e.projectileActive = false
          // Visual: teleport to a different position
          e.x = e.rs + Math.random() * (e.re - e.rs)
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 25, '#6688FF', 120)
          // Jim comment on resurrection
          jimComment = e.phase === 2 ? 'Han rejser sig IGEN?!' : 'TREDJE GANG! NU skal han dø!'
          jimCommentTimer = 4
        } else {
          // Actually dead — MAX JUICE
          e.alive = false
          gameState.value = 'playing'
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 40, '#8B2020', 180)
          // Extra golden victory particles
          for (let vp = 0; vp < 24; vp++) {
            particles.push({
              x: e.x + e.w / 2, y: e.y + e.h / 2,
              vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260 - 40,
              life: 1.2 + Math.random() * 0.6, maxLife: 1.2, size: 2 + Math.random() * 3, color: 'gold_burst',
            })
          }
          score.value += 500 + (e.type === 'boss_berserker' ? 500 : 0)
          // MASSIVE shake + hit-stop for boss kill
          triggerShake(12)
          hitStopTimer = 0.15
          // Lars celebrates!
          setLarsMood('victory', 2.5)
          larsBounceTimer = 0.6
        }
      } else {
        if (e.hp <= 3) e.phase = Math.max(e.phase, 2)
        else if (e.hp <= 5) e.phase = Math.max(e.phase, 1)
        e.speed = 60 + e.phase * 20
        e.attackTimer = 0.8
      }
    } else if (invTimer <= 0) {
      takeDamage()
    }
  }
}

let deadDelay = 0
let deathQuote = ''

function takeDamage() {
  if (invTimer > 0) return
  // Screen shake on every hit
  triggerShake(6)
  setLarsMood('scared', 0.4)
  if (playerPower === 'big') { playerPower = 'none'; invTimer = 2; return }
  lives.value--; invTimer = 2
  if (lives.value <= 0) {
    maybeSaveHighscore()
    gameState.value = 'dead'
    deadDelay = 1.5
    triggerShake(15) // big death shake
    // Pick ONE death quote and lock it
    const quotes = jimData.level1.death
    deathQuote = quotes[Math.floor(Math.random() * quotes.length)]
  }
}

function collides(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// ==================== RENDER ====================
function render() {
  if (!ctx || !W || !H) return
  const c = ctx

  // === PARALLAX BACKGROUNDS (level-specific color treatment) ===
  // Level-specific base color
  const lvlBg = currentLevel.value === 1 ? '#0A0F0A'
    : currentLevel.value === 2 ? '#060F06'
    : currentLevel.value === 3 ? '#0A0A14'
    : currentLevel.value === 4 ? '#140A05'
    : currentLevel.value === 5 ? '#2A0A12'
    : currentLevel.value === 6 ? '#1A1208' // Warm dark gold
    : '#0A0F0A'
  c.fillStyle = lvlBg; c.fillRect(0, 0, W, H)

  // Far layer (slowest)
  if (bgFar.value) {
    const farX = -(cameraX * 0.1) % W
    c.drawImage(bgFar.value, farX, 0, W, H)
    c.drawImage(bgFar.value, farX + W, 0, W, H)
  } else {
    // Fallback gradient per level
    const skyGrad = c.createLinearGradient(0, 0, 0, H)
    if (currentLevel.value === 6) {
      // Warm golden Valhalla
      skyGrad.addColorStop(0, '#1A1208'); skyGrad.addColorStop(0.3, '#2A1A0A'); skyGrad.addColorStop(0.6, '#1A1008'); skyGrad.addColorStop(1, '#0A0804')
    } else if (currentLevel.value === 5) {
      skyGrad.addColorStop(0, '#2A0A10'); skyGrad.addColorStop(0.3, '#3A1018'); skyGrad.addColorStop(0.6, '#4A1525'); skyGrad.addColorStop(1, '#1A0508')
    } else if (currentLevel.value === 4) {
      skyGrad.addColorStop(0, '#1A0A05'); skyGrad.addColorStop(0.3, '#2A1008'); skyGrad.addColorStop(0.7, '#1A0805'); skyGrad.addColorStop(1, '#0A0502')
    } else if (currentLevel.value === 3) {
      skyGrad.addColorStop(0, '#0A0A1A'); skyGrad.addColorStop(0.4, '#1A1A2A'); skyGrad.addColorStop(1, '#0A1020')
    } else if (currentLevel.value === 2) {
      skyGrad.addColorStop(0, '#040A04'); skyGrad.addColorStop(0.5, '#081408'); skyGrad.addColorStop(1, '#0A1A0A')
    } else {
      skyGrad.addColorStop(0, '#0A0F0A'); skyGrad.addColorStop(0.5, '#121A12'); skyGrad.addColorStop(1, '#1A2A1A')
    }
    c.fillStyle = skyGrad; c.fillRect(0, 0, W, H)
  }

  // Level 3: Ocean below the cliffs
  if (currentLevel.value === 3) {
    const oceanGrad = c.createLinearGradient(0, H - 60, 0, H)
    oceanGrad.addColorStop(0, 'transparent')
    oceanGrad.addColorStop(0.5, 'rgba(10, 20, 40, 0.6)')
    oceanGrad.addColorStop(1, 'rgba(5, 15, 35, 0.9)')
    c.fillStyle = oceanGrad; c.fillRect(0, H - 60, W, 60)
    c.strokeStyle = 'rgba(100, 150, 200, 0.15)'; c.lineWidth = 1
    for (let wx = 0; wx < W; wx += 40) {
      const wy = H - 20 + Math.sin(time.value * 2 + wx * 0.05) * 5
      c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 20, wy - 4, wx + 40, wy); c.stroke()
    }
  }

  // Level 4: LAVA below - bubbling, glowing, terrifying
  if (currentLevel.value === 4) {
    const lavaGrad = c.createLinearGradient(0, H - 40, 0, H)
    lavaGrad.addColorStop(0, 'rgba(200, 50, 0, 0.3)')
    lavaGrad.addColorStop(0.5, 'rgba(255, 80, 0, 0.6)')
    lavaGrad.addColorStop(1, 'rgba(255, 120, 20, 0.8)')
    c.fillStyle = lavaGrad; c.fillRect(0, H - 40, W, 40)
    // Lava bubbles
    for (let bub = 0; bub < 5; bub++) {
      const bubX = (bub * 157 + time.value * 30) % W
      const bubR = 3 + Math.sin(time.value * 4 + bub * 2) * 2
      const bubY = H - 20 + Math.sin(time.value * 3 + bub) * 5
      c.fillStyle = '#FFAA22'; c.beginPath(); c.arc(bubX, bubY, bubR, 0, Math.PI * 2); c.fill()
    }
    // Heat distortion glow upward
    const heatUp = c.createLinearGradient(0, H - 80, 0, H - 40)
    heatUp.addColorStop(0, 'transparent')
    heatUp.addColorStop(1, 'rgba(255, 80, 0, 0.08)')
    c.fillStyle = heatUp; c.fillRect(0, H - 80, W, 40)
  }

  // Mid layer
  if (bgMid.value) {
    const midX = -(cameraX * 0.3) % W
    c.globalAlpha = currentLevel.value === 5 ? 0.9 : 0.7
    c.drawImage(bgMid.value, midX, 0, W, H)
    c.drawImage(bgMid.value, midX + W, 0, W, H)
    c.globalAlpha = 1
  }

  // Level-specific color overlay (tints everything)
  if (currentLevel.value === 3) {
    c.globalAlpha = 0.08; c.fillStyle = '#2233AA'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
  } else if (currentLevel.value === 2) {
    c.globalAlpha = 0.05; c.fillStyle = '#115511'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
  } else if (currentLevel.value === 6 && gameState.value !== 'loading') {
    // Warm golden Valhalla tint
    c.globalAlpha = 0.06; c.fillStyle = '#C9A84C'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
    // Warm glow from bottom (fire pits)
    const warmGrad = c.createLinearGradient(0, H - 80, 0, H)
    warmGrad.addColorStop(0, 'transparent'); warmGrad.addColorStop(1, 'rgba(200, 100, 20, 0.1)')
    c.fillStyle = warmGrad; c.fillRect(0, H - 80, W, 80)
    // Reveal red glow (increases during reveal)
    if (revealProgress > 0) {
      c.globalAlpha = revealProgress * 0.15; c.fillStyle = '#AA1030'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
    }
  } else if (currentLevel.value === 5 && gameState.value !== 'loading') {
    // DEEP RED tint - only during gameplay, NOT on loading screen
    c.globalAlpha = 0.1; c.fillStyle = '#AA1030'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
    // Red blood ocean
    const redOcean = c.createLinearGradient(0, H - 70, 0, H)
    redOcean.addColorStop(0, 'rgba(60, 10, 15, 0.5)')
    redOcean.addColorStop(0.3, 'rgba(80, 15, 20, 0.7)')
    redOcean.addColorStop(1, 'rgba(40, 5, 10, 0.9)')
    c.fillStyle = redOcean; c.fillRect(0, H - 70, W, 70)
    // Red waves
    c.strokeStyle = 'rgba(150, 40, 50, 0.2)'; c.lineWidth = 1.5
    for (let wv = 0; wv < W; wv += 35) {
      const wy = H - 40 + Math.sin(time.value * 1.5 + wv * 0.04) * 6
      c.beginPath(); c.moveTo(wv, wy); c.quadraticCurveTo(wv + 17, wy - 5, wv + 35, wy); c.stroke()
    }
    // Red moon
    c.globalAlpha = 0.15
    c.fillStyle = '#AA2040'
    c.beginPath(); c.arc(W * 0.7, H * 0.15, 30, 0, Math.PI * 2); c.fill()
    c.globalAlpha = 0.05
    c.fillStyle = '#FF3050'
    c.beginPath(); c.arc(W * 0.7, H * 0.15, 60, 0, Math.PI * 2); c.fill()
    c.globalAlpha = 1
  } else if (currentLevel.value === 4) {
    c.globalAlpha = 0.06; c.fillStyle = '#AA3300'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
    // Bottom heat glow
    const heatGrad = c.createLinearGradient(0, H - 80, 0, H)
    heatGrad.addColorStop(0, 'transparent'); heatGrad.addColorStop(1, 'rgba(200, 60, 10, 0.12)')
    c.fillStyle = heatGrad; c.fillRect(0, H - 80, W, 80)
  }

  // Near layer (foreground overlay - drawn after gameplay)
  // (rendered at end)

  // === WORLD TRANSFORM (camera + zoom + shake) ===
  // Everything drawn between this c.save() and the matching c.restore() is in
  // world-space, scaled by WORLD_ZOOM. Lars, enemies, platforms, items, Jim,
  // and world particles are all inside this block.
  c.save()
  // Screen-shake: random offset in screen pixels (applied before zoom transform)
  const sx = shakeAmt > 0 ? (Math.random() - 0.5) * shakeAmt : 0
  const sy = shakeAmt > 0 ? (Math.random() - 0.5) * shakeAmt : 0
  c.translate(sx, sy)
  const renderZoom = getWorldZoom()
  c.translate(-cameraX * renderZoom, -cameraY * renderZoom)
  c.scale(renderZoom, renderZoom)

  // === LEVEL 2 LIGHT SHAFTS (before platforms) ===
  if (currentLevel.value === 2) {
    c.globalAlpha = 0.04
    for (let ls = 0; ls < 3; ls++) {
      const lsX = cameraX + 150 + ls * 250 + Math.sin(time.value * 0.3 + ls) * 30
      const grad = c.createLinearGradient(lsX, 0, lsX + 40, H)
      grad.addColorStop(0, '#AAFF88')
      grad.addColorStop(1, 'transparent')
      c.fillStyle = grad
      c.fillRect(lsX, 0, 40 + ls * 10, H)
    }
    c.globalAlpha = 1

    // Glowing eyes in background
    for (let ey = 0; ey < 5; ey++) {
      const eyeX = (ey * 317 + cameraX * 0.15) % W + cameraX
      const eyeY = H * 0.3 + (ey * 173) % (H * 0.4)
      const blink = Math.sin(time.value * 2 + ey * 3) > 0.7
      if (blink) {
        c.fillStyle = ey % 2 === 0 ? 'rgba(200, 50, 50, 0.3)' : 'rgba(50, 200, 50, 0.3)'
        c.beginPath(); c.arc(eyeX, eyeY, 2, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(eyeX + 6, eyeY, 2, 0, Math.PI * 2); c.fill()
      }
    }
  }

  // === PLATFORMS ===
  for (const p of platforms) {
    if (p.x + p.w < cameraX - 50 || p.x > cameraX + W + 50) continue

    // Level 2 specific platform types
    if (p.type === 'root') {
      // Mossy root platform - organic, green-brown
      const rootGrad = c.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      rootGrad.addColorStop(0, '#2A3A1A')
      rootGrad.addColorStop(1, '#1A2A0A')
      c.fillStyle = rootGrad
      // Organic curved shape
      c.beginPath()
      c.moveTo(p.x + 5, p.y + p.h)
      c.quadraticCurveTo(p.x - 3, p.y + p.h / 2, p.x + 8, p.y)
      c.lineTo(p.x + p.w - 8, p.y)
      c.quadraticCurveTo(p.x + p.w + 3, p.y + p.h / 2, p.x + p.w - 5, p.y + p.h)
      c.closePath(); c.fill()
      // Moss dots on top
      c.fillStyle = '#4A6A2A'
      for (let mx = p.x + 10; mx < p.x + p.w - 10; mx += 8) {
        c.beginPath(); c.arc(mx + Math.random() * 4, p.y + 2, 2 + Math.random(), 0, Math.PI * 2); c.fill()
      }
    } else if (p.type === 'bark') {
      // Tree bark platform - dark brown, vertical texture
      c.fillStyle = '#3A2815'
      c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 3); c.fill()
      c.fillStyle = '#4A3825'
      c.fillRect(p.x + 2, p.y, p.w - 4, 3)
      // Bark texture (vertical lines)
      c.strokeStyle = '#2A1808'; c.lineWidth = 0.8
      for (let bx = p.x + 6; bx < p.x + p.w - 6; bx += 7) {
        c.beginPath(); c.moveTo(bx, p.y); c.lineTo(bx + 1, p.y + p.h); c.stroke()
      }
      // Red rune glow (subtle foreshadowing)
      if (Math.sin(p.x * 0.1) > 0.7) {
        c.fillStyle = 'rgba(139, 32, 32, 0.15)'
        c.fillRect(p.x + p.w / 2 - 4, p.y + 2, 8, p.h - 4)
      }
    } else if (p.type === 'mushroom') {
      // Glowing mushroom platform - bioluminescent!
      c.fillStyle = '#2A1A1A'
      c.beginPath(); c.roundRect(p.x + 4, p.y + 4, p.w - 8, p.h - 4, 2); c.fill() // stem
      // Cap
      c.fillStyle = '#6A1A2A'
      c.beginPath()
      c.moveTo(p.x, p.y + 5)
      c.quadraticCurveTo(p.x + p.w / 2, p.y - 8, p.x + p.w, p.y + 5)
      c.lineTo(p.x, p.y + 5)
      c.fill()
      // Bioluminescent glow
      const mushGlow = c.createRadialGradient(p.x + p.w / 2, p.y, 0, p.x + p.w / 2, p.y, p.w * 0.7)
      const glowPulse = 0.1 + Math.sin(time.value * 2 + p.x * 0.05) * 0.05
      mushGlow.addColorStop(0, `rgba(180, 255, 100, ${glowPulse})`)
      mushGlow.addColorStop(1, 'transparent')
      c.fillStyle = mushGlow; c.fillRect(p.x - 10, p.y - 15, p.w + 20, p.h + 25)
      // Spots on cap
      c.fillStyle = 'rgba(255, 200, 100, 0.3)'
      c.beginPath(); c.arc(p.x + p.w * 0.3, p.y, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(p.x + p.w * 0.7, p.y - 1, 1.5, 0, Math.PI * 2); c.fill()
    } else if (p.type === 'branch') {
      // Thin tree branch - dark, with leaves
      c.fillStyle = '#2A1A08'
      c.beginPath(); c.roundRect(p.x, p.y + 2, p.w, p.h - 2, 6); c.fill()
      c.fillStyle = '#3A2A18'
      c.fillRect(p.x + 3, p.y + 2, p.w - 6, 2)
      // Small leaves on branch
      c.fillStyle = '#1A4A1A'
      for (let lf = p.x + 15; lf < p.x + p.w - 10; lf += 20) {
        c.beginPath(); c.ellipse(lf, p.y, 4, 2, 0.3, 0, Math.PI * 2); c.fill()
      }
    } else if (p.type === 'cliff') {
      // Grey stone cliff - cold, wet, sharp edges
      const cliffGrad = c.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      cliffGrad.addColorStop(0, '#5A5A6A')
      cliffGrad.addColorStop(0.3, '#4A4A5A')
      cliffGrad.addColorStop(1, '#3A3A4A')
      c.fillStyle = cliffGrad
      // Jagged top edge
      c.beginPath(); c.moveTo(p.x, p.y + p.h)
      c.lineTo(p.x, p.y + 3); c.lineTo(p.x + 5, p.y); c.lineTo(p.x + 15, p.y + 2)
      c.lineTo(p.x + p.w * 0.3, p.y - 1); c.lineTo(p.x + p.w * 0.5, p.y + 1)
      c.lineTo(p.x + p.w * 0.7, p.y - 1); c.lineTo(p.x + p.w - 10, p.y + 2)
      c.lineTo(p.x + p.w, p.y + 3); c.lineTo(p.x + p.w, p.y + p.h); c.closePath(); c.fill()
      // Wet highlights
      c.fillStyle = 'rgba(150, 170, 190, 0.15)'
      c.fillRect(p.x + 3, p.y + 1, p.w - 6, 2)
      // Blood stains (permanent red)
      if (Math.sin(p.x * 0.07) > 0.5) {
        c.fillStyle = 'rgba(120, 20, 20, 0.2)'
        c.fillRect(p.x + p.w * 0.3, p.y + 2, 15, p.h - 4)
      }
    } else if (p.type === 'bridge') {
      // Wooden war bridge - fragile looking, ropes
      c.fillStyle = '#4A3018'
      c.beginPath(); c.roundRect(p.x, p.y + 2, p.w, p.h - 2, 2); c.fill()
      // Planks
      c.strokeStyle = '#3A2008'; c.lineWidth = 0.8
      for (let bx = p.x + 8; bx < p.x + p.w - 5; bx += 12) {
        c.beginPath(); c.moveTo(bx, p.y + 2); c.lineTo(bx, p.y + p.h); c.stroke()
      }
      // Ropes on sides
      c.strokeStyle = '#6A5A3A'; c.lineWidth = 1.5
      c.beginPath(); c.moveTo(p.x, p.y - 4); c.quadraticCurveTo(p.x + p.w / 2, p.y + 3, p.x + p.w, p.y - 4); c.stroke()
    } else if (p.type === 'ice') {
      // Icy stone - blue tint, reflective
      const iceGrad = c.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      iceGrad.addColorStop(0, '#6A8AAA')
      iceGrad.addColorStop(1, '#4A6A8A')
      c.fillStyle = iceGrad
      c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 3); c.fill()
      // Ice shine
      c.fillStyle = 'rgba(200, 220, 255, 0.25)'
      c.fillRect(p.x + 3, p.y, p.w * 0.6, 2)
      // Slippery indicator
      c.fillStyle = 'rgba(150, 200, 255, 0.1)'
      c.fillRect(p.x, p.y, p.w, p.h)
    } else if (p.type === 'altar') {
      // Stone altar with fire glow
      const altGrad = c.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      altGrad.addColorStop(0, '#4A3A2A'); altGrad.addColorStop(1, '#2A1A0A')
      c.fillStyle = altGrad; c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 3); c.fill()
      // Fire glow on top
      const fireGlow = c.createRadialGradient(p.x + p.w / 2, p.y - 5, 0, p.x + p.w / 2, p.y - 5, p.w * 0.4)
      fireGlow.addColorStop(0, 'rgba(200, 80, 20, 0.12)'); fireGlow.addColorStop(1, 'transparent')
      c.fillStyle = fireGlow; c.fillRect(p.x - 10, p.y - 20, p.w + 20, 25)
      // Rune carvings
      c.fillStyle = 'rgba(200, 80, 20, 0.2)'
      for (let rx = p.x + 12; rx < p.x + p.w - 12; rx += 20) {
        c.fillRect(rx, p.y + 4, 3, p.h - 8)
        c.fillRect(rx - 2, p.y + p.h / 2, 7, 2)
      }
    } else if (p.type === 'ember') {
      // Glowing hot coal platform
      c.fillStyle = '#2A1008'; c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 4); c.fill()
      // Pulsing ember glow
      const embPulse = 0.15 + Math.sin(time.value * 3 + p.x * 0.05) * 0.08
      const embGlow = c.createRadialGradient(p.x + p.w / 2, p.y + p.h / 2, 0, p.x + p.w / 2, p.y + p.h / 2, p.w * 0.6)
      embGlow.addColorStop(0, `rgba(255, 100, 20, ${embPulse})`); embGlow.addColorStop(1, 'transparent')
      c.fillStyle = embGlow; c.fillRect(p.x - 15, p.y - 10, p.w + 30, p.h + 20)
      // Hot cracks
      c.strokeStyle = `rgba(255, 140, 30, ${embPulse * 2})`; c.lineWidth = 0.8
      for (let cx2 = p.x + 8; cx2 < p.x + p.w - 8; cx2 += 15) {
        c.beginPath(); c.moveTo(cx2, p.y + 3); c.lineTo(cx2 + 5, p.y + p.h - 3); c.stroke()
      }
    } else if (p.type === 'torch') {
      // Tall torch pillar
      c.fillStyle = '#3A2A1A'; c.fillRect(p.x + p.w / 2 - 6, p.y, 12, p.h)
      // Fire on top
      const flicker = Math.sin(time.value * 8 + p.x) * 3
      c.fillStyle = '#FF6600'; c.beginPath(); c.arc(p.x + p.w / 2, p.y - 5 + flicker, 8, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FFAA22'; c.beginPath(); c.arc(p.x + p.w / 2, p.y - 7 + flicker, 5, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FFDD66'; c.beginPath(); c.arc(p.x + p.w / 2, p.y - 9 + flicker, 2.5, 0, Math.PI * 2); c.fill()
      // Light pool
      const torchLight = c.createRadialGradient(p.x + p.w / 2, p.y - 5, 0, p.x + p.w / 2, p.y - 5, 40)
      torchLight.addColorStop(0, 'rgba(255, 150, 50, 0.1)'); torchLight.addColorStop(1, 'transparent')
      c.fillStyle = torchLight; c.fillRect(p.x - 30, p.y - 40, p.w + 60, 50)
    } else if (p.type === 'bone') {
      // Bone/skeleton platform
      c.fillStyle = '#8A8070'; c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 2); c.fill()
      c.fillStyle = '#9A9080'; c.fillRect(p.x + 2, p.y, p.w - 4, 2)
      // Bone texture (knobs)
      c.fillStyle = '#AAA090'
      for (let bx = p.x + 6; bx < p.x + p.w - 6; bx += 10) {
        c.beginPath(); c.arc(bx, p.y + p.h / 2, 3, 0, Math.PI * 2); c.fill()
      }
    } else if (p.type === 'boat') {
      // Rendered separately in LEVEL 5 BOAT RENDERING section
    } else if (p.type === 'mud') {
      // Level 1 mud
      const mudGrad = c.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      mudGrad.addColorStop(0, '#3A2A1A'); mudGrad.addColorStop(1, '#2A1A0A')
      c.fillStyle = mudGrad; c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 4); c.fill()
      c.fillStyle = '#4A3A2A'
      for (let mx = p.x + 8; mx < p.x + p.w - 8; mx += 15) { c.beginPath(); c.arc(mx, p.y + 3, 2, 0, Math.PI * 2); c.fill() }
    } else if (p.type === 'wood') {
      c.fillStyle = '#4A3520'; c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 3); c.fill()
      c.fillStyle = '#5A4530'; c.fillRect(p.x + 2, p.y + 1, p.w - 4, 3)
      c.strokeStyle = '#3A2510'; c.lineWidth = 0.5
      for (let lx = p.x + 10; lx < p.x + p.w - 10; lx += 20) { c.beginPath(); c.moveTo(lx, p.y + 4); c.lineTo(lx + 5, p.y + p.h - 2); c.stroke() }
    } else if (p.type === 'stone') {
      const stoneGrad = c.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      stoneGrad.addColorStop(0, '#4A4A4A'); stoneGrad.addColorStop(1, '#3A3A3A')
      c.fillStyle = stoneGrad; c.beginPath(); c.roundRect(p.x, p.y, p.w, p.h, 2); c.fill()
      c.fillStyle = '#5A5A5A'; c.fillRect(p.x + 1, p.y, p.w - 2, 2)
    }
  }

  // === ITEMS (bobbing) ===
  for (const item of items) {
    if (item.collected) continue
    if (item.x < cameraX - 30 || item.x > cameraX + W + 30) continue
    const bob = Math.sin(time.value * 3 + item.x * 0.01) * 3
    const iy = item.y + bob

    if (item.type === 'ol') {
      // Beer can with glow
      c.fillStyle = '#D4D4D4'; c.beginPath(); c.roundRect(item.x - 7, iy - 10, 14, 20, 3); c.fill()
      c.fillStyle = '#1A4A1A'; c.fillRect(item.x - 6, iy - 6, 12, 8)
      c.fillStyle = '#F5A623'; c.fillRect(item.x - 5, iy - 1, 10, 3)
      // Glow
      const glowGrad = c.createRadialGradient(item.x, iy, 0, item.x, iy, 16)
      glowGrad.addColorStop(0, 'rgba(245, 166, 35, 0.15)')
      glowGrad.addColorStop(1, 'rgba(245, 166, 35, 0)')
      c.fillStyle = glowGrad; c.fillRect(item.x - 16, iy - 16, 32, 32)
    } else if (item.type === 'jim_token') {
      // Jim's bald head
      c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(item.x, iy, 10, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#9E3030'; c.lineWidth = 0.8
      c.beginPath(); c.moveTo(item.x - 6, iy - 3); c.quadraticCurveTo(item.x, iy - 10, item.x + 6, iy - 3); c.stroke()
      c.fillStyle = '#6AACDB'; c.beginPath(); c.arc(item.x - 3, iy - 1, 1.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(item.x + 3, iy - 1, 1.2, 0, Math.PI * 2); c.fill()
      // Pink glow
      const jGlow = c.createRadialGradient(item.x, iy, 0, item.x, iy, 18)
      jGlow.addColorStop(0, 'rgba(232, 67, 147, 0.12)'); jGlow.addColorStop(1, 'transparent')
      c.fillStyle = jGlow; c.fillRect(item.x - 18, iy - 18, 36, 36)
    } else if (item.type === 'dalmatiner') {
      c.fillStyle = '#FFF'; c.beginPath(); c.arc(item.x, iy, 10, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(item.x, iy - 5, 7, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#1A1A1A'
      c.beginPath(); c.arc(item.x - 4, iy - 1, 2.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(item.x + 4, iy + 2, 2, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#2A2A2A'
      c.beginPath(); c.arc(item.x - 5, iy - 8, 3, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(item.x + 5, iy - 8, 3, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#1A1A1A'; c.beginPath(); c.arc(item.x, iy - 6, 1.5, 0, Math.PI * 2); c.fill()
    } else if (item.type === 'powerup_big') {
      c.fillStyle = '#D4A574'; c.beginPath(); c.roundRect(item.x - 7, iy + 1, 14, 8, 2); c.fill()
      c.fillStyle = '#FF2222'; c.beginPath(); c.arc(item.x, iy - 3, 9, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FFF'; c.beginPath(); c.arc(item.x - 3, iy - 5, 2.5, 0, Math.PI * 2); c.fill()
    }
  }

  // === ENEMIES ===
  for (const e of enemies) {
    if (!e.alive) continue
    if (e.x < cameraX - 60 || e.x > cameraX + W + 60) continue

    if (e.type === 'guard') {
      // MOSE-DRAUGER: algegrøn vandlig krop
      const sink = Math.sin(time.value * 2 + e.x * 0.01) * 1.5
      // Drip
      if (Math.random() < 0.05) {
        particles.push({ x: e.x + 12, y: e.y + 22, vx: (Math.random() - 0.5) * 5, vy: 30, life: 0.8, maxLife: 0.8, size: 1.5, color: '#3A5A3A' })
      }
      // Body
      c.fillStyle = '#3A5A3A'; c.beginPath(); c.roundRect(e.x + 3, e.y + 12 + sink, 19, 23, 2); c.fill()
      // Algae streaks
      c.fillStyle = '#2A4A2A'; c.fillRect(e.x + 5, e.y + 14 + sink, 2, 18)
      c.fillRect(e.x + 12, e.y + 16 + sink, 1.5, 14)
      c.fillRect(e.x + 18, e.y + 13 + sink, 1.5, 16)
      // Wet face
      c.fillStyle = '#5A7A5A'; c.beginPath(); c.arc(e.x + 12, e.y + 8 + sink, 8, 0, Math.PI * 2); c.fill()
      // Mose-tang on top of head
      c.fillStyle = '#1A3A1A'
      c.beginPath(); c.moveTo(e.x + 4, e.y + 4 + sink); c.lineTo(e.x + 8, e.y - 2 + sink); c.lineTo(e.x + 12, e.y + 4 + sink); c.lineTo(e.x + 16, e.y - 1 + sink); c.lineTo(e.x + 20, e.y + 4 + sink); c.fill()
      // Glowing yellow eyes (drowned)
      c.fillStyle = '#CCFF44'; c.beginPath(); c.arc(e.x + 9, e.y + 7 + sink, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 7 + sink, 1.5, 0, Math.PI * 2); c.fill()
      // Rusty bog spear
      c.strokeStyle = '#6A5A3A'; c.lineWidth = 2; c.beginPath()
      c.moveTo(e.x + (e.dir > 0 ? 20 : 4), e.y + 10 + sink)
      c.lineTo(e.x + (e.dir > 0 ? 30 : -6), e.y + 2 + sink); c.stroke()
    } else if (e.type === 'wolf') {
      // FENRIS-HVALP: lille ulv med dalmatinermønster (Jim-Lyngvild ref)
      c.fillStyle = '#F8F4EC'
      c.beginPath(); c.ellipse(e.x + 15, e.y + 14, 15, 10, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 28 : 2), e.y + 8, 7, 0, Math.PI * 2); c.fill()
      // Dalmatian spots (Jim's signature)
      c.fillStyle = '#1A1A1A'
      c.beginPath(); c.arc(e.x + 8, e.y + 12, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 18, e.y + 16, 1.6, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 12, e.y + 18, 1.4, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 22, e.y + 12, 1.8, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 27 : 3), e.y + 11, 1.2, 0, Math.PI * 2); c.fill()
      // Cold blue eyes
      c.fillStyle = '#6AACDB'
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 30 : 4), e.y + 6, 2, 0, Math.PI * 2); c.fill()
      // Ears
      c.fillStyle = '#F8F4EC'
      c.beginPath(); c.moveTo(e.x + (e.dir > 0 ? 26 : 4), e.y + 2)
      c.lineTo(e.x + (e.dir > 0 ? 30 : 0), e.y - 2); c.lineTo(e.x + (e.dir > 0 ? 30 : 0), e.y + 4); c.fill()
      // Legs
      c.strokeStyle = '#F8F4EC'; c.lineWidth = 3
      const legOff = Math.sin(time.value * 8) * 3
      c.beginPath(); c.moveTo(e.x + 8, e.y + 22); c.lineTo(e.x + 8, e.y + 25 + legOff); c.stroke()
      c.beginPath(); c.moveTo(e.x + 22, e.y + 22); c.lineTo(e.x + 22, e.y + 25 - legOff); c.stroke()
    } else if (e.type === 'boss') {
      // BØDDELEN - large intimidating figure
      const bossShake = e.phase >= 2 ? Math.sin(time.value * 20) * 2 : 0

      // Red glow in later phases
      if (e.phase >= 2) {
        const bGlow = c.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 0, e.x + e.w / 2, e.y + e.h / 2, 60)
        bGlow.addColorStop(0, 'rgba(139, 32, 32, 0.15)'); bGlow.addColorStop(1, 'transparent')
        c.fillStyle = bGlow; c.fillRect(e.x - 40, e.y - 40, e.w + 80, e.h + 80)
      }

      // Body
      c.fillStyle = '#2A1A0A'; c.beginPath(); c.roundRect(e.x + 5 + bossShake, e.y + 20, 35, 40, 4); c.fill()
      // Head
      c.fillStyle = '#5A4030'; c.beginPath(); c.arc(e.x + 22 + bossShake, e.y + 14, 14, 0, Math.PI * 2); c.fill()
      // Executioner hood
      c.fillStyle = '#1A0A00'; c.beginPath(); c.roundRect(e.x + 8 + bossShake, e.y + 2, 28, 16, 4); c.fill()
      // Eye slits (red)
      c.fillStyle = '#CC2020'
      c.fillRect(e.x + 14 + bossShake, e.y + 10, 5, 2)
      c.fillRect(e.x + 24 + bossShake, e.y + 10, 5, 2)
      // GIANT AXE
      c.strokeStyle = '#555'; c.lineWidth = 4
      c.beginPath(); c.moveTo(e.x + 40 + bossShake, e.y + 15)
      c.lineTo(e.x + 55 + bossShake, e.y - 5); c.stroke()
      // Axe head
      c.fillStyle = '#777'
      c.beginPath()
      c.moveTo(e.x + 52 + bossShake, e.y - 8)
      c.lineTo(e.x + 65 + bossShake, e.y - 15)
      c.lineTo(e.x + 60 + bossShake, e.y + 5)
      c.closePath(); c.fill()
      // Porsche emblem engraved on axe head (subtle Easter egg)
      c.save()
      c.translate(e.x + 58 + bossShake, e.y - 5)
      c.fillStyle = '#3A2A1A'
      c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#444'; c.lineWidth = 0.4
      c.beginPath(); c.moveTo(-2, 0); c.lineTo(2, 0); c.moveTo(0, -2); c.lineTo(0, 2); c.stroke()
      c.restore()

      // Projectile (thrown axe)
      if (e.projectileActive) {
        c.save()
        c.translate(e.projectileX, e.projectileY)
        c.rotate(time.value * 10)
        c.fillStyle = '#777'
        c.beginPath(); c.moveTo(0, -10); c.lineTo(12, -5); c.lineTo(8, 8); c.lineTo(-4, 4); c.closePath(); c.fill()
        c.strokeStyle = '#555'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(-8, 10); c.stroke()
        c.restore()
      }

      // HP BAR (top of screen, drawn later in HUD)
    } else if (e.type === 'shadow') {
      // Shadow hunter - dark, fast, glowing eyes
      c.globalAlpha = 0.7
      c.fillStyle = '#1A1A2A'; c.beginPath(); c.roundRect(e.x + 2, e.y + 8, 20, 22, 3); c.fill()
      c.fillStyle = '#2A2A3A'; c.beginPath(); c.arc(e.x + 12, e.y + 5, 7, 0, Math.PI * 2); c.fill()
      // Hood
      c.fillStyle = '#0A0A1A'; c.beginPath(); c.roundRect(e.x + 4, e.y - 1, 16, 8, 3); c.fill()
      // Glowing green eyes
      c.fillStyle = '#44FF44'
      c.beginPath(); c.arc(e.x + 9, e.y + 4, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 4, 1.5, 0, Math.PI * 2); c.fill()
      c.globalAlpha = 1
    } else if (e.type === 'raven') {
      // HUGINN-KRAGE: sort/sølv krage med røde Celtic-tegn på vingerne (Jim-tattoo ref)
      const flapY = Math.sin(time.value * 10) * 3
      c.fillStyle = '#1A1A1A'
      c.beginPath(); c.ellipse(e.x + 10, e.y + 8 + flapY, 10, 5, 0, 0, Math.PI * 2); c.fill()
      // Silver streak on body
      c.fillStyle = '#999'
      c.fillRect(e.x + 6, e.y + 9 + flapY, 8, 1)
      // Wings
      const wingAngle = Math.sin(time.value * 12) * 0.5
      c.save(); c.translate(e.x + 10, e.y + 6 + flapY); c.rotate(wingAngle)
      c.fillStyle = '#222'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-14, -6); c.lineTo(-4, 2); c.fill()
      // Red celtic rune on left wing (Jim tattoo style)
      c.strokeStyle = '#9E3030'; c.lineWidth = 0.7
      c.beginPath(); c.moveTo(-10, -3); c.lineTo(-6, -1); c.moveTo(-8, -4); c.lineTo(-7, -2); c.stroke()
      c.restore()
      c.save(); c.translate(e.x + 10, e.y + 6 + flapY); c.rotate(-wingAngle)
      c.fillStyle = '#222'; c.beginPath(); c.moveTo(0, 0); c.lineTo(14, -6); c.lineTo(4, 2); c.fill()
      // Red celtic rune on right wing
      c.strokeStyle = '#9E3030'; c.lineWidth = 0.7
      c.beginPath(); c.moveTo(10, -3); c.lineTo(6, -1); c.moveTo(8, -4); c.lineTo(7, -2); c.stroke()
      c.restore()
      // Beak
      c.fillStyle = '#8B6914'
      c.beginPath(); c.moveTo(e.x + (e.dir > 0 ? 20 : 0), e.y + 8 + flapY)
      c.lineTo(e.x + (e.dir > 0 ? 24 : -4), e.y + 9 + flapY); c.lineTo(e.x + (e.dir > 0 ? 20 : 0), e.y + 10 + flapY); c.fill()
      // Glowing red eye
      c.fillStyle = '#FF3333'; c.beginPath(); c.arc(e.x + (e.dir > 0 ? 16 : 4), e.y + 6 + flapY, 1.2, 0, Math.PI * 2); c.fill()
    } else if (e.type === 'spider') {
      // Spider - dark, creepy
      c.fillStyle = '#2A2A1A'; c.beginPath(); c.ellipse(e.x + 14, e.y + 12, 12, 8, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#3A3A2A'; c.beginPath(); c.arc(e.x + 6, e.y + 8, 6, 0, Math.PI * 2); c.fill()
      // Eyes (8 red dots)
      for (let ei = 0; ei < 4; ei++) {
        c.fillStyle = '#CC3333'; c.beginPath(); c.arc(e.x + 3 + ei * 2, e.y + 6, 0.8, 0, Math.PI * 2); c.fill()
      }
      // Legs
      c.strokeStyle = '#2A2A1A'; c.lineWidth = 1.5
      for (let li = 0; li < 4; li++) {
        const legA = (li / 4) * Math.PI - 0.3 + Math.sin(time.value * 6 + li) * 0.2
        c.beginPath(); c.moveTo(e.x + 14, e.y + 12)
        c.lineTo(e.x + 14 + Math.cos(legA) * 16, e.y + 12 + Math.sin(legA) * 12); c.stroke()
        c.beginPath(); c.moveTo(e.x + 14, e.y + 12)
        c.lineTo(e.x + 14 - Math.cos(legA) * 16, e.y + 12 + Math.sin(legA) * 12); c.stroke()
      }
    } else if (e.type === 'boss_deer') {
      // HJORTEMANDEN - elegant, antlered, fast
      const deerShake = e.phase >= 2 ? Math.sin(time.value * 15) * 1.5 : 0

      // Green-tinted glow
      if (e.phase >= 2) {
        const dGlow = c.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 0, e.x + e.w / 2, e.y + e.h / 2, 50)
        dGlow.addColorStop(0, 'rgba(30, 80, 30, 0.15)'); dGlow.addColorStop(1, 'transparent')
        c.fillStyle = dGlow; c.fillRect(e.x - 30, e.y - 30, e.w + 60, e.h + 60)
      }

      // Body (lean, tall)
      c.fillStyle = '#3A2A1A'; c.beginPath(); c.roundRect(e.x + 5 + deerShake, e.y + 16, 25, 34, 3); c.fill()
      // Head
      c.fillStyle = '#5A4030'; c.beginPath(); c.arc(e.x + 17 + deerShake, e.y + 10, 10, 0, Math.PI * 2); c.fill()
      // Antlers (massive, branching)
      c.strokeStyle = '#8B7355'; c.lineWidth = 2.5
      // Left antler
      c.beginPath(); c.moveTo(e.x + 10 + deerShake, e.y + 5)
      c.lineTo(e.x - 5 + deerShake, e.y - 15); c.stroke()
      c.beginPath(); c.moveTo(e.x - 2 + deerShake, e.y - 10)
      c.lineTo(e.x - 12 + deerShake, e.y - 20); c.stroke()
      c.beginPath(); c.moveTo(e.x - 5 + deerShake, e.y - 15)
      c.lineTo(e.x - 15 + deerShake, e.y - 12); c.stroke()
      // Right antler
      c.beginPath(); c.moveTo(e.x + 24 + deerShake, e.y + 5)
      c.lineTo(e.x + 39 + deerShake, e.y - 15); c.stroke()
      c.beginPath(); c.moveTo(e.x + 36 + deerShake, e.y - 10)
      c.lineTo(e.x + 46 + deerShake, e.y - 20); c.stroke()
      c.beginPath(); c.moveTo(e.x + 39 + deerShake, e.y - 15)
      c.lineTo(e.x + 49 + deerShake, e.y - 12); c.stroke()
      // RED RUNES carved into antlers (Jim-tattoo style, pulsing)
      const runeGlow = 0.6 + Math.sin(time.value * 3) * 0.4
      c.fillStyle = `rgba(200, 40, 40, ${runeGlow})`
      c.beginPath(); c.arc(e.x - 5 + deerShake, e.y - 10, 1.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x - 12 + deerShake, e.y - 18, 1.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 40 + deerShake, e.y - 18, 1.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 47 + deerShake, e.y - 12, 1.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x - 2 + deerShake, e.y - 6, 1, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 36 + deerShake, e.y - 8, 1, 0, Math.PI * 2); c.fill()
      // Tiny rune lines between dots
      c.strokeStyle = `rgba(200, 40, 40, ${runeGlow * 0.6})`; c.lineWidth = 0.7
      c.beginPath(); c.moveTo(e.x - 5 + deerShake, e.y - 10); c.lineTo(e.x - 12 + deerShake, e.y - 18); c.stroke()
      c.beginPath(); c.moveTo(e.x + 40 + deerShake, e.y - 18); c.lineTo(e.x + 47 + deerShake, e.y - 12); c.stroke()
      // Eyes (glowing green)
      c.fillStyle = '#44AA44'
      c.beginPath(); c.arc(e.x + 13 + deerShake, e.y + 8, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 21 + deerShake, e.y + 8, 2, 0, Math.PI * 2); c.fill()
      // Legs (thin, elegant)
      c.strokeStyle = '#3A2A1A'; c.lineWidth = 3
      const deerLeg = Math.sin(time.value * 6) * 3
      c.beginPath(); c.moveTo(e.x + 10 + deerShake, e.y + 48); c.lineTo(e.x + 8 + deerShake, e.y + 50 + deerLeg); c.stroke()
      c.beginPath(); c.moveTo(e.x + 25 + deerShake, e.y + 48); c.lineTo(e.x + 27 + deerShake, e.y + 50 - deerLeg); c.stroke()

      // HP BAR (drawn in HUD section)
    } else if (e.type === 'skeleton') {
      // EINHERJER-SKELET - faldne kriger med viking-hjelm + lille rundt skjold m. Porsche-emblem
      c.fillStyle = '#6A6A5A'; c.beginPath(); c.roundRect(e.x + 3, e.y + 10, 19, 25, 2); c.fill()
      c.fillStyle = '#8A8A7A'; c.beginPath(); c.arc(e.x + 12, e.y + 6, 8, 0, Math.PI * 2); c.fill()
      // Viking helmet (small horns)
      c.fillStyle = '#5A5040'
      c.beginPath(); c.roundRect(e.x + 4, e.y - 1, 16, 7, 3); c.fill()
      c.beginPath(); c.moveTo(e.x + 4, e.y); c.lineTo(e.x + 1, e.y - 5); c.lineTo(e.x + 6, e.y - 1); c.fill()
      c.beginPath(); c.moveTo(e.x + 20, e.y); c.lineTo(e.x + 23, e.y - 5); c.lineTo(e.x + 18, e.y - 1); c.fill()
      // Empty eye sockets
      c.fillStyle = '#2A0A0A'
      c.beginPath(); c.arc(e.x + 9, e.y + 5, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 5, 2, 0, Math.PI * 2); c.fill()
      // Round shield with PORSCHE emblem (subtle Easter egg)
      const shX = e.x + (e.dir > 0 ? -2 : 24)
      c.fillStyle = '#5A4A3A'; c.beginPath(); c.arc(shX, e.y + 18, 6, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#8A7060'; c.lineWidth = 0.6; c.beginPath(); c.arc(shX, e.y + 18, 6, 0, Math.PI * 2); c.stroke()
      // Porsche-style crest in middle (gold + cross)
      c.fillStyle = '#D4A574'; c.beginPath(); c.arc(shX, e.y + 18, 2.2, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#3A2A1A'; c.lineWidth = 0.5
      c.beginPath(); c.moveTo(shX - 2, e.y + 18); c.lineTo(shX + 2, e.y + 18); c.moveTo(shX, e.y + 16); c.lineTo(shX, e.y + 20); c.stroke()
      // Rusty sword
      c.strokeStyle = '#8A7060'; c.lineWidth = 2
      c.beginPath(); c.moveTo(e.x + (e.dir > 0 ? 20 : 4), e.y + 12)
      c.lineTo(e.x + (e.dir > 0 ? 35 : -11), e.y + 5); c.stroke()
    } else if (e.type === 'spear') {
      // Stationary spear thrower
      c.fillStyle = '#5A4A3A'; c.beginPath(); c.roundRect(e.x + 4, e.y + 8, 17, 27, 2); c.fill()
      c.fillStyle = '#6A5A4A'; c.beginPath(); c.arc(e.x + 12, e.y + 5, 7, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#3A2A1A'; c.fillRect(e.x + 5, e.y, 14, 6)
      // Spear
      c.strokeStyle = '#888'; c.lineWidth = 2
      c.beginPath(); c.moveTo(e.x + 12, e.y + 10); c.lineTo(e.x + 30, e.y + 5); c.stroke()
      c.fillStyle = '#AAA'; c.beginPath()
      c.moveTo(e.x + 30, e.y + 2); c.lineTo(e.x + 36, e.y + 5); c.lineTo(e.x + 30, e.y + 8); c.fill()
    } else if (e.type === 'berserker_ghost') {
      // Ghostly berserker - semi-transparent, red glow
      c.globalAlpha = 0.6
      c.fillStyle = '#4A2020'; c.beginPath(); c.roundRect(e.x + 2, e.y + 10, 21, 25, 3); c.fill()
      c.fillStyle = '#6A3030'; c.beginPath(); c.arc(e.x + 12, e.y + 6, 8, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FF4444'
      c.beginPath(); c.arc(e.x + 9, e.y + 5, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 5, 1.5, 0, Math.PI * 2); c.fill()
      const ghostGlow = c.createRadialGradient(e.x + 12, e.y + 15, 0, e.x + 12, e.y + 15, 25)
      ghostGlow.addColorStop(0, 'rgba(255, 50, 50, 0.15)'); ghostGlow.addColorStop(1, 'transparent')
      c.fillStyle = ghostGlow; c.fillRect(e.x - 15, e.y - 15, 50, 60)
      c.globalAlpha = 1
    } else if (e.type === 'boss_berserker') {
      // DEN FALDNE BERSÆRK - massive, wild, storm-powered
      const bShake = e.phase >= 2 ? Math.sin(time.value * 18) * 3 : 0

      // Storm glow
      const stormGlow = c.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 0, e.x + e.w / 2, e.y + e.h / 2, 70)
      stormGlow.addColorStop(0, `rgba(100, 150, 255, ${0.1 + e.phase * 0.05})`); stormGlow.addColorStop(1, 'transparent')
      c.fillStyle = stormGlow; c.fillRect(e.x - 50, e.y - 50, e.w + 100, e.h + 100)

      // Massive body
      c.fillStyle = '#3A2020'; c.beginPath(); c.roundRect(e.x + 5 + bShake, e.y + 18, 40, 42, 4); c.fill()
      // DALMATIAN PATTERN on armor (Jim-Lyngvild ref — white bone fragments on dark armor)
      c.fillStyle = '#F0E8DC'
      c.beginPath(); c.arc(e.x + 12 + bShake, e.y + 24, 2.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 22 + bShake, e.y + 30, 1.8, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 32 + bShake, e.y + 26, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 16 + bShake, e.y + 38, 1.6, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 28 + bShake, e.y + 42, 2.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 38 + bShake, e.y + 36, 1.8, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 20 + bShake, e.y + 50, 1.4, 0, Math.PI * 2); c.fill()
      // Fur cloak
      c.fillStyle = '#4A3020'
      c.beginPath(); c.moveTo(e.x + bShake, e.y + 20); c.lineTo(e.x + 5 + bShake, e.y + 58)
      c.lineTo(e.x + 45 + bShake, e.y + 58); c.lineTo(e.x + 50 + bShake, e.y + 20); c.fill()
      // Head
      c.fillStyle = '#5A3A2A'; c.beginPath(); c.arc(e.x + 25 + bShake, e.y + 12, 14, 0, Math.PI * 2); c.fill()
      // Wild hair/helm
      c.fillStyle = '#2A1A0A'
      c.beginPath(); c.moveTo(e.x + 11 + bShake, e.y + 5); c.lineTo(e.x + 8 + bShake, e.y - 8)
      c.lineTo(e.x + 20 + bShake, e.y); c.fill()
      c.beginPath(); c.moveTo(e.x + 39 + bShake, e.y + 5); c.lineTo(e.x + 42 + bShake, e.y - 8)
      c.lineTo(e.x + 30 + bShake, e.y); c.fill()
      // Glowing red eyes
      c.fillStyle = '#FF2222'
      c.beginPath(); c.arc(e.x + 20 + bShake, e.y + 10, 2.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 30 + bShake, e.y + 10, 2.5, 0, Math.PI * 2); c.fill()
      // Dual axes
      c.strokeStyle = '#777'; c.lineWidth = 3
      c.beginPath(); c.moveTo(e.x + 48 + bShake, e.y + 15); c.lineTo(e.x + 62 + bShake, e.y); c.stroke()
      c.beginPath(); c.moveTo(e.x + 2 + bShake, e.y + 15); c.lineTo(e.x - 12 + bShake, e.y); c.stroke()
      // Axe heads
      c.fillStyle = '#888'
      c.beginPath(); c.moveTo(e.x + 60 + bShake, e.y - 4); c.lineTo(e.x + 68 + bShake, e.y - 8)
      c.lineTo(e.x + 64 + bShake, e.y + 6); c.closePath(); c.fill()
      c.beginPath(); c.moveTo(e.x - 10 + bShake, e.y - 4); c.lineTo(e.x - 18 + bShake, e.y - 8)
      c.lineTo(e.x - 14 + bShake, e.y + 6); c.closePath(); c.fill()

      if (e.projectileActive) {
        c.save(); c.translate(e.projectileX, e.projectileY); c.rotate(time.value * 12)
        c.fillStyle = '#888'; c.beginPath(); c.moveTo(0, -12); c.lineTo(14, -6); c.lineTo(10, 10); c.lineTo(-4, 5); c.closePath(); c.fill()
        c.restore()
      }
    }
  }

  // === LEVEL 4 ENEMIES ===
  // (fire_priest, mask_warrior, fire_wolf rendered inline in enemy loop already via fallback)
  // Add boss_fire rendering here
  for (const e of enemies) {
    if (!e.alive || e.x < cameraX - 80 || e.x > cameraX + W + 80) continue
    if (e.type === 'fire_priest') {
      // Hooded priest with fire staff
      c.fillStyle = '#3A1A0A'; c.beginPath(); c.roundRect(e.x + 2, e.y + 8, 21, 27, 3); c.fill()
      c.fillStyle = '#5A3020'; c.beginPath(); c.arc(e.x + 12, e.y + 5, 8, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#1A0A00'; c.beginPath(); c.roundRect(e.x + 3, e.y - 2, 18, 10, 4); c.fill() // Hood
      c.fillStyle = '#FF6600'; c.beginPath(); c.arc(e.x + 9, e.y + 4, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 4, 1.5, 0, Math.PI * 2); c.fill() // Glowing eyes
      // Fire staff
      c.strokeStyle = '#5A3A1A'; c.lineWidth = 2
      c.beginPath(); c.moveTo(e.x + 22, e.y + 10); c.lineTo(e.x + 28, e.y - 5); c.stroke()
      const fl = Math.sin(time.value * 6 + e.x) * 2
      c.fillStyle = '#FF4400'; c.beginPath(); c.arc(e.x + 28, e.y - 8 + fl, 5, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FFAA00'; c.beginPath(); c.arc(e.x + 28, e.y - 10 + fl, 3, 0, Math.PI * 2); c.fill()
    } else if (e.type === 'mask_warrior') {
      // Masked cult warrior
      c.fillStyle = '#4A2A1A'; c.beginPath(); c.roundRect(e.x + 3, e.y + 10, 19, 25, 2); c.fill()
      c.fillStyle = '#6A4A30'; c.beginPath(); c.arc(e.x + 12, e.y + 6, 8, 0, Math.PI * 2); c.fill()
      // Ritual mask
      c.fillStyle = '#8B2020'; c.beginPath(); c.roundRect(e.x + 4, e.y, 16, 12, 3); c.fill()
      c.fillStyle = '#1A0A00'; c.fillRect(e.x + 7, e.y + 3, 4, 3) // Eye holes
      c.fillRect(e.x + 13, e.y + 3, 4, 3)
      c.fillStyle = '#FF6600'; c.beginPath(); c.arc(e.x + 9, e.y + 4, 1, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 4, 1, 0, Math.PI * 2); c.fill()
    } else if (e.type === 'fire_wolf') {
      // ILD-ULV - brændende ulv med SKALDET hoved + Celtic-tattoo (Jim-Lyngvild ulven)
      c.fillStyle = '#3A2010'
      c.beginPath(); c.ellipse(e.x + 15, e.y + 14, 15, 10, 0, 0, Math.PI * 2); c.fill()
      // Bald head (pink/tan, no fur) — Jim's shaved head on a wolf body
      c.fillStyle = '#C08060'
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 28 : 2), e.y + 8, 7, 0, Math.PI * 2); c.fill()
      // Head shine highlight (bald)
      c.fillStyle = '#E0A080'
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 26 : 4), e.y + 5, 2.5, 0, Math.PI * 2); c.fill()
      // Celtic tattoo on bald forehead (Jim's signature)
      c.strokeStyle = '#9E3030'; c.lineWidth = 0.8
      const tx = e.x + (e.dir > 0 ? 28 : 2)
      c.beginPath(); c.moveTo(tx - 3, e.y + 3); c.quadraticCurveTo(tx, e.y - 1, tx + 3, e.y + 3); c.stroke()
      c.fillStyle = '#9E3030'; c.beginPath(); c.arc(tx, e.y + 1, 0.7, 0, Math.PI * 2); c.fill()
      // Glowing orange eyes
      c.fillStyle = '#FF4400'; c.beginPath(); c.arc(e.x + (e.dir > 0 ? 30 : 4), e.y + 6, 2, 0, Math.PI * 2); c.fill()
      // Fire aura
      const wolfGlow = c.createRadialGradient(e.x + 15, e.y + 10, 0, e.x + 15, e.y + 10, 20)
      wolfGlow.addColorStop(0, 'rgba(255, 100, 0, 0.15)'); wolfGlow.addColorStop(1, 'transparent')
      c.fillStyle = wolfGlow; c.fillRect(e.x - 10, e.y - 10, 50, 40)
    } else if (e.type === 'boss_fire') {
      // SINMARA - Blótmoderen, fire priestess
      const fShake = e.phase >= 2 ? Math.sin(time.value * 12) * 2 : 0
      // Fire aura (intense)
      const fAura = c.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 0, e.x + e.w / 2, e.y + e.h / 2, 80)
      fAura.addColorStop(0, `rgba(255, 80, 0, ${0.12 + e.phase * 0.04})`); fAura.addColorStop(1, 'transparent')
      c.fillStyle = fAura; c.fillRect(e.x - 60, e.y - 60, e.w + 120, e.h + 120)
      // Robes (dark red, flowing)
      c.fillStyle = '#5A1010'; c.beginPath()
      c.moveTo(e.x + 5 + fShake, e.y + 15); c.lineTo(e.x - 5 + fShake, e.y + e.h)
      c.lineTo(e.x + e.w + 5 + fShake, e.y + e.h); c.lineTo(e.x + e.w - 5 + fShake, e.y + 15); c.fill()
      // Body
      c.fillStyle = '#3A0808'; c.beginPath(); c.roundRect(e.x + 8 + fShake, e.y + 12, 24, 30, 3); c.fill()
      // Head with crown of fire
      c.fillStyle = '#7A5040'; c.beginPath(); c.arc(e.x + 20 + fShake, e.y + 8, 10, 0, Math.PI * 2); c.fill()
      // Fire crown — 5 horns shaped in a PORSCHE 911 silhouette (stylized)
      // Heights follow a 911-roofline: low-high-peak-high-low
      const crownHeights = [4, 8, 10, 8, 4]
      for (let fc = 0; fc < 5; fc++) {
        const fcX = e.x + 12 + fc * 4 + fShake
        const fcH = crownHeights[fc] + Math.sin(time.value * 8 + fc * 2) * 2
        c.fillStyle = '#FF4400'; c.beginPath(); c.arc(fcX, e.y - fcH, 3, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#FFAA00'; c.beginPath(); c.arc(fcX, e.y - fcH - 2, 1.5, 0, Math.PI * 2); c.fill()
      }
      // Connecting line (roofline silhouette — the Porsche curve)
      c.strokeStyle = 'rgba(255, 100, 0, 0.4)'; c.lineWidth = 1
      c.beginPath()
      c.moveTo(e.x + 12 + fShake, e.y - 4)
      c.quadraticCurveTo(e.x + 20 + fShake, e.y - 14, e.x + 28 + fShake, e.y - 4)
      c.stroke()
      // Glowing red eyes
      c.fillStyle = '#FF2200'
      c.beginPath(); c.arc(e.x + 16 + fShake, e.y + 7, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 24 + fShake, e.y + 7, 2, 0, Math.PI * 2); c.fill()
      // Fire projectile
      if (e.projectileActive) {
        c.save(); c.translate(e.projectileX, e.projectileY)
        const fSize = 8 + Math.sin(time.value * 10) * 3
        c.fillStyle = '#FF4400'; c.beginPath(); c.arc(0, 0, fSize, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#FFAA00'; c.beginPath(); c.arc(0, 0, fSize * 0.6, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#FFDD66'; c.beginPath(); c.arc(0, 0, fSize * 0.3, 0, Math.PI * 2); c.fill()
        c.restore()
      }
    }
  }

  // === LEVEL 5: BOAT (paddle) + ODIN BALL RENDERING (only during gameplay) ===
  if (currentLevel.value === 5 && gameState.value !== 'loading' && gameState.value !== 'cutscene') {
    const bx = boatX // Uses actual paddle position
    const bw = 240 // Bigger boat/paddle
    const by = boatY + boatRock
    // Water shadow
    c.globalAlpha = 0.2; c.fillStyle = '#3A0A10'
    c.beginPath(); c.ellipse(bx + bw / 2, by + 22, bw * 0.6, 6, 0, 0, Math.PI * 2); c.fill()
    c.globalAlpha = 1
    // Hull
    c.fillStyle = '#3A2010'
    c.beginPath()
    c.moveTo(bx - 15, by); c.quadraticCurveTo(bx + bw / 2, by + 25, bx + bw + 15, by)
    c.lineTo(bx + bw + 5, by - 8); c.lineTo(bx - 5, by - 8); c.closePath(); c.fill()
    // Strakes
    c.strokeStyle = '#2A1508'; c.lineWidth = 0.8
    c.beginPath(); c.moveTo(bx - 10, by + 5); c.quadraticCurveTo(bx + bw / 2, by + 18, bx + bw + 10, by + 5); c.stroke()
    // Deck
    c.fillStyle = '#4A3020'; c.fillRect(bx, by - 8, bw, 8)
    c.strokeStyle = '#2A1808'; c.lineWidth = 0.5
    for (let plk = bx + 10; plk < bx + bw - 5; plk += 14) { c.beginPath(); c.moveTo(plk, by - 8); c.lineTo(plk, by); c.stroke() }
    // Dragon prow (right - sailing direction)
    c.fillStyle = '#2A1508'
    c.beginPath()
    c.moveTo(bx + bw + 15, by - 5)
    c.quadraticCurveTo(bx + bw + 30, by - 20, bx + bw + 25, by - 40)
    c.quadraticCurveTo(bx + bw + 35, by - 45, bx + bw + 28, by - 50)
    c.lineTo(bx + bw + 20, by - 35)
    c.quadraticCurveTo(bx + bw + 18, by - 15, bx + bw + 10, by - 5)
    c.fill()
    c.fillStyle = '#CC2020'; c.beginPath(); c.arc(bx + bw + 26, by - 42, 2, 0, Math.PI * 2); c.fill()
    // Stern
    c.fillStyle = '#2A1508'
    c.beginPath(); c.moveTo(bx - 15, by - 5); c.quadraticCurveTo(bx - 25, by - 15, bx - 20, by - 30)
    c.lineTo(bx - 12, by - 20); c.lineTo(bx - 5, by - 8); c.fill()
    // Mast + sail (tall!)
    c.strokeStyle = '#3A2515'; c.lineWidth = 3
    c.beginPath(); c.moveTo(bx + bw / 2, by - 8); c.lineTo(bx + bw / 2, by - 160); c.stroke()
    // Sail - large red/dark cloth
    c.fillStyle = 'rgba(100, 20, 20, 0.5)'
    c.beginPath(); c.moveTo(bx + bw / 2 - 2, by - 155)
    c.quadraticCurveTo(bx + bw / 2 + 50, by - 110, bx + bw / 2 + 55, by - 30)
    c.lineTo(bx + bw / 2 - 2, by - 20); c.fill()
    // Sail detail - horizontal stripes
    c.strokeStyle = 'rgba(60, 10, 10, 0.3)'; c.lineWidth = 1
    for (let sy = by - 140; sy < by - 30; sy += 25) {
      c.beginPath(); c.moveTo(bx + bw / 2, sy); c.lineTo(bx + bw / 2 + 40, sy + 10); c.stroke()
    }
    // Shields
    for (let sh = bx + 10; sh < bx + bw - 10; sh += 22) {
      c.fillStyle = sh % 44 === 10 ? '#6A2020' : '#3A4A6A'
      c.beginPath(); c.arc(sh, by + 3, 5, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#8B7355'; c.beginPath(); c.arc(sh, by + 3, 2, 0, Math.PI * 2); c.fill()
    }
  }

  // === LEVEL 5: ODIN'S HEAD (only during gameplay) ===
  if (currentLevel.value === 5 && gameState.value === 'playing' && jimPrankActive !== 'invisible_ball') {
    // Odin's head - BIG, visible, glowing
    const obx = odinBallX, oby = odinBallY
    const R = 22 // Big ball!
    // Trail
    if (odinBallActive) {
      c.globalAlpha = 0.12; c.fillStyle = '#F5A623'
      c.beginPath(); c.arc(obx - odinBallVx * 0.03, oby - odinBallVy * 0.03, R + 4, 0, Math.PI * 2); c.fill()
      c.globalAlpha = 1
    }
    // Glow
    const oGlow = c.createRadialGradient(obx, oby, 0, obx, oby, R + 20)
    oGlow.addColorStop(0, 'rgba(245, 166, 35, 0.25)'); oGlow.addColorStop(1, 'transparent')
    c.fillStyle = oGlow; c.fillRect(obx - R - 20, oby - R - 20, (R + 20) * 2, (R + 20) * 2)
    // Head/skull
    c.fillStyle = '#E0C8A0'; c.beginPath(); c.arc(obx, oby, R, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#C0A880'; c.lineWidth = 1.5; c.beginPath(); c.arc(obx, oby, R, 0, Math.PI * 2); c.stroke()
    // ONE glowing golden eye (right)
    c.fillStyle = '#F5A623'
    c.beginPath(); c.arc(obx + 7, oby - 3, 5, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#1A1A1A'
    c.beginPath(); c.arc(obx + 7, oby - 3, 2.5, 0, Math.PI * 2); c.fill()
    // Eye glint
    c.fillStyle = '#FFDD88'; c.beginPath(); c.arc(obx + 5, oby - 5, 1.5, 0, Math.PI * 2); c.fill()
    // Eye patch (left)
    c.fillStyle = '#2A1A0A'
    c.beginPath(); c.arc(obx - 7, oby - 3, 6, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#2A1A0A'; c.lineWidth = 2
    c.beginPath(); c.moveTo(obx - 12, oby - 5); c.lineTo(obx - 16, oby - 14); c.stroke()
    c.beginPath(); c.moveTo(obx - 2, oby - 7); c.lineTo(obx + 4, oby - 16); c.stroke()
    // Nose
    c.fillStyle = '#C0A880'
    c.beginPath(); c.moveTo(obx, oby + 3); c.lineTo(obx - 3, oby + 8); c.lineTo(obx + 3, oby + 8); c.fill()
    // Mouth (grim)
    c.strokeStyle = '#8A7060'; c.lineWidth = 1.5
    c.beginPath(); c.moveTo(obx - 6, oby + 11); c.lineTo(obx + 6, oby + 11); c.stroke()
    // Helmet rim
    c.strokeStyle = '#8B7355'; c.lineWidth = 3
    c.beginPath(); c.arc(obx, oby - 5, R, Math.PI * 1.05, Math.PI * 1.95); c.stroke()
    // Subtle Porsche-emblem on side of helmet (gravering, Easter egg)
    c.save()
    c.translate(obx - R * 0.55, oby - 8)
    c.fillStyle = 'rgba(90, 70, 50, 0.5)'
    c.beginPath(); c.arc(0, 0, 2, 0, Math.PI * 2); c.fill()
    c.strokeStyle = 'rgba(201, 168, 76, 0.4)'; c.lineWidth = 0.5
    c.beginPath(); c.moveTo(-1.5, 0); c.lineTo(1.5, 0); c.moveTo(0, -1.5); c.lineTo(0, 1.5); c.stroke()
    c.restore()
    // Horns (big, impressive!)
    c.strokeStyle = '#A89070'; c.lineWidth = 3
    c.beginPath(); c.moveTo(obx - R + 2, oby - 12); c.quadraticCurveTo(obx - R - 14, oby - 35, obx - R - 8, oby - 45); c.stroke()
    c.beginPath(); c.moveTo(obx + R - 2, oby - 12); c.quadraticCurveTo(obx + R + 14, oby - 35, obx + R + 8, oby - 45); c.stroke()
    // Horn tips
    c.fillStyle = '#C9A84C'
    c.beginPath(); c.arc(obx - R - 8, oby - 45, 2.5, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(obx + R + 8, oby - 45, 2.5, 0, Math.PI * 2); c.fill()
    // "SPACE" text when resting
    if (!odinBallActive) {
      c.fillStyle = 'rgba(245, 166, 35, 0.6)'; c.font = 'bold 10px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('SPACE', obx, oby + R + 16)
    }
  }

  // === LEVEL 5: Skull shots ===
  if (currentLevel.value === 5 && gameState.value === 'playing') {
    for (const shot of beerCans) {
      if (!shot.alive) continue
      // Glowing skull projectile
      c.fillStyle = '#F5A623'; c.beginPath(); c.arc(shot.x, shot.y, 6, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FFDD66'; c.beginPath(); c.arc(shot.x, shot.y, 3, 0, Math.PI * 2); c.fill()
      // Trail
      c.globalAlpha = 0.3; c.fillStyle = '#F5A623'
      c.beginPath(); c.arc(shot.x, shot.y + 8, 4, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(shot.x, shot.y + 14, 2, 0, Math.PI * 2); c.fill()
      c.globalAlpha = 1
    }
  }

  // === LEVEL 5: Loke illusions (only during gameplay) ===
  if (currentLevel.value === 5) {
    // Fog obstacles
    for (const ob of fogObstacles) {
      if (ob.passed) continue
      c.globalAlpha = 0.7
      if (ob.type === 'wreck') {
        c.fillStyle = '#3A2010'; c.beginPath(); c.roundRect(ob.x - 15, ob.y - 10, 30, 20, 3); c.fill()
        c.strokeStyle = '#2A1508'; c.lineWidth = 1
        c.beginPath(); c.moveTo(ob.x, ob.y - 10); c.lineTo(ob.x, ob.y - 30); c.stroke()
        c.fillStyle = '#5A1520'; c.beginPath(); c.moveTo(ob.x, ob.y - 30); c.lineTo(ob.x + 12, ob.y - 20); c.lineTo(ob.x, ob.y - 15); c.fill()
      } else if (ob.type === 'hand') {
        c.fillStyle = '#6A5A4A'
        c.beginPath(); c.moveTo(ob.x, ob.y); c.lineTo(ob.x - 4, ob.y - 20); c.lineTo(ob.x - 2, ob.y - 25)
        c.lineTo(ob.x + 2, ob.y - 25); c.lineTo(ob.x + 4, ob.y - 20); c.lineTo(ob.x, ob.y); c.fill()
        c.fillStyle = '#8B2020'; c.beginPath(); c.arc(ob.x, ob.y - 22, 3, 0, Math.PI * 2); c.fill() // glowing fingertip
      } else if (ob.type === 'rock') {
        c.fillStyle = '#4A4A5A'; c.beginPath()
        c.moveTo(ob.x - 12, ob.y + 8); c.lineTo(ob.x - 8, ob.y - 12); c.lineTo(ob.x + 5, ob.y - 15)
        c.lineTo(ob.x + 14, ob.y - 5); c.lineTo(ob.x + 10, ob.y + 8); c.closePath(); c.fill()
      } else if (ob.type === 'shield') {
        c.fillStyle = '#6A2020'; c.beginPath(); c.arc(ob.x, ob.y, 12, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#8B7355'; c.beginPath(); c.arc(ob.x, ob.y, 4, 0, Math.PI * 2); c.fill()
      }
      c.globalAlpha = 1
    }

    // LOKE ILLUSIONS - multiple Jims floating in the red fog
    for (const il of lokeIllusions) {
      const ilAlpha = Math.min(il.timer / 0.5, 1) * 0.6
      c.globalAlpha = ilAlpha
      // Jim silhouette
      c.fillStyle = il.real ? '#E0B89A' : '#8B4040'
      c.beginPath(); c.arc(il.x, il.y, 12, 0, Math.PI * 2); c.fill()
      // If NOT real: antler shadow (Loke!)
      if (!il.real) {
        c.strokeStyle = 'rgba(139, 32, 50, 0.5)'; c.lineWidth = 2
        c.beginPath(); c.moveTo(il.x - 8, il.y - 8); c.lineTo(il.x - 16, il.y - 22); c.stroke()
        c.beginPath(); c.moveTo(il.x + 8, il.y - 8); c.lineTo(il.x + 16, il.y - 22); c.stroke()
        // Extra antler branches
        c.beginPath(); c.moveTo(il.x - 14, il.y - 18); c.lineTo(il.x - 20, il.y - 16); c.stroke()
        c.beginPath(); c.moveTo(il.x + 14, il.y - 18); c.lineTo(il.x + 20, il.y - 16); c.stroke()
      }
      // Eyes
      c.fillStyle = il.real ? '#6AACDB' : '#FF3030'
      c.beginPath(); c.arc(il.x - 4, il.y - 2, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(il.x + 4, il.y - 2, 1.5, 0, Math.PI * 2); c.fill()
      // Tattoo
      c.strokeStyle = '#9E3030'; c.lineWidth = 0.7
      c.beginPath(); c.moveTo(il.x - 6, il.y - 6); c.quadraticCurveTo(il.x, il.y - 14, il.x + 6, il.y - 6); c.stroke()
      c.globalAlpha = 1
    }

    // Jim's reflection in water shows ANTLERS (Loke foreshadowing)
    if (lokePhase >= 2 && jimActive) {
      const reflY = boatY + 25 + boatRock
      c.globalAlpha = 0.12
      // Normal Jim reflection
      c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(jimX, reflY, 8, 0, Math.PI * 2); c.fill()
      // But with ANTLERS
      c.strokeStyle = '#8B2030'; c.lineWidth = 2
      c.beginPath(); c.moveTo(jimX - 6, reflY - 6); c.lineTo(jimX - 15, reflY - 20); c.stroke()
      c.beginPath(); c.moveTo(jimX + 6, reflY - 6); c.lineTo(jimX + 15, reflY - 20); c.stroke()
      c.beginPath(); c.moveTo(jimX - 12, reflY - 16); c.lineTo(jimX - 20, reflY - 14); c.stroke()
      c.beginPath(); c.moveTo(jimX + 12, reflY - 16); c.lineTo(jimX + 20, reflY - 14); c.stroke()
      c.globalAlpha = 1
    }
  }

  // === LEVEL 3: Storm visual effects (diagonal rain streaks, lightning flash) ===
  if (currentLevel.value === 3) {
    // Lightning flash (rare)
    if (Math.sin(time.value * 7) > 0.98) {
      c.globalAlpha = 0.08; c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
    }
    // Wind indicator arrows
    if (Math.abs(windForce) > 20) {
      c.globalAlpha = 0.15; c.fillStyle = '#AAC'
      const windDir = windForce > 0 ? '→' : '←'
      c.font = '14px sans-serif'; c.textAlign = 'center'
      c.fillText(windDir + ' VIND ' + windDir, W / 2, 70)
      c.globalAlpha = 1
    }
  }

  // === LEVEL 6: VALHALLA RENDERING (NPCs, feast tables, torches) ===
  if (currentLevel.value === 6 && gameState.value !== 'loading') {
    const gndY6 = H > 200 ? H - 60 : 540

    // Feast tables (long wooden tables with food)
    for (let tx = 300; tx < 3000; tx += 500) {
      // Table
      c.fillStyle = '#3A2515'; c.beginPath(); c.roundRect(tx, gndY6 - 18, 200, 12, 3); c.fill()
      c.fillStyle = '#4A3525'; c.fillRect(tx + 5, gndY6 - 20, 190, 4)
      // Table legs
      c.fillStyle = '#2A1508'; c.fillRect(tx + 10, gndY6 - 8, 6, 16); c.fillRect(tx + 184, gndY6 - 8, 6, 16)
      // Food items on table
      c.fillStyle = '#8B5A2A'; c.beginPath(); c.ellipse(tx + 50, gndY6 - 26, 15, 8, 0, 0, Math.PI * 2); c.fill() // Meat
      c.fillStyle = '#F5A623'; c.beginPath(); c.arc(tx + 100, gndY6 - 28, 6, 0, Math.PI * 2); c.fill() // Mead horn
      c.fillStyle = '#C9A84C'; c.fillRect(tx + 95, gndY6 - 35, 3, 10) // Horn handle
      c.fillStyle = '#DDA040'; c.beginPath(); c.arc(tx + 150, gndY6 - 25, 8, 0, Math.PI * 2); c.fill() // Bread
    }

    // Wall torches (along the top)
    for (let wx = 100; wx < 3200; wx += 250) {
      const torchScreenX = wx - cameraX
      if (torchScreenX < -30 || torchScreenX > W + 30) continue
      // Bracket
      c.fillStyle = '#555'; c.fillRect(wx, gndY6 - 120, 4, 30)
      // Fire
      const fl = Math.sin(time.value * 6 + wx * 0.1) * 3
      c.fillStyle = '#FF8C30'; c.beginPath(); c.arc(wx + 2, gndY6 - 125 + fl, 8, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FFCC44'; c.beginPath(); c.arc(wx + 2, gndY6 - 128 + fl, 4, 0, Math.PI * 2); c.fill()
      // Light pool on ground
      const tGlow = c.createRadialGradient(wx, gndY6 - 80, 0, wx, gndY6 - 80, 60)
      tGlow.addColorStop(0, 'rgba(255, 140, 48, 0.06)'); tGlow.addColorStop(1, 'transparent')
      c.fillStyle = tGlow; c.fillRect(wx - 60, gndY6 - 140, 120, 120)
    }

    // NPCs — unique silhouettes per character
    for (const npc of npcs) {
      if (npc.x < cameraX - 50 || npc.x > cameraX + W + 50) continue
      const nx = npc.x, ny = npc.y
      const idleSwing = Math.sin(time.value * 1.5 + nx * 0.01) * 1.2

      if (npc.name === 'Bjørn Jernside') {
        // Massive warrior with axe, huge beard
        c.fillStyle = '#5A3A2A'; c.beginPath(); c.roundRect(nx - 14, ny, 28, 28, 3); c.fill()
        // Armor studs
        c.fillStyle = '#8B7355'
        for (let st = 0; st < 3; st++) c.beginPath(), c.arc(nx - 8 + st * 8, ny + 8, 1.2, 0, Math.PI * 2), c.fill()
        // Head
        c.fillStyle = '#D4A574'; c.beginPath(); c.arc(nx, ny - 8, 10, 0, Math.PI * 2); c.fill()
        // Huge beard
        c.fillStyle = '#3A2A1A'; c.beginPath(); c.roundRect(nx - 10, ny - 4, 20, 12, 4); c.fill()
        c.fillStyle = '#2A1A0A'; c.beginPath(); c.roundRect(nx - 7, ny + 6, 14, 5, 2); c.fill()
        // Horned iron helmet
        c.fillStyle = '#555'; c.beginPath(); c.roundRect(nx - 10, ny - 16, 20, 8, 3); c.fill()
        c.fillStyle = '#8B7355'
        c.beginPath(); c.moveTo(nx - 10, ny - 14); c.lineTo(nx - 16, ny - 22); c.lineTo(nx - 6, ny - 16); c.fill()
        c.beginPath(); c.moveTo(nx + 10, ny - 14); c.lineTo(nx + 16, ny - 22); c.lineTo(nx + 6, ny - 16); c.fill()
        // Axe swinging idle
        c.strokeStyle = '#3A2A1A'; c.lineWidth = 2.5
        c.beginPath(); c.moveTo(nx + 12, ny + 8); c.lineTo(nx + 22 + idleSwing, ny - 8 + idleSwing); c.stroke()
        c.fillStyle = '#888'; c.beginPath()
        c.moveTo(nx + 22 + idleSwing, ny - 10 + idleSwing); c.lineTo(nx + 30 + idleSwing, ny - 14 + idleSwing)
        c.lineTo(nx + 26 + idleSwing, ny - 2 + idleSwing); c.closePath(); c.fill()
      } else if (npc.name === 'Freya Skjoldmø') {
        // Golden-armored valkyrie with spear
        c.fillStyle = '#C9A84C'; c.beginPath(); c.roundRect(nx - 10, ny, 20, 25, 3); c.fill()
        // Armor trim
        c.strokeStyle = '#F5E066'; c.lineWidth = 0.8
        c.beginPath(); c.moveTo(nx - 10, ny + 10); c.lineTo(nx + 10, ny + 10); c.stroke()
        // Head
        c.fillStyle = '#F0D0A0'; c.beginPath(); c.arc(nx, ny - 6, 8, 0, Math.PI * 2); c.fill()
        // Long blonde hair
        c.fillStyle = '#F5E066'; c.beginPath(); c.roundRect(nx - 9, ny - 10, 18, 18, 6); c.fill()
        c.fillStyle = '#F0D0A0'; c.beginPath(); c.arc(nx, ny - 6, 7, 0, Math.PI * 2); c.fill()
        // Winged circlet
        c.fillStyle = '#F5E066'; c.beginPath(); c.roundRect(nx - 7, ny - 14, 14, 3, 1); c.fill()
        // Feathered wings (big, gold-tipped white)
        c.fillStyle = '#FFF'
        c.beginPath(); c.moveTo(nx - 10, ny + 2); c.quadraticCurveTo(nx - 26, ny - 14, nx - 14, ny - 8); c.fill()
        c.beginPath(); c.moveTo(nx + 10, ny + 2); c.quadraticCurveTo(nx + 26, ny - 14, nx + 14, ny - 8); c.fill()
        // Gold wing edges
        c.strokeStyle = '#F5E066'; c.lineWidth = 1
        c.beginPath(); c.moveTo(nx - 10, ny + 2); c.quadraticCurveTo(nx - 26, ny - 14, nx - 14, ny - 8); c.stroke()
        c.beginPath(); c.moveTo(nx + 10, ny + 2); c.quadraticCurveTo(nx + 26, ny - 14, nx + 14, ny - 8); c.stroke()
        // Spear
        c.strokeStyle = '#8B7355'; c.lineWidth = 2
        c.beginPath(); c.moveTo(nx + 12, ny + 22); c.lineTo(nx + 18, ny - 18); c.stroke()
        c.fillStyle = '#F5E066'
        c.beginPath(); c.moveTo(nx + 18, ny - 22); c.lineTo(nx + 22, ny - 14); c.lineTo(nx + 14, ny - 16); c.fill()
      } else if (npc.name === 'Ragnar Mjødbrygger') {
        // Round fat warrior with mead horn, hiccups
        const hic = Math.sin(time.value * 2.5) < 0.92 ? 0 : 1.5
        // Huge belly
        c.fillStyle = '#8B2030'; c.beginPath(); c.ellipse(nx, ny + 14 + hic, 16, 14, 0, 0, Math.PI * 2); c.fill()
        // Barrel stripes
        c.strokeStyle = '#5A1520'; c.lineWidth = 0.8
        c.beginPath(); c.arc(nx, ny + 14 + hic, 14, 0, Math.PI); c.stroke()
        c.beginPath(); c.arc(nx, ny + 14 + hic, 10, 0, Math.PI); c.stroke()
        // Head (pink, drunk)
        c.fillStyle = '#F0A080'; c.beginPath(); c.arc(nx, ny - 4 + hic, 9, 0, Math.PI * 2); c.fill()
        // Red cheeks
        c.fillStyle = '#D04040'
        c.beginPath(); c.arc(nx - 5, ny - 2 + hic, 1.5, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(nx + 5, ny - 2 + hic, 1.5, 0, Math.PI * 2); c.fill()
        // Bushy red beard
        c.fillStyle = '#A03820'; c.beginPath(); c.roundRect(nx - 8, ny + 1 + hic, 16, 8, 3); c.fill()
        // Mead horn in hand
        c.fillStyle = '#F5A623'
        c.beginPath(); c.moveTo(nx - 20, ny + 6 + hic); c.lineTo(nx - 14, ny - 2 + hic); c.lineTo(nx - 12, ny + 2 + hic); c.lineTo(nx - 18, ny + 10 + hic); c.fill()
        // Mead spill
        c.fillStyle = '#FFDD66'
        c.beginPath(); c.arc(nx - 14, ny - 2 + hic, 1.5, 0, Math.PI * 2); c.fill()
      } else if (npc.name === 'Bragi Skalden') {
        // Skald with harp, musical notes floating
        c.fillStyle = '#5A4A3A'; c.beginPath(); c.roundRect(nx - 10, ny, 20, 27, 3); c.fill()
        // Long robe
        c.fillStyle = '#7A6A5A'
        c.beginPath(); c.moveTo(nx - 11, ny + 5); c.lineTo(nx - 15, ny + 28); c.lineTo(nx + 15, ny + 28); c.lineTo(nx + 11, ny + 5); c.fill()
        // Head
        c.fillStyle = '#D4A574'; c.beginPath(); c.arc(nx, ny - 6, 8, 0, Math.PI * 2); c.fill()
        // Long grey hair
        c.fillStyle = '#BBB'; c.beginPath(); c.roundRect(nx - 9, ny - 10, 18, 16, 5); c.fill()
        c.fillStyle = '#D4A574'; c.beginPath(); c.arc(nx, ny - 6, 7, 0, Math.PI * 2); c.fill()
        // Harp
        c.strokeStyle = '#C9A84C'; c.lineWidth = 1.5
        c.beginPath(); c.moveTo(nx + 10, ny + 4); c.quadraticCurveTo(nx + 22, ny - 2, nx + 18, ny + 18); c.stroke()
        c.beginPath(); c.moveTo(nx + 10, ny + 4); c.lineTo(nx + 18, ny + 18); c.stroke()
        c.strokeStyle = '#F5E066'; c.lineWidth = 0.4
        for (let hs = 0; hs < 4; hs++) {
          const tt = hs / 3
          c.beginPath(); c.moveTo(nx + 10 + tt * 8, ny + 4 + tt * 14); c.lineTo(nx + 12 + tt * 10, ny + 4 + tt * 14); c.stroke()
        }
        // Musical notes floating (singing idle)
        const noteY = ny - 18 - Math.abs(Math.sin(time.value * 2)) * 4
        c.fillStyle = '#F5E066'; c.font = 'bold 10px serif'; c.textAlign = 'center'
        c.fillText('♪', nx + 12, noteY)
        c.fillText('♫', nx + 20, noteY - 4)
      } else if (npc.name === 'Odin Alfader') {
        // Odin — one eye, raven on shoulder, Gungnir spear, cape
        // Cape
        c.fillStyle = '#3A1A3A'
        c.beginPath(); c.moveTo(nx - 13, ny - 2); c.lineTo(nx - 18, ny + 28); c.lineTo(nx + 18, ny + 28); c.lineTo(nx + 13, ny - 2); c.fill()
        // Body (deep blue armor)
        c.fillStyle = '#2A3A5A'; c.beginPath(); c.roundRect(nx - 11, ny, 22, 26, 3); c.fill()
        // Gold trim
        c.strokeStyle = '#C9A84C'; c.lineWidth = 1
        c.beginPath(); c.moveTo(nx - 11, ny + 4); c.lineTo(nx + 11, ny + 4); c.stroke()
        // Head
        c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(nx, ny - 8, 9, 0, Math.PI * 2); c.fill()
        // Long white beard
        c.fillStyle = '#E8E8E8'; c.beginPath(); c.roundRect(nx - 10, ny - 5, 20, 14, 5); c.fill()
        // Head circle redraw above beard
        c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(nx, ny - 10, 8, 0, Math.PI * 2); c.fill()
        // Eye patch (left)
        c.fillStyle = '#1A0A00'; c.fillRect(nx - 6, ny - 11, 5, 3)
        c.strokeStyle = '#1A0A00'; c.lineWidth = 0.6
        c.beginPath(); c.moveTo(nx - 8, ny - 12); c.lineTo(nx, ny - 8); c.stroke()
        // Remaining eye (glowing blue)
        c.fillStyle = '#6AACDB'; c.beginPath(); c.arc(nx + 3, ny - 10, 1.5, 0, Math.PI * 2); c.fill()
        // Pointed crown/hat
        c.fillStyle = '#C9A84C'
        c.beginPath(); c.moveTo(nx - 9, ny - 16); c.lineTo(nx, ny - 24); c.lineTo(nx + 9, ny - 16); c.fill()
        // Gungnir spear
        c.strokeStyle = '#8B7355'; c.lineWidth = 2.5
        c.beginPath(); c.moveTo(nx + 14, ny + 24); c.lineTo(nx + 20, ny - 22); c.stroke()
        c.fillStyle = '#F5E066'
        c.beginPath(); c.moveTo(nx + 20, ny - 26); c.lineTo(nx + 24, ny - 16); c.lineTo(nx + 16, ny - 18); c.fill()
        // Raven on shoulder
        c.fillStyle = '#1A1A1A'
        c.beginPath(); c.ellipse(nx - 14, ny - 4, 5, 3, 0, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(nx - 17, ny - 6, 2.5, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#CC2020'; c.beginPath(); c.arc(nx - 18, ny - 7, 0.7, 0, Math.PI * 2); c.fill()
      } else if (npc.name === 'Sigrun Valkyrie') {
        // Younger valkyrie — blue wings, slimmer silhouette
        c.fillStyle = '#3A5A8A'; c.beginPath(); c.roundRect(nx - 9, ny, 18, 25, 3); c.fill()
        c.strokeStyle = '#88CCE0'; c.lineWidth = 0.6
        c.beginPath(); c.moveTo(nx - 9, ny + 10); c.lineTo(nx + 9, ny + 10); c.stroke()
        // Head
        c.fillStyle = '#F0D0A0'; c.beginPath(); c.arc(nx, ny - 6, 8, 0, Math.PI * 2); c.fill()
        // Braided hair
        c.fillStyle = '#8B6914'
        c.beginPath(); c.roundRect(nx - 8, ny - 10, 6, 12, 3); c.fill()
        c.beginPath(); c.roundRect(nx + 2, ny - 10, 6, 12, 3); c.fill()
        // Wings (blue)
        c.fillStyle = '#88CCE0'
        c.beginPath(); c.moveTo(nx - 9, ny + 2); c.quadraticCurveTo(nx - 22, ny - 10, nx - 12, ny - 6); c.fill()
        c.beginPath(); c.moveTo(nx + 9, ny + 2); c.quadraticCurveTo(nx + 22, ny - 10, nx + 12, ny - 6); c.fill()
        // Small shield (blue)
        c.fillStyle = '#2A4A7A'; c.beginPath(); c.arc(nx - 12, ny + 10, 5, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#88CCE0'; c.lineWidth = 0.5
        c.beginPath(); c.arc(nx - 12, ny + 10, 5, 0, Math.PI * 2); c.stroke()
      } else if (npc.name === 'Den Gamle Porsche-Ejer') {
        // Old Porsche owner — tweed jacket, driving gloves, tiny 911 model in hand
        c.fillStyle = '#8B6F47'; c.beginPath(); c.roundRect(nx - 11, ny, 22, 26, 3); c.fill()
        // Tweed pattern
        c.fillStyle = '#6A5030'
        for (let tw = 0; tw < 6; tw++) {
          c.fillRect(nx - 10 + (tw % 3) * 7, ny + 4 + Math.floor(tw / 3) * 8, 1, 1)
        }
        // Head (older, wrinkled)
        c.fillStyle = '#D4A574'; c.beginPath(); c.arc(nx, ny - 6, 8, 0, Math.PI * 2); c.fill()
        // Grey hair (short, combed)
        c.fillStyle = '#B0B0B0'; c.beginPath(); c.roundRect(nx - 8, ny - 13, 16, 6, 3); c.fill()
        // Glasses (aviator style)
        c.strokeStyle = '#C9A84C'; c.lineWidth = 1
        c.beginPath(); c.arc(nx - 3, ny - 6, 2.5, 0, Math.PI * 2); c.stroke()
        c.beginPath(); c.arc(nx + 3, ny - 6, 2.5, 0, Math.PI * 2); c.stroke()
        c.beginPath(); c.moveTo(nx - 1, ny - 6); c.lineTo(nx + 1, ny - 6); c.stroke()
        // Wistful smile
        c.strokeStyle = '#8B7060'; c.lineWidth = 0.8
        c.beginPath(); c.moveTo(nx - 3, ny); c.quadraticCurveTo(nx, ny + 2, nx + 3, ny); c.stroke()
        // Tiny Porsche 911 model in his hand (silhouette)
        c.save()
        c.translate(nx + 14, ny + 10)
        c.fillStyle = '#D93A3A' // Guards red
        c.beginPath()
        c.moveTo(-7, 1); c.lineTo(-5, -2); c.quadraticCurveTo(0, -4, 4, -3); c.lineTo(6, 0); c.lineTo(7, 1); c.lineTo(-7, 1); c.closePath(); c.fill()
        // Wheels
        c.fillStyle = '#1A1A1A'
        c.beginPath(); c.arc(-4, 1, 1.3, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(3, 1, 1.3, 0, Math.PI * 2); c.fill()
        // Windshield
        c.fillStyle = '#88CCE0'
        c.fillRect(-3, -2, 4, 1)
        c.restore()
      } else {
        // Fallback generic NPC
        const bodyColor = npc.type === 'valkyrie' ? '#4A6A8A' : npc.type === 'king' ? '#C9A84C' : npc.type === 'skald' ? '#5A4A3A' : '#5A3A2A'
        c.fillStyle = bodyColor; c.beginPath(); c.roundRect(nx - 10, ny, 20, 25, 3); c.fill()
        c.fillStyle = '#D4A574'; c.beginPath(); c.arc(nx, ny - 6, 8, 0, Math.PI * 2); c.fill()
      }

      // Name above (keep color cue)
      c.fillStyle = npc.interacted ? '#888' : '#F5A623'; c.font = 'bold 9px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText(npc.name, npc.x, npc.y - 28)
      // "Talk" prompt when near
      if (showNpcPrompt && nearestNpcName === npc.name) {
        c.fillStyle = '#F5A623'; c.font = 'bold 11px "Space Grotesk"'
        c.fillText('[SPACE] Tal', npc.x, npc.y - 42)
      }
    }

    // Drinkgame overlay
    if (drinkGameActive && valhallaPhase === 2) {
      c.fillStyle = 'rgba(10, 10, 5, 0.6)'; c.fillRect(0, 0, W, H)
      c.fillStyle = '#F5A623'; c.font = 'bold 22px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('DRIKKESPIL!', W / 2, H * 0.25)
      c.fillText(`Runde ${drinkGameRound + 1}/3`, W / 2, H * 0.25 + 30)
      // Timing bar
      const barW2 = W * 0.6, barH2 = 20, barX2 = (W - barW2) / 2, barY2 = H * 0.45
      c.fillStyle = '#333'; c.beginPath(); c.roundRect(barX2, barY2, barW2, barH2, 6); c.fill()
      // Gold sweet spot (35-65%)
      c.fillStyle = 'rgba(245, 166, 35, 0.3)'
      c.fillRect(barX2 + barW2 * 0.35, barY2, barW2 * 0.3, barH2)
      // Marker
      const markerX = barX2 + (drinkGameMarker / 100) * barW2
      c.fillStyle = '#FFF'; c.fillRect(markerX - 2, barY2 - 4, 4, barH2 + 8)
      c.fillStyle = '#CCC'; c.font = '14px "DM Sans"'
      c.fillText('Tryk SPACE i det gyldne felt!', W / 2, barY2 + 50)
      c.fillText(`Score: ${drinkGameScore}/3`, W / 2, barY2 + 74)
    }

    // Loke reveal glow (red creeping in from edges)
    if (revealProgress > 0) {
      const revAlpha = revealProgress * 0.2
      const revGrad = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7)
      revGrad.addColorStop(0, 'transparent'); revGrad.addColorStop(1, `rgba(139, 32, 48, ${revAlpha})`)
      c.fillStyle = revGrad; c.fillRect(0, 0, W, H)
    }
  }

  // === GIANT BEER CAN GOAL ===
  const gndY = H - 50
  const goalH = 100, goalW = 50
  const bossStillAlive = enemies.some(e => (e.type === 'boss' || e.type === 'boss_deer' || e.type === 'boss_berserker' || e.type === 'boss_fire') && e.alive)
  if (!goalReached) {
    const olMet = levelOl.value >= OL_REQ[currentLevel.value - 1]
    const met = olMet && !bossStillAlive
    const reason = bossStillAlive ? 'BOSS!' : !olMet ? 'LÅST' : 'SKÅL!'
    c.fillStyle = met ? '#D4D4D4' : '#606060'
    c.beginPath(); c.roundRect(goalX, gndY - goalH, goalW, goalH, 8); c.fill()
    c.fillStyle = met ? '#1A4A1A' : '#404040'
    c.fillRect(goalX + 4, gndY - goalH + 15, goalW - 8, goalH - 25)
    c.fillStyle = met ? '#F5A623' : '#505050'
    c.fillRect(goalX + 6, gndY - goalH + 40, goalW - 12, 10)
    c.fillStyle = met ? '#F5A623' : bossStillAlive ? '#CC2020' : '#888'; c.font = 'bold 10px "Space Grotesk"'; c.textAlign = 'center'
    c.fillText(reason, goalX + goalW / 2, gndY - goalH + 60)
    c.fillStyle = met ? '#B0B0B0' : '#505050'
    c.beginPath(); c.roundRect(goalX + 5, gndY - goalH - 5, goalW - 10, 8, 3); c.fill()
    if (met) {
      const gGlow = c.createRadialGradient(goalX + goalW / 2, gndY - goalH / 2, 0, goalX + goalW / 2, gndY - goalH / 2, 50)
      gGlow.addColorStop(0, 'rgba(245, 166, 35, 0.1)'); gGlow.addColorStop(1, 'transparent')
      c.fillStyle = gGlow; c.fillRect(goalX - 30, gndY - goalH - 30, goalW + 60, goalH + 60)
    }
  }

  // === PLAYER LARS ===
  if (gameState.value !== 'dead') {
    const blink = invTimer > 0 ? (Math.sin(time.value * 15) > 0 ? 1 : 0.3) : 1
    c.globalAlpha = blink
    const pw = getPlayerW(), ph = getPlayerH()

    // Mood-based bounce offset (up/down)
    const bounce = larsBounceTimer > 0 ? -Math.sin((1 - larsBounceTimer / 0.6) * Math.PI) * 6 : 0
    // Drunk wobble
    const wobble = playerPower === 'drunk' ? Math.sin(time.value * 8) * 0.15 : 0
    // Victory hop cycle
    const victoryHop = larsMood === 'victory' ? Math.abs(Math.sin(time.value * 8)) * -4 : 0

    c.save()
    c.translate(px + pw / 2, py + ph / 2 - 4 + bounce + victoryHop)
    if (facing < 0) c.scale(-1, 1)
    if (wobble) c.rotate(wobble)
    const s = playerPower === 'big' ? 1.0 : 0.8

    // Lars body
    const bodyColor = playerPower === 'drunk' ? '#4A6A3A' : '#3A4A3A'
    c.fillStyle = bodyColor; c.beginPath(); c.roundRect(-12 * s, 2 * s, 24 * s, 18 * s, 3); c.fill()
    // Head
    c.fillStyle = '#D4A574'; c.beginPath(); c.arc(0, -8 * s, 11 * s, 0, Math.PI * 2); c.fill()

    // Beanie — skewed if scared
    const beanieRot = larsMood === 'scared' ? -0.25 : 0
    c.save()
    c.translate(0, -15 * s)
    if (beanieRot) c.rotate(beanieRot)
    c.fillStyle = '#1A1A1A'; c.beginPath(); c.roundRect(-11 * s, -5 * s, 22 * s, 10 * s, 4); c.fill()
    c.beginPath(); c.arc(0, -7 * s, 4 * s, 0, Math.PI * 2); c.fill()
    c.restore()

    // Beard
    c.fillStyle = '#2A1A0A'; c.beginPath(); c.roundRect(-8 * s, -2 * s, 16 * s, 8 * s, 3); c.fill()
    c.fillStyle = '#1A0A00'; c.beginPath(); c.roundRect(-6 * s, 4 * s, 12 * s, 4 * s, 2); c.fill()

    // Mouth based on mood
    if (larsMood === 'happy' || larsMood === 'victory') {
      // Wide grin
      c.strokeStyle = '#F5E6D0'; c.lineWidth = 1.8 * s
      c.beginPath(); c.moveTo(-4 * s, 1 * s); c.quadraticCurveTo(0, 6 * s, 4 * s, 1 * s); c.stroke()
      // Teeth
      c.fillStyle = '#FFF8E0'; c.beginPath(); c.roundRect(-3 * s, 1 * s, 6 * s, 2 * s, 1); c.fill()
    } else if (larsMood === 'scared') {
      // Open shocked mouth (O-shape)
      c.fillStyle = '#1A0A00'; c.beginPath(); c.arc(0, 3 * s, 2.5 * s, 0, Math.PI * 2); c.fill()
    }

    // Sunglasses — lifted slightly if happy/victory (shows eyes glinting)
    const shadeYOffset = (larsMood === 'happy' || larsMood === 'victory') ? -1.5 * s : 0
    c.fillStyle = '#0A0A0A'
    c.beginPath(); c.roundRect(-8 * s, -11 * s + shadeYOffset, 7 * s, 5 * s, 2); c.fill()
    c.beginPath(); c.roundRect(1 * s, -11 * s + shadeYOffset, 7 * s, 5 * s, 2); c.fill()

    // Happy/victory: eyes glinting above lifted shades
    if (larsMood === 'happy' || larsMood === 'victory') {
      c.fillStyle = '#FFF'
      c.beginPath(); c.arc(-4.5 * s, -12 * s, 0.9 * s, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(4.5 * s, -12 * s, 0.9 * s, 0, Math.PI * 2); c.fill()
    }
    // Scared: wide eyes above sunglasses
    if (larsMood === 'scared') {
      c.fillStyle = '#FFF'
      c.beginPath(); c.arc(-4.5 * s, -12 * s, 1.4 * s, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(4.5 * s, -12 * s, 1.4 * s, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#000'
      c.beginPath(); c.arc(-4.5 * s, -12 * s, 0.5 * s, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(4.5 * s, -12 * s, 0.5 * s, 0, Math.PI * 2); c.fill()
    }

    // Gold chain
    c.strokeStyle = '#F5A623'; c.lineWidth = 1.5 * s
    c.beginPath(); c.moveTo(-6 * s, 4 * s); c.quadraticCurveTo(0, 10 * s, 6 * s, 4 * s); c.stroke()

    // Victory: raised fist in free hand
    if (larsMood === 'victory') {
      c.strokeStyle = '#D4A574'; c.lineWidth = 3 * s
      c.beginPath(); c.moveTo(10 * s, 5 * s); c.lineTo(14 * s, -12 * s); c.stroke()
      // Fist
      c.fillStyle = '#D4A574'; c.beginPath(); c.arc(14 * s, -14 * s, 3 * s, 0, Math.PI * 2); c.fill()
      // Knuckle highlight
      c.fillStyle = '#E8B883'; c.beginPath(); c.arc(13 * s, -15 * s, 1.2 * s, 0, Math.PI * 2); c.fill()
      // Celebration sparks
      c.fillStyle = '#FFE066'
      for (let k = 0; k < 3; k++) {
        const sa = time.value * 4 + k * 2.1
        c.beginPath(); c.arc(14 * s + Math.cos(sa) * 8, -14 * s + Math.sin(sa) * 8, 1.2, 0, Math.PI * 2); c.fill()
      }
    }

    // Legs
    c.fillStyle = '#2A2A5A'
    c.beginPath(); c.roundRect(-8 * s, 20 * s, 7 * s, 10 * s, 2); c.fill()
    c.beginPath(); c.roundRect(1 * s, 20 * s, 7 * s, 10 * s, 2); c.fill()

    c.restore()
    c.globalAlpha = 1
  }

  // === JIM COMPANION (Level 2+) ===
  if (jimActive && (gameState.value === 'playing' || gameState.value === 'boss')) {
    // Laughter body shake
    const laughShake = jimMood === 'laughing' ? Math.sin(time.value * 24) * 1.2 : 0
    // Evil horns grow subtly with intensity (Loke foreshadowing)
    const hornLen = jimEvilIntensity * 10

    c.save()
    c.translate(jimX + laughShake, jimY)

    // Jim's shadow (foreshadowing - antler-shaped!)
    c.globalAlpha = 0.1
    c.fillStyle = '#000'
    c.beginPath(); c.ellipse(0, 22, 12, 4, 0, 0, Math.PI * 2); c.fill()
    // Shadow has antler hints (Loke foreshadowing)
    c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 2
    c.beginPath(); c.moveTo(-6, 18); c.lineTo(-14, 10); c.stroke()
    c.beginPath(); c.moveTo(6, 18); c.lineTo(14, 10); c.stroke()
    c.globalAlpha = 1

    // Jim body (dalmatian shirt, bald, tattoo)
    c.fillStyle = '#F5F0E8'; c.beginPath(); c.roundRect(-8, 2, 16, 14, 2); c.fill()
    c.fillStyle = '#1A1A1A'
    c.beginPath(); c.arc(-3, 6, 2, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(4, 9, 2.5, 0, Math.PI * 2); c.fill()

    // Head (bald)
    c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(0, -5, 8, 0, Math.PI * 2); c.fill()

    // Evil horns emerging (intensity > 0)
    if (hornLen > 1) {
      c.fillStyle = '#2A1A0A'
      c.beginPath(); c.moveTo(-6, -10); c.lineTo(-8, -10 - hornLen); c.lineTo(-4, -9); c.closePath(); c.fill()
      c.beginPath(); c.moveTo(6, -10); c.lineTo(8, -10 - hornLen); c.lineTo(4, -9); c.closePath(); c.fill()
    }

    // Tattoo
    c.strokeStyle = '#9E3030'; c.lineWidth = 0.7
    c.beginPath(); c.moveTo(-5, -8); c.quadraticCurveTo(0, -14, 5, -8); c.stroke()
    c.fillStyle = '#9E3030'; c.beginPath(); c.arc(0, -12, 1, 0, Math.PI * 2); c.fill()

    // Eyes (blue normally, red when evil)
    const eyeColor = jimMood === 'evil' ? '#D93A3A' : jimEvilIntensity > 0.3 ? `rgb(${Math.min(220, 106 + jimEvilIntensity * 140)}, ${Math.max(60, 172 - jimEvilIntensity * 100)}, ${Math.max(60, 219 - jimEvilIntensity * 160)})` : '#6AACDB'
    c.fillStyle = eyeColor
    if (jimMood === 'laughing') {
      // Laughing: eyes crinkled (short lines)
      c.strokeStyle = eyeColor; c.lineWidth = 1.4
      c.beginPath(); c.moveTo(-4, -5); c.lineTo(-2, -5); c.stroke()
      c.beginPath(); c.moveTo(2, -5); c.lineTo(4, -5); c.stroke()
    } else {
      c.beginPath(); c.arc(-3, -5, 1.2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(3, -5, 1.2, 0, Math.PI * 2); c.fill()
    }

    // Mouth based on mood
    if (jimMood === 'laughing') {
      c.fillStyle = '#1A0A00'
      c.beginPath(); c.ellipse(0, -1, 3, 2, 0, 0, Math.PI * 2); c.fill()
      // Teeth
      c.fillStyle = '#FFF8E0'; c.fillRect(-2, -2, 4, 1.2)
    } else if (jimMood === 'evil') {
      // Smirk
      c.strokeStyle = '#9E3030'; c.lineWidth = 1
      c.beginPath(); c.moveTo(-2, -1); c.quadraticCurveTo(1, -3, 3, -1); c.stroke()
    }

    // Finger — pointing is bigger/extended
    if (jimMood === 'pointing') {
      c.strokeStyle = '#E0B89A'; c.lineWidth = 2.5
      const dirX = px > jimX ? 1 : -1
      c.beginPath(); c.moveTo(dirX * 10, 2); c.lineTo(dirX * 22, -2); c.stroke()
      // Nail tip
      c.fillStyle = '#F5E6D0'; c.beginPath(); c.arc(dirX * 22, -2, 1.3, 0, Math.PI * 2); c.fill()
    } else {
      c.strokeStyle = '#E0B89A'; c.lineWidth = 2
      c.beginPath(); c.moveTo(10, 2); c.lineTo(15, -6); c.stroke()
    }

    c.restore()

    // Laughter "HA!" particles floating
    if (jimMood === 'laughing' && Math.random() < 0.15) {
      particles.push({
        x: jimX + (Math.random() - 0.5) * 10, y: jimY - 20,
        vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 20,
        life: 0.8, maxLife: 0.8, size: 8, color: 'jim_laugh',
      })
    }

    // Floating comment above Jim
    if (jimComment) {
      c.globalAlpha = Math.min(1, jimCommentTimer + 2)
      c.fillStyle = jimMood === 'evil' ? 'rgba(40, 10, 10, 0.85)' : 'rgba(10, 15, 10, 0.8)'
      c.font = '9px "DM Sans"'
      const tw = c.measureText(jimComment).width
      c.beginPath(); c.roundRect(jimX - tw / 2 - 6, jimY - 30, tw + 12, 18, 6); c.fill()
      c.fillStyle = jimMood === 'evil' ? '#FF8888' : '#CCC'; c.textAlign = 'center'
      c.fillText(jimComment, jimX, jimY - 17)
      c.globalAlpha = 1
    }

    // Prank visual indicators
    if (jimPrankActive === 'drunk') {
      c.fillStyle = 'rgba(245, 166, 35, 0.15)'
      c.beginPath(); c.arc(px + getPlayerW() / 2, py + getPlayerH() / 2, 20, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#F5A623'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('FULD!', px + getPlayerW() / 2, py - 10)
    }
    if (jimPrankActive === 'heavy') {
      c.fillStyle = '#888'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('TUNG!', px + getPlayerW() / 2, py - 10)
      c.fillStyle = '#555'; c.beginPath(); c.arc(px + getPlayerW() / 2, py + getPlayerH() + 5, 6, 0, Math.PI * 2); c.fill()
    }
    if (jimPrankActive === 'swap') {
      c.fillStyle = 'rgba(106, 172, 219, 0.2)'
      c.beginPath(); c.arc(px + getPlayerW() / 2, py + getPlayerH() / 2, 22, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#6AACDB'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('← BYTTET →', px + getPlayerW() / 2, py - 10)
    }
    if (jimPrankActive === 'wind') {
      c.fillStyle = '#B0C4D9'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('STORM!', px + getPlayerW() / 2, py - 10)
    }
    if (jimPrankActive === 'fire') {
      c.fillStyle = 'rgba(255, 80, 30, 0.2)'
      c.beginPath(); c.arc(px + getPlayerW() / 2, py + getPlayerH() / 2, 28, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#FF5030'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('BRANDER!', px + getPlayerW() / 2, py - 10)
    }
  }

  // === DALMATINER (sidequest) ===
  if (dalmatinerActive && !dalmatinerCaught) {
    // Bouncing dalmatian dog
    c.fillStyle = '#FFF'; c.beginPath(); c.arc(dalmatinerX, dalmatinerY, 8, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(dalmatinerX, dalmatinerY - 5, 6, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#1A1A1A'
    c.beginPath(); c.arc(dalmatinerX - 3, dalmatinerY - 1, 2, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(dalmatinerX + 3, dalmatinerY + 1, 1.5, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#2A2A2A'
    c.beginPath(); c.arc(dalmatinerX - 4, dalmatinerY - 8, 2.5, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(dalmatinerX + 4, dalmatinerY - 8, 2.5, 0, Math.PI * 2); c.fill()
    // Tail wagging
    const tWag = Math.sin(time.value * 10) * 4
    c.strokeStyle = '#FFF'; c.lineWidth = 2
    c.beginPath(); c.moveTo(dalmatinerX, dalmatinerY + 6); c.lineTo(dalmatinerX + tWag, dalmatinerY + 12); c.stroke()
    // "FANG MIG!" text
    c.fillStyle = '#F5A623'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
    c.fillText('FANG MIG!', dalmatinerX, dalmatinerY - 16)
  }

  // === PARTICLES ===
  for (const p of particles) {
    if (p.color === 'fog') {
      c.globalAlpha = (p.life / p.maxLife) * 0.08
      c.fillStyle = '#AAA'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'greenfog') {
      c.globalAlpha = (p.life / p.maxLife) * 0.06
      c.fillStyle = '#88AA66'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'rain') {
      c.globalAlpha = 0.3
      c.strokeStyle = '#88AACC'; c.lineWidth = 0.5
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2, p.y + 8); c.stroke()
    } else if (p.color === 'leaf') {
      c.globalAlpha = (p.life / p.maxLife) * 0.6
      c.save(); c.translate(p.x, p.y); c.rotate(p.life * 3 + p.x * 0.1)
      c.fillStyle = Math.sin(p.x) > 0 ? '#5A2A1A' : '#3A4A1A'
      c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); c.fill()
      c.restore()
    } else if (p.color === 'spore') {
      c.globalAlpha = (p.life / p.maxLife) * 0.5
      c.fillStyle = '#AAFF66'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'odin_chaos') {
      // Mini Odin heads flying around
      c.globalAlpha = (p.life / p.maxLife) * 0.6
      c.fillStyle = '#E0C8A0'; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#F5A623'; c.beginPath(); c.arc(p.x - 2, p.y - 1, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(p.x + 2, p.y - 1, 1.5, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'dragonfire') {
      c.globalAlpha = (p.life / p.maxLife) * 0.8
      c.fillStyle = p.life > p.maxLife * 0.5 ? '#FF3300' : '#FFAA00'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
      c.globalAlpha = (p.life / p.maxLife) * 0.3
      c.fillStyle = '#FF6600'; c.beginPath(); c.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'red_fog') {
      c.globalAlpha = (p.life / p.maxLife) * 0.1
      c.fillStyle = '#8B2030'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'red_ember') {
      c.globalAlpha = (p.life / p.maxLife) * 0.7
      c.fillStyle = '#CC3040'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'gold_ember') {
      c.globalAlpha = (p.life / p.maxLife) * 0.7
      c.fillStyle = '#F5A623'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'warm_smoke') {
      c.globalAlpha = (p.life / p.maxLife) * 0.05
      c.fillStyle = '#AA8850'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'ember') {
      c.globalAlpha = (p.life / p.maxLife) * 0.8
      c.fillStyle = Math.random() > 0.5 ? '#FF6600' : '#FF3300'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'fire_smoke') {
      c.globalAlpha = (p.life / p.maxLife) * 0.08
      c.fillStyle = '#AA6633'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'lava') {
      c.globalAlpha = (p.life / p.maxLife)
      c.fillStyle = p.life > p.maxLife * 0.5 ? '#FF4400' : '#FF8800'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
      // Lava glow
      c.globalAlpha = (p.life / p.maxLife) * 0.3
      c.fillStyle = '#FF6600'
      c.beginPath(); c.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'storm_rain') {
      c.globalAlpha = 0.35
      c.strokeStyle = '#8899BB'; c.lineWidth = 0.7
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 4, p.y + 12); c.stroke()
    } else if (p.color === 'sea_spray') {
      c.globalAlpha = (p.life / p.maxLife) * 0.4
      c.fillStyle = '#DDEEFF'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'firefly') {
      const ff = 0.3 + Math.sin(time.value * 5 + p.x) * 0.3
      c.globalAlpha = ff
      c.fillStyle = '#FFEE44'
      c.beginPath(); c.arc(p.x + Math.sin(time.value * 2 + p.y) * 5, p.y + Math.cos(time.value * 1.5 + p.x) * 5, p.size, 0, Math.PI * 2); c.fill()
      // Tiny glow
      const ffGlow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8)
      ffGlow.addColorStop(0, `rgba(255, 238, 68, ${ff * 0.2})`); ffGlow.addColorStop(1, 'transparent')
      c.fillStyle = ffGlow; c.fillRect(p.x - 8, p.y - 8, 16, 16)
    } else if (p.color === 'jim_laugh') {
      c.globalAlpha = p.life / p.maxLife
      c.fillStyle = '#D93A3A'
      c.font = 'bold 9px "Space Grotesk"'
      c.textAlign = 'center'
      c.fillText('HA!', p.x, p.y)
    } else if (p.color === 'sparkle') {
      const ls = p.life / p.maxLife
      c.globalAlpha = ls
      c.fillStyle = '#FFE066'
      // Star shape
      c.save()
      c.translate(p.x, p.y)
      c.rotate(time.value * 4)
      c.beginPath()
      for (let sp = 0; sp < 4; sp++) {
        const ang = (sp / 4) * Math.PI * 2
        c.lineTo(Math.cos(ang) * p.size, Math.sin(ang) * p.size)
        c.lineTo(Math.cos(ang + Math.PI / 4) * p.size * 0.4, Math.sin(ang + Math.PI / 4) * p.size * 0.4)
      }
      c.closePath(); c.fill()
      c.restore()
    } else if (p.color === 'gold_burst') {
      c.globalAlpha = p.life / p.maxLife
      const col = Math.random() < 0.5 ? '#F5A623' : '#FFD860'
      c.fillStyle = col
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else if (p.color === 'trail') {
      c.globalAlpha = (p.life / p.maxLife) * 0.5
      c.fillStyle = '#88CCE0'
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    } else {
      c.globalAlpha = p.life / p.maxLife
      c.fillStyle = p.color
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill()
    }
    c.globalAlpha = 1
  }

  c.restore() // End camera transform

  // Near layer foreground (subtle overlay)
  if (bgNear.value) {
    const nearX = -(cameraX * 0.6) % W
    c.globalAlpha = 0.3
    c.drawImage(bgNear.value, nearX, H * 0.5, W, H * 0.5)
    c.drawImage(bgNear.value, nearX + W, H * 0.5, W, H * 0.5)
    c.globalAlpha = 1
  }

  // Vignette
  const vigGrad = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8)
  vigGrad.addColorStop(0, 'transparent')
  vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
  c.fillStyle = vigGrad; c.fillRect(0, 0, W, H)

  // Level 5 Loke chaos effects (only during gameplay)
  if (currentLevel.value === 5 && gameState.value === 'playing') {
    // DARKNESS
    if (jimPrankActive === 'dark') {
      c.globalAlpha = 0.7; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
      c.fillStyle = '#8B2030'; c.font = 'bold 24px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('M\u00d8RKE!', W / 2, H * 0.4)
    }
    // Shrink
    if (jimPrankActive === 'shrink') {
      c.fillStyle = '#E84393'; c.font = 'bold 12px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('MINI-B\u00c5D!', W / 2, boatY - 50)
    }
    // Invisible ball
    if (jimPrankActive === 'invisible_ball') {
      c.fillStyle = '#8B2030'; c.font = 'bold 14px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('USYNLIGT HOVED!', W / 2, H * 0.35)
    }
    // PIA RINGER!
    if (piaActive) {
      // Pink speech bubble
      c.fillStyle = 'rgba(255, 105, 180, 0.15)'; c.fillRect(0, 0, W, H)
      c.fillStyle = '#FF69B4'; c.font = 'bold 18px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('PIA: LARS! DU M\u00c5 IKKE K\u00d8BE EN PORSCHE!', W / 2, H * 0.4)
      c.fillStyle = '#FF1493'; c.font = '12px "DM Sans"'
      c.fillText('(B\u00e5den er frosset!)', W / 2, H * 0.4 + 22)
    }
    // Ghost paddle at top
    if (ghostPaddleActive) {
      c.globalAlpha = 0.3
      c.fillStyle = '#8B2030'
      c.beginPath(); c.roundRect(boatX + 20, 195, 200, 10, 5); c.fill()
      c.fillStyle = '#CC3040'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('GHOST B\u00c5D', boatX + 120, 190)
      c.globalAlpha = 1
    }
    // Big/Tyk Lars (blocks view partially)
    if (bigLarsActive) {
      c.globalAlpha = 0.3
      // Giant Lars silhouette
      c.fillStyle = '#D4A574'
      c.beginPath(); c.arc(W / 2, H * 0.5, 120, 0, Math.PI * 2); c.fill() // head
      c.fillStyle = '#1A1A1A'
      c.beginPath(); c.roundRect(W / 2 - 60, H * 0.5 - 160, 120, 40, 20); c.fill() // beanie
      c.fillStyle = '#2A1A0A'
      c.beginPath(); c.roundRect(W / 2 - 40, H * 0.5 + 20, 80, 50, 10); c.fill() // beard
      c.fillStyle = '#0A0A0A'
      c.beginPath(); c.roundRect(W / 2 - 35, H * 0.5 - 20, 30, 15, 5); c.fill() // sunglasses L
      c.beginPath(); c.roundRect(W / 2 + 5, H * 0.5 - 20, 30, 15, 5); c.fill() // sunglasses R
      c.globalAlpha = 1
    }
    // Extra balls rendering
    for (const eb of extraBalls) {
      if (!eb.active) continue
      c.fillStyle = '#E0C8A0'; c.beginPath(); c.arc(eb.x, eb.y, 10, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#F5A623'; c.beginPath(); c.arc(eb.x + 3, eb.y - 2, 2, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#8B7355'; c.lineWidth = 1.5
      c.beginPath(); c.moveTo(eb.x - 8, eb.y - 5); c.lineTo(eb.x - 12, eb.y - 12); c.stroke()
      c.beginPath(); c.moveTo(eb.x + 8, eb.y - 5); c.lineTo(eb.x + 12, eb.y - 12); c.stroke()
    }
    // Drunk indicator
    if (jimPrankActive === 'drunk') {
      c.fillStyle = '#F5A623'; c.font = 'bold 14px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('INVERTERET!', W / 2, boatY - 50)
    }
  }

  // ==================== HUD ====================
  c.fillStyle = 'rgba(10, 15, 10, 0.7)'; c.fillRect(0, 0, W, 48)
  c.strokeStyle = 'rgba(139, 32, 32, 0.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 48); c.lineTo(W, 48); c.stroke()

  c.font = 'bold 11px "Space Grotesk"'; c.textAlign = 'left'
  c.fillStyle = '#8B2020'; c.fillText(LEVEL_NAMES[currentLevel.value - 1] || '', 14, 16)
  c.fillStyle = '#CCC'; c.font = 'bold 14px "Space Grotesk"'; c.fillText(`Score: ${score.value}`, 14, 36)

  // Collectibles
  c.textAlign = 'center'
  c.font = 'bold 11px "Space Grotesk"'
  const req = OL_REQ[currentLevel.value - 1]
  c.fillStyle = levelOl.value >= req ? '#00D68F' : '#F5A623'
  c.fillText(`🍺 ${levelOl.value}/${req}`, W / 2 - 40, 20)
  c.fillStyle = '#E84393'; c.fillText(`J: ${levelJim.value}`, W / 2 + 10, 20)
  c.fillStyle = '#FFF'; c.fillText(`🐕 ${levelDal.value}`, W / 2 + 50, 20)

  // Lives (heart icon + number)
  c.textAlign = 'right'
  c.fillStyle = '#CC2020'; c.font = '14px sans-serif'
  c.fillText('♥', W - 40, 20)
  c.fillStyle = '#CCC'; c.font = 'bold 13px "Space Grotesk"'
  c.fillText(`${lives.value}`, W - 14, 20)

  // Level 5 HUD - lives, ammo, items, controls
  if (currentLevel.value === 5 && gameState.value === 'playing') {
    // Lives - top right, big
    c.textAlign = 'right'
    c.fillStyle = '#CC2020'; c.font = 'bold 16px sans-serif'
    c.fillText('\u2665', W - 50, 36)
    c.fillStyle = '#EEE'; c.font = 'bold 16px "Space Grotesk"'
    c.fillText(`${lives.value}`, W - 14, 36)

    // Ammo - under lives, gold when available
    c.fillStyle = odinBounces > 0 ? '#F5A623' : '#555'; c.font = 'bold 13px "Space Grotesk"'
    c.fillText(`Skud: ${odinBounces}`, W - 14, 56)
    if (odinBounces > 0) {
      const pulse = 0.5 + Math.sin(time.value * 4) * 0.5
      c.fillStyle = `rgba(245, 166, 35, ${pulse})`; c.font = 'bold 10px "Space Grotesk"'
      c.fillText('[ SPACE ]', W - 14, 70)
    }

    // Items progress - bottom center
    const remaining = items.filter(i => !i.collected).length
    const total = items.length
    const pct = Math.round(((total - remaining) / total) * 100)
    c.fillStyle = '#AAA'; c.font = '11px "DM Sans"'; c.textAlign = 'center'
    c.fillText(`${total - remaining}/${total} ramt (${pct}%)`, W / 2, H - 8)

    // Controls (first 8 seconds)
    if (time.value < 8) {
      c.fillStyle = 'rgba(200, 150, 150, 0.6)'; c.font = 'bold 14px "DM Sans"'; c.textAlign = 'center'
      c.fillText('\u2190 \u2192 Styr b\u00e5den', W / 2, H * 0.42)
      c.fillStyle = 'rgba(200, 150, 150, 0.5)'; c.font = '13px "DM Sans"'
      c.fillText('Bounce = optjen skud  |  SPACE = Skyd!', W / 2, H * 0.42 + 22)
    }
  }

  // Boss HP bar (works for any boss type)
  const boss = enemies.find(e => (e.type === 'boss' || e.type === 'boss_deer' || e.type === 'boss_berserker' || e.type === 'boss_fire') && e.alive)
  if (boss && gameState.value === 'boss') {
    const maxHp = boss.type === 'boss' ? 6 : boss.type === 'boss_berserker' ? (boss.phase >= 3 ? 3 : boss.phase >= 2 ? 5 : 7) : boss.type === 'boss_fire' ? 8 : 5
    const bossName = boss.type === 'boss' ? 'SURTR - BØDDELEN'
      : boss.type === 'boss_berserker' ? 'DRAUGR - DEN UDØDELIGE'
      : boss.type === 'boss_fire' ? 'SINMARA - BLÓTMODEREN'
      : 'EIKÞYRNIR - HJORTEÅNDEN'
    const barW = W * 0.5, barH = 8
    const barX = (W - barW) / 2, barY = 54
    c.fillStyle = 'rgba(10, 15, 10, 0.8)'; c.fillRect(barX - 4, barY - 4, barW + 8, barH + 14)
    c.fillStyle = '#333'; c.beginPath(); c.roundRect(barX, barY, barW, barH, 4); c.fill()
    const hpColor = boss.type === 'boss_deer' ? '#44AA44' : '#CC2020'
    c.fillStyle = hpColor; c.beginPath(); c.roundRect(barX, barY, barW * (boss.hp / maxHp), barH, 4); c.fill()
    c.fillStyle = '#999'; c.font = 'bold 9px "Space Grotesk"'; c.textAlign = 'center'
    c.fillText(bossName, W / 2, barY + barH + 12)
  }

  // ==================== CUTSCENE OVERLAY ====================
  if (gameState.value === 'cutscene' && cutsceneLines.value.length > 0) {
    c.fillStyle = 'rgba(0, 0, 0, 0.6)'; c.fillRect(0, 0, W, H)

    const line = cutsceneLines.value[cutsceneIndex.value]
    if (line) {
      // Dialog box - LARGER
      const boxH = 150, boxY = H - boxH - 16
      c.fillStyle = 'rgba(10, 14, 10, 0.96)'
      c.beginPath(); c.roundRect(14, boxY, W - 28, boxH, 14); c.fill()
      c.strokeStyle = 'rgba(139, 32, 32, 0.5)'; c.lineWidth = 2
      c.beginPath(); c.roundRect(14, boxY, W - 28, boxH, 14); c.stroke()

      // ============ JIM LYNGVILD PORTRAIT ============
      // Ikoniske træk: fuldstændig skaldet, glatbarberet, skarp kæbe,
      // piercing blå øjne, mørke brune bryn, Celtic-tattoo på hals, ørering
      const portR = 28
      const portX = 54, portY = boxY + 42
      const isLoke = line.speaker === 'loke'

      // Glow bag portrættet (rød for Jim, giftig grøn for Loke)
      const glowCol = isLoke ? 'rgba(60, 200, 120, 0.25)' : 'rgba(139, 32, 32, 0.2)'
      const glowGrad = c.createRadialGradient(portX, portY, portR * 0.5, portX, portY, portR + 10)
      glowGrad.addColorStop(0, glowCol)
      glowGrad.addColorStop(1, 'transparent')
      c.fillStyle = glowGrad
      c.beginPath(); c.arc(portX, portY, portR + 10, 0, Math.PI * 2); c.fill()

      // Hals / skuldre (sort læderjakke — Jims signatur)
      c.fillStyle = '#0D0D10'
      c.beginPath()
      c.moveTo(portX - portR + 2, portY + portR - 4)
      c.lineTo(portX - portR - 6, portY + portR + 14)
      c.lineTo(portX + portR + 6, portY + portR + 14)
      c.lineTo(portX + portR - 2, portY + portR - 4)
      c.closePath()
      c.fill()
      // Læder-highlight
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1
      c.beginPath(); c.moveTo(portX - portR - 4, portY + portR + 10); c.lineTo(portX + portR + 4, portY + portR + 10); c.stroke()

      // Halstattoo (Celtic knudedesign) — synlig under kæben
      c.strokeStyle = isLoke ? '#8B2B4A' : '#3A1515'
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(portX - 10, portY + portR - 2)
      c.quadraticCurveTo(portX - 6, portY + portR + 4, portX, portY + portR)
      c.quadraticCurveTo(portX + 6, portY + portR + 4, portX + 10, portY + portR - 2)
      c.stroke()

      // Hoved — æg-form (skaldet, mere pointet end cirkel)
      c.save()
      c.translate(portX, portY)
      c.scale(1, 1.08) // en anelse aflang for skalle-form
      // Hud base
      const skinGrad = c.createRadialGradient(-portR * 0.3, -portR * 0.3, 2, 0, 0, portR)
      skinGrad.addColorStop(0, isLoke ? '#D4C8B8' : '#F2DCC4')
      skinGrad.addColorStop(0.7, isLoke ? '#B8A590' : '#DDBD9E')
      skinGrad.addColorStop(1, isLoke ? '#8B7560' : '#A88066')
      c.fillStyle = skinGrad
      c.beginPath(); c.arc(0, 0, portR, 0, Math.PI * 2); c.fill()
      c.restore()

      // Kindskygge (Jim har markerede kindben)
      c.fillStyle = 'rgba(80, 40, 30, 0.18)'
      c.beginPath(); c.ellipse(portX - 14, portY + 5, 5, 8, -0.3, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.ellipse(portX + 14, portY + 5, 5, 8, 0.3, 0, Math.PI * 2); c.fill()

      // Skalle-highlight (glans på det skaldede hoved — VIGTIGT for Jim-look)
      const shineGrad = c.createRadialGradient(portX - 6, portY - portR * 0.65, 0, portX - 6, portY - portR * 0.65, 10)
      shineGrad.addColorStop(0, 'rgba(255, 250, 240, 0.55)')
      shineGrad.addColorStop(1, 'transparent')
      c.fillStyle = shineGrad
      c.beginPath(); c.ellipse(portX - 4, portY - portR * 0.55, 10, 6, -0.2, 0, Math.PI * 2); c.fill()

      // Pande-tattoo (lille Celtic-rune — subtil)
      c.strokeStyle = isLoke ? '#D04030' : '#6B2020'
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(portX - 3, portY - portR * 0.75)
      c.lineTo(portX + 3, portY - portR * 0.75)
      c.moveTo(portX, portY - portR * 0.78)
      c.lineTo(portX, portY - portR * 0.68)
      c.stroke()

      // Øre + sølv-ørering (venstre øre synlig)
      c.fillStyle = isLoke ? '#B8A590' : '#D8B090'
      c.beginPath(); c.ellipse(portX - portR + 2, portY + 2, 3, 5, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#D8D8DC'
      c.beginPath(); c.arc(portX - portR + 1, portY + 7, 1.5, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#888'
      c.beginPath(); c.arc(portX - portR + 1, portY + 7, 0.6, 0, Math.PI * 2); c.fill()

      // Øjenbryn — skarpe, mørke, let bue (Jims signatur)
      c.strokeStyle = isLoke ? '#1A0808' : '#2A1808'
      c.lineWidth = 2
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(portX - 12, portY - 7)
      c.quadraticCurveTo(portX - 7, portY - 10, portX - 2, portY - 8)
      c.stroke()
      c.beginPath()
      c.moveTo(portX + 2, portY - 8)
      c.quadraticCurveTo(portX + 7, portY - 10, portX + 12, portY - 7)
      c.stroke()
      c.lineCap = 'butt'

      // Øjne — smalle, intense, lysende blå (eller rød-grøn for Loke)
      // Øjen-hvide
      c.fillStyle = '#F0EADA'
      c.beginPath(); c.ellipse(portX - 7, portY - 2, 3.5, 2.2, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.ellipse(portX + 7, portY - 2, 3.5, 2.2, 0, 0, Math.PI * 2); c.fill()
      // Iris
      const irisCol = isLoke ? '#C62828' : '#2E7FB8'
      c.fillStyle = irisCol
      c.beginPath(); c.arc(portX - 7, portY - 2, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(portX + 7, portY - 2, 2, 0, Math.PI * 2); c.fill()
      // Pupil
      c.fillStyle = '#000'
      c.beginPath(); c.arc(portX - 7, portY - 2, 1, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(portX + 7, portY - 2, 1, 0, Math.PI * 2); c.fill()
      // Øjenglimt (gør det "intens" look)
      c.fillStyle = '#FFF'
      c.beginPath(); c.arc(portX - 7.5, portY - 2.6, 0.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(portX + 6.5, portY - 2.6, 0.5, 0, Math.PI * 2); c.fill()
      // Løftet øjeglow for Loke
      if (isLoke) {
        c.fillStyle = 'rgba(255, 60, 40, 0.4)'
        c.beginPath(); c.arc(portX - 7, portY - 2, 4, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(portX + 7, portY - 2, 4, 0, Math.PI * 2); c.fill()
      }

      // Næse — skarp, lige (Jim har tydelig profil)
      c.strokeStyle = 'rgba(120, 70, 50, 0.5)'
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(portX, portY - 4)
      c.lineTo(portX - 1.5, portY + 4)
      c.lineTo(portX + 1.5, portY + 4)
      c.stroke()

      // Mund — tynd, stramt sammenpresset (Jim er glatbarberet)
      c.strokeStyle = '#8B4A3A'
      c.lineWidth = 1.2
      c.lineCap = 'round'
      c.beginPath()
      if (isLoke) {
        // Ondt grin for Loke
        c.moveTo(portX - 6, portY + 10)
        c.quadraticCurveTo(portX, portY + 14, portX + 6, portY + 10)
      } else {
        // Neutral/stramt for Jim
        c.moveTo(portX - 5, portY + 11)
        c.lineTo(portX + 5, portY + 11)
      }
      c.stroke()
      c.lineCap = 'butt'

      // Let hagekløft/haglinje for at definere kæben uden skæg
      c.strokeStyle = 'rgba(80, 40, 30, 0.25)'
      c.lineWidth = 0.8
      c.beginPath()
      c.moveTo(portX, portY + 15)
      c.lineTo(portX, portY + 17)
      c.stroke()

      // Horn for Loke (vokser ud af skallen)
      if (isLoke) {
        c.fillStyle = '#3A0A0A'
        c.strokeStyle = '#1A0404'
        c.lineWidth = 0.8
        // Venstre horn
        c.beginPath()
        c.moveTo(portX - 12, portY - portR + 4)
        c.quadraticCurveTo(portX - 18, portY - portR - 6, portX - 14, portY - portR - 12)
        c.quadraticCurveTo(portX - 10, portY - portR - 4, portX - 8, portY - portR + 2)
        c.closePath()
        c.fill(); c.stroke()
        // Højre horn
        c.beginPath()
        c.moveTo(portX + 12, portY - portR + 4)
        c.quadraticCurveTo(portX + 18, portY - portR - 6, portX + 14, portY - portR - 12)
        c.quadraticCurveTo(portX + 10, portY - portR - 4, portX + 8, portY - portR + 2)
        c.closePath()
        c.fill(); c.stroke()
      }

      // Speaker name - BIGGER
      c.fillStyle = '#9E3030'; c.font = 'bold 14px "Space Grotesk"'; c.textAlign = 'left'
      c.fillText(line.speaker === 'loke' ? 'LOKE' : 'JIM LYNGVILD', portX + portR + 14, boxY + 26)

      // Text (typewriter) - BIGGER
      c.fillStyle = '#E8E8E8'; c.font = '16px "DM Sans"'
      const maxW = W - portX - portR - 50
      const words = typewriterText.value.split(' ')
      let textLine = '', textY = boxY + 50
      const textX = portX + portR + 14
      for (const word of words) {
        const test = textLine + word + ' '
        if (c.measureText(test).width > maxW) {
          c.fillText(textLine.trim(), textX, textY)
          textLine = word + ' '; textY += 22
        } else { textLine = test }
      }
      c.fillText(textLine.trim(), textX, textY)

      // Continue indicator - MUCH MORE VISIBLE
      if (typewriterDone.value) {
        // Pulsing button-like indicator
        const pulse = 0.7 + Math.sin(time.value * 4) * 0.3
        c.fillStyle = `rgba(139, 32, 32, ${pulse})`
        c.beginPath(); c.roundRect(W - 190, boxY + boxH - 36, 170, 28, 8); c.fill()
        c.fillStyle = '#EEE'; c.font = 'bold 12px "Space Grotesk"'; c.textAlign = 'center'
        c.fillText('TRYK FOR AT FORTSÆTTE ▸', W - 105, boxY + boxH - 18)
      }
    }
  }

  // ==================== LEVEL COMPLETE / GAME COMPLETE ====================
  if (gameState.value === 'levelcomplete') {
    c.fillStyle = 'rgba(5, 10, 5, 0.92)'; c.fillRect(0, 0, W, H)

    if (currentLevel.value === 6) {
      // GAME COMPLETE - Special Valhalla ending
      c.fillStyle = '#C9A84C'; c.font = 'bold 28px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('LARS OG VEJEN TIL VALHALLA', W / 2, H * 0.18)
      c.fillStyle = '#8B2020'; c.font = 'bold 20px "Space Grotesk"'
      c.fillText('GENNEMF\u00d8RT', W / 2, H * 0.18 + 35)
      c.fillStyle = '#CCC'; c.font = '14px "DM Sans"'
      c.fillText('Lars fandt vejen ud af Valhalla.', W / 2, H * 0.35)
      c.fillText('Eller gjorde han?', W / 2, H * 0.35 + 22)
      c.fillStyle = '#888'; c.font = '13px "DM Sans"'
      c.fillText(`Final Score: ${score.value}`, W / 2, H * 0.48)
      c.fillText('Tak for at spille.', W / 2, H * 0.48 + 24)
      c.fillStyle = '#555'; c.font = '11px "DM Sans"'
      c.fillText('Skabt af Lars\u2019 venner med k\u00e6rlighed, \u00f8l og Jim Lyngvild.', W / 2, H * 0.56)
      // Buttons
      const pp = 0.5 + Math.sin(time.value * 3) * 0.3
      c.fillStyle = `rgba(201, 168, 76, ${pp})`; c.beginPath(); c.roundRect(W / 2 - 100, H * 0.68, 200, 36, 10); c.fill()
      c.fillStyle = '#1A1208'; c.font = 'bold 13px "Space Grotesk"'
      c.fillText('SPIL IGEN', W / 2, H * 0.68 + 22)
      c.fillStyle = '#666'; c.font = '11px "DM Sans"'
      c.fillText('(Tryk for at forts\u00e6tte)', W / 2, H * 0.78)
    } else {

    const lvlName = LEVEL_NAMES[currentLevel.value - 1] || ''
    c.fillStyle = '#8B2020'; c.font = 'bold 22px "Space Grotesk"'; c.textAlign = 'center'
    c.fillText(`${lvlName} KLARET`, W / 2, H * 0.22)
    c.fillStyle = '#F5A623'; c.font = 'bold 18px "Space Grotesk"'
    c.fillText('\u{1F37A} SKÅL!', W / 2, H * 0.22 + 38)

    c.fillStyle = '#CCC'; c.font = '15px "DM Sans"'
    c.fillText(`\u{1F37A} \u00d8l: ${levelOl.value}`, W / 2, H * 0.42)
    c.fillText(`Jim: ${levelJim.value}`, W / 2, H * 0.42 + 26)
    c.fillText(`\u{1F436} Hunde: ${levelDal.value}`, W / 2, H * 0.42 + 52)
    c.fillStyle = '#888'; c.fillText(`Score: ${score.value}`, W / 2, H * 0.42 + 84)

    // Next level teaser
    const nextLvl = currentLevel.value < 6 ? LEVEL_NAMES[currentLevel.value] : 'VALHALLA'
    c.fillStyle = '#8B2020'; c.font = 'bold 14px "Space Grotesk"'
    c.fillText(`${nextLvl} venter...`, W / 2, H * 0.72)

    const pulse = 0.5 + Math.sin(time.value * 3) * 0.3
    c.fillStyle = `rgba(139, 32, 32, ${pulse})`
    c.beginPath(); c.roundRect(W / 2 - 100, H * 0.76, 200, 36, 10); c.fill()
    c.fillStyle = '#EEE'; c.font = 'bold 13px "Space Grotesk"'
    c.fillText('TRYK FOR AT FORTS\u00c6TTE \u25b8', W / 2, H * 0.76 + 21)
    } // end else (non-level-6 levelcomplete)
  }

  // ==================== PAUSE ====================
  if (gameState.value === 'paused') {
    c.fillStyle = 'rgba(5, 5, 5, 0.85)'; c.fillRect(0, 0, W, H)
    c.fillStyle = '#8B2020'; c.font = 'bold 28px "Space Grotesk"'; c.textAlign = 'center'
    c.fillText('PAUSE', W / 2, H * 0.35)
    c.fillStyle = '#888'; c.font = '14px "DM Sans"'
    c.fillText(`Kapitel ${currentLevel.value}: ${LEVEL_NAMES[currentLevel.value - 1]}`, W / 2, H * 0.35 + 35)
    c.fillStyle = '#CCC'; c.font = '14px "Space Grotesk"'
    c.fillText(`Score: ${score.value}`, W / 2, H * 0.5)
    c.fillStyle = '#F5A623'; c.font = '12px "DM Sans"'
    c.fillText(`\u{1F37A} ${levelOl.value}  |  Jim: ${levelJim.value}  |  \u{1F436} ${levelDal.value}`, W / 2, H * 0.5 + 28)
    const pp = 0.5 + Math.sin(time.value * 3) * 0.3
    c.fillStyle = `rgba(200, 180, 160, ${pp})`; c.font = 'bold 16px "Space Grotesk"'
    c.fillText('TRYK FOR AT FORTS\u00c6TTE', W / 2, H * 0.65)
    c.fillStyle = '#555'; c.font = '11px "DM Sans"'
    c.fillText('ESC / P = Pause', W / 2, H * 0.65 + 25)
  }

  // ==================== DEATH ====================
  if (gameState.value === 'dead') {
    c.fillStyle = 'rgba(10, 5, 5, 0.92)'; c.fillRect(0, 0, W, H)

    // Blood-red title
    c.fillStyle = '#8B2020'; c.font = 'bold 32px "Space Grotesk"'; c.textAlign = 'center'
    c.fillText('FALDET', W / 2, H * 0.26)

    // Jim's death quote - SINGLE, LARGE, READABLE
    c.fillStyle = '#BBBBBB'; c.font = 'italic 16px "DM Sans"'
    c.fillText(`"${deathQuote}"`, W / 2, H * 0.26 + 44)

    // Jim attribution
    c.fillStyle = '#8B2020'; c.font = 'bold 10px "Space Grotesk"'
    c.fillText('— JIM', W / 2, H * 0.26 + 68)

    // Reassurance: you only restart THIS chapter, not the whole game
    const lvlName = LEVEL_NAMES[currentLevel.value - 1] || ''
    c.fillStyle = '#C9A84C'; c.font = 'bold 16px "Space Grotesk"'
    c.fillText(`Du vender tilbage til Kapitel ${currentLevel.value}`, W / 2, H * 0.46)
    c.fillStyle = '#888'; c.font = '13px "DM Sans"'
    c.fillText(`"${lvlName}"`, W / 2, H * 0.46 + 22)

    // Score preserved
    c.fillStyle = '#CCC'; c.font = 'bold 18px "Space Grotesk"'
    c.fillText(`Score: ${score.value}`, W / 2, H * 0.58)
    c.fillStyle = '#666'; c.font = '11px "DM Sans"'
    c.fillText('(Din score bevares)', W / 2, H * 0.58 + 18)

    // Retry button (only after delay)
    if (deadDelay <= 0) {
      const pulse = 0.5 + Math.sin(time.value * 3) * 0.3
      c.fillStyle = `rgba(139, 32, 32, ${pulse})`
      c.beginPath(); c.roundRect(W / 2 - 120, H * 0.7, 240, 42, 10); c.fill()
      c.fillStyle = '#EEE'; c.font = 'bold 14px "Space Grotesk"'
      c.fillText(`TILBAGE TIL KAPITEL ${currentLevel.value}`, W / 2, H * 0.7 + 25)
    } else {
      c.fillStyle = '#444'; c.font = '12px "DM Sans"'
      c.fillText('Vent...', W / 2, H * 0.72)
    }
  }

  // ==================== LOADING ====================
  if (gameState.value === 'loading') {
    c.fillStyle = '#0A0F0A'; c.fillRect(0, 0, W, H)

    // Subtle red glow in center
    const loadGlow = c.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 200)
    loadGlow.addColorStop(0, 'rgba(139, 32, 32, 0.08)')
    loadGlow.addColorStop(1, 'transparent')
    c.fillStyle = loadGlow; c.fillRect(0, 0, W, H)

    c.textAlign = 'center'

    // Title
    c.fillStyle = '#8B2020'; c.font = 'bold 28px "Space Grotesk"'
    c.fillText('LARS OG VEJEN TIL VALHALLA', W / 2, H * 0.35)

    // Chapter
    const lvlName = LEVEL_NAMES[currentLevel.value - 1] || ''
    c.fillStyle = '#AA8888'; c.font = '16px "DM Sans"'
    c.fillText(`Kapitel ${currentLevel.value}: ${lvlName}`, W / 2, H * 0.35 + 40)

    // Divider line
    c.strokeStyle = 'rgba(139, 32, 32, 0.3)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(W / 2 - 80, H * 0.35 + 60); c.lineTo(W / 2 + 80, H * 0.35 + 60); c.stroke()

    // Start prompt - large and pulsing
    const startPulse = 0.6 + Math.sin(time.value * 3) * 0.4
    c.fillStyle = `rgba(200, 180, 160, ${startPulse})`; c.font = 'bold 18px "Space Grotesk"'
    c.fillText('TRYK FOR AT BEGYNDE', W / 2, H * 0.55)

    c.fillStyle = '#555'; c.font = '12px "DM Sans"'
    c.fillText('Space / Klik / Tap', W / 2, H * 0.55 + 28)

    // Highscore display (Fase 8)
    if (highscore.value > 0) {
      c.fillStyle = '#C9A84C'; c.font = 'bold 14px "Space Grotesk"'
      c.fillText(`Rekord: ${highscore.value}`, W / 2, H * 0.68)
    }
  }

  // ==================== CREDITS SCROLL (Fase 8) ====================
  if (gameState.value === 'credits') {
    // Deep night sky background
    const g = c.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#0a0512')
    g.addColorStop(0.5, '#1a0a20')
    g.addColorStop(1, '#0a0612')
    c.fillStyle = g; c.fillRect(0, 0, W, H)

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = (i * 137 + time.value * 3) % W
      const sy = (i * 91) % H
      const twinkle = 0.3 + Math.sin(time.value * 2 + i) * 0.3
      c.fillStyle = `rgba(255, 240, 200, ${twinkle})`
      c.fillRect(sx, sy, 1.5, 1.5)
    }

    // Flying ravens (simple silhouettes)
    for (let i = 0; i < 4; i++) {
      const rx = ((time.value * 20 + i * 300) % (W + 200)) - 100
      const ry = 80 + i * 50 + Math.sin(time.value * 2 + i) * 15
      c.fillStyle = '#000'
      c.save()
      c.translate(rx, ry)
      const flap = Math.sin(time.value * 8 + i) * 6
      c.beginPath()
      c.moveTo(0, 0)
      c.lineTo(-12, -4 - flap)
      c.lineTo(-8, 0)
      c.lineTo(-12, 4 + flap)
      c.lineTo(0, 0)
      c.lineTo(12, -4 - flap)
      c.lineTo(8, 0)
      c.lineTo(12, 4 + flap)
      c.fill()
      c.restore()
    }

    // Credits text (scrolls up)
    creditsScrollY += 25 * (1 / 60)
    const CREDITS_LINES: { text: string; size: number; color: string; bold?: boolean; gap: number }[] = [
      { text: 'LARS OG VEJEN TIL VALHALLA', size: 32, color: '#C9A84C', bold: true, gap: 60 },
      { text: '', size: 14, color: '#fff', gap: 40 },
      { text: 'Lars har besejret Loke og er vendt hjem.', size: 16, color: '#ddd', gap: 30 },
      { text: 'Ravnene flyver over Midgård, og mjøden flyder.', size: 16, color: '#ddd', gap: 80 },
      { text: '— MEDVIRKENDE —', size: 18, color: '#C9A84C', bold: true, gap: 50 },
      { text: 'Lars Grundvad', size: 22, color: '#fff', bold: true, gap: 4 },
      { text: 'som Sig Selv', size: 14, color: '#aaa', gap: 40 },
      { text: 'Jim Lyngvild', size: 22, color: '#fff', bold: true, gap: 4 },
      { text: 'som Sig Selv', size: 14, color: '#aaa', gap: 40 },
      { text: 'Loke', size: 22, color: '#fff', bold: true, gap: 4 },
      { text: 'som Jim Lyngvild', size: 14, color: '#aaa', gap: 40 },
      { text: 'Odin Alfader', size: 20, color: '#fff', bold: true, gap: 4 },
      { text: 'som Kongen af Valhalla', size: 14, color: '#aaa', gap: 40 },
      { text: 'Surtr, Hjortemanden, Draugr & Sinmara', size: 18, color: '#fff', gap: 4 },
      { text: 'som Fjenderne', size: 14, color: '#aaa', gap: 80 },
      { text: '— INSPIRATION —', size: 18, color: '#C9A84C', bold: true, gap: 50 },
      { text: 'Nordisk Mytologi', size: 16, color: '#ddd', gap: 25 },
      { text: 'Porsche 911', size: 16, color: '#ddd', gap: 25 },
      { text: 'Danske Sofa-Søndage', size: 16, color: '#ddd', gap: 80 },
      { text: '— SKABT AF —', size: 18, color: '#C9A84C', bold: true, gap: 50 },
      { text: 'Simon & Claude', size: 22, color: '#fff', bold: true, gap: 4 },
      { text: '2026', size: 14, color: '#aaa', gap: 80 },
      { text: 'Tak fordi du spillede.', size: 18, color: '#C9A84C', gap: 40 },
      { text: `Rekord: ${highscore.value}`, size: 16, color: '#fff', gap: 80 },
      { text: 'TRYK FOR AT SPILLE IGEN', size: 14, color: '#888', gap: 200 },
    ]
    c.textAlign = 'center'
    let yOffset = H - creditsScrollY
    for (const line of CREDITS_LINES) {
      if (yOffset > -40 && yOffset < H + 40) {
        c.fillStyle = line.color
        c.font = `${line.bold ? 'bold ' : ''}${line.size}px "Space Grotesk"`
        c.fillText(line.text, W / 2, yOffset)
      }
      yOffset += line.size + line.gap
    }
    // Loop credits
    if (creditsScrollY > H + 2000) creditsScrollY = 0
  }

  // ==================== LEVEL TRANSITION FADE (Fase 6) ====================
  // Drawn on top of everything (incl HUD) for seamless act transitions
  if (levelFade > 0) {
    c.fillStyle = `rgba(6, 4, 10, ${Math.min(1, levelFade)})`
    c.fillRect(0, 0, W, H)
    // "Videre, Lars..." bridge text at peak darkness
    if (levelFade > 0.5) {
      c.globalAlpha = Math.min(1, (levelFade - 0.5) * 2)
      c.fillStyle = '#C9A84C'
      c.font = 'bold 20px "Space Grotesk"'
      c.textAlign = 'center'
      c.fillText('Videre, Lars...', W / 2, H * 0.5)
      c.globalAlpha = 1
    }
  }
}

// ==================== INPUT ====================
function onKeyDown(e: KeyboardEvent) {
  keysDown.add(e.code)
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); tapped = true }

  // Cutscene advance - only on initial keydown, NOT on key repeat
  if (gameState.value === 'cutscene' && !e.repeat) { e.preventDefault(); advanceCutscene(); return }

  // PAUSE (Escape or P)
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (gameState.value === 'playing' || gameState.value === 'boss') {
      gameState.value = 'paused'
    } else if (gameState.value === 'paused') {
      gameState.value = 'playing'
    }
    return
  }

  if (e.repeat) return // Ignore key repeats for all state transitions
  if (gameState.value === 'paused') { gameState.value = 'playing'; return }
  if (gameState.value === 'loading') { startGame() }
  else if (gameState.value === 'dead' && deadDelay <= 0) { resetLevel() }
  else if (gameState.value === 'levelcomplete') { advanceLevel() }
  else if (gameState.value === 'credits' && creditsScrollY > 200) { restartFromCredits() }
}

function onKeyUp(e: KeyboardEvent) { keysDown.delete(e.code) }

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  tapped = true
  if (gameState.value === 'cutscene') advanceCutscene()
  else if (gameState.value === 'loading') startGame()
  else if (gameState.value === 'dead' && deadDelay <= 0) resetLevel()
  else if (gameState.value === 'levelcomplete') gameState.value = 'loading'
  else if (gameState.value === 'credits' && creditsScrollY > 200) restartFromCredits()
}

function onMouseDown() {
  tapped = true
  if (gameState.value === 'cutscene') advanceCutscene()
  else if (gameState.value === 'loading') startGame()
  else if (gameState.value === 'dead' && deadDelay <= 0) resetLevel()
  else if (gameState.value === 'levelcomplete') gameState.value = 'loading'
  else if (gameState.value === 'credits' && creditsScrollY > 200) restartFromCredits()
}

function restartFromCredits() {
  creditsScrollY = 0
  currentLevel.value = 1
  lives.value = 10
  score.value = 0
  loadLevelImages(1)
  gameState.value = 'loading'
}

// ==================== GAME LIFECYCLE ====================
function startGame() {
  // URL parameter for direct level access: ?level=2
  const route = useRoute()
  const lvlParam = Number(route.query.level)
  currentLevel.value = (lvlParam >= 1 && lvlParam <= 6) ? lvlParam : 1
  loadLevelImages(currentLevel.value)
  initLevel()
  const dialog = getLevelDialog('intro')
  if (dialog) startCutscene(dialog, () => { gameState.value = 'playing' })
  else gameState.value = 'playing'
}

function initLevel() {
  px = 60; py = H - 200; pvx = 0; pvy = 0; onGround = false; facing = 1
  invTimer = 0; playerPower = 'none'; powerTimer = 0
  levelOl.value = 0; levelJim.value = 0; levelDal.value = 0
  goalReached = false; cameraX = 0; checkpointX = 60
  time.value = 0; particles = []; deadDelay = 0

  if (currentLevel.value === 1) buildLevel1()
  else if (currentLevel.value === 2) buildLevel2()
  else if (currentLevel.value === 3) buildLevel3()
  else if (currentLevel.value === 4) buildLevel4()
  else if (currentLevel.value === 5) buildLevel5()
  else if (currentLevel.value === 6) buildLevel6()

  gameState.value = 'playing'
}

function resetLevel() {
  // Du ryger KUN tilbage til start af nuværende kapitel — aldrig til kapitel 1.
  // Score og totale progress fra tidligere kapitler bevares.
  lives.value = 10
  initLevel()
}

function advanceLevel() {
  if (pendingLevelAdvance) return
  // Persist highscore on every level advance (Fase 8)
  maybeSaveHighscore()
  // Start fade-out transition
  pendingLevelAdvance = true
  levelFadeDir = -1
  levelFade = 0
}

function doActualAdvanceLevel() {
  currentLevel.value++
  if (currentLevel.value > 6) {
    gameState.value = 'credits'
    creditsScrollY = 0
    pendingLevelAdvance = false
    return
  }
  loadLevelImages(currentLevel.value)
  initLevel()
  const dialog = getLevelDialog('intro')
  if (dialog) startCutscene(dialog, () => { gameState.value = 'playing' })
  // Start fade-in
  levelFadeDir = 1
  levelFade = 1
  pendingLevelAdvance = false
}

function getLevelDialog(key: string) {
  const lvlKey = `level${currentLevel.value}` as keyof typeof jimData
  const lvlData = jimData[lvlKey] as any
  return lvlData?.[key] || null
}

function loadLevelImages(lvl: number) {
  // Clear old images first so fallback gradient shows while loading
  bgFar.value = null
  bgMid.value = null
  bgNear.value = null
  const prefix = `/images/valhalla/level${lvl}-bg`
  const far = new Image(); far.src = `${prefix}-far.jpg`
  far.onload = () => { bgFar.value = far }
  const mid = new Image(); mid.src = `${prefix}-mid.jpg`
  mid.onload = () => { bgMid.value = mid }
  const near = new Image(); near.src = `${prefix}-near.jpg`
  near.onload = () => { bgNear.value = near }
}

// ==================== GAME LOOP ====================
function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05)
  lastTime = timestamp
  update(dt)
  render()
  animFrame = requestAnimationFrame(gameLoop)
}

// Highscore helpers (Fase 8)
function loadHighscore() {
  if (typeof window === 'undefined') return
  const raw = window.localStorage.getItem('valhalla-highscore')
  const n = Number(raw)
  highscore.value = Number.isFinite(n) && n > 0 ? n : 0
}

function maybeSaveHighscore() {
  if (typeof window === 'undefined') return
  if (score.value > highscore.value) {
    highscore.value = score.value
    window.localStorage.setItem('valhalla-highscore', String(score.value))
  }
}

onMounted(() => {
  loadHighscore()
  setTimeout(() => {
    initCanvas()

    // Read level from URL parameter
    const route = useRoute()
    const lvlParam = Number(route.query.level)
    if (lvlParam >= 1 && lvlParam <= 6) currentLevel.value = lvlParam

    // Load backgrounds for the starting level
    loadLevelImages(currentLevel.value)

    // Pre-build level so loading screen has correct data
    if (currentLevel.value === 1) buildLevel1()
    else if (currentLevel.value === 2) buildLevel2()
    else if (currentLevel.value === 3) buildLevel3()
    else if (currentLevel.value === 4) buildLevel4()
    else if (currentLevel.value === 5) buildLevel5()
    else if (currentLevel.value === 6) buildLevel6()

    // Events handled via Vue template (@keydown, @click on game container div)
    // Auto-focus the game container so keyboard events work immediately
    nextTick(() => {
      if (gameContainerRef.value) gameContainerRef.value.focus()
    })

    lastTime = performance.now()
    animFrame = requestAnimationFrame(gameLoop)

    // Level 5 uses the same loading → startGame() flow as all other levels
    // No special auto-start needed
  }, 100)
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-[#0A0F0A] overflow-hidden">
    <div class="flex items-center justify-between px-4 pt-2 pb-0 z-10">
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center text-[#555] hover:text-[#8B2020] transition-colors"
        @click="if (animFrame) cancelAnimationFrame(animFrame); router.push('/minigames')"
      >
        <Icon name="mdi:arrow-left" size="18" />
      </button>
      <span class="font-heading font-bold text-[10px] text-[#444] uppercase tracking-widest">Lars og Vejen til Valhalla</span>
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center text-[#555] hover:text-[#8B2020] transition-colors"
        @click="gameState === 'playing' || gameState === 'boss' ? gameState = 'paused' : gameState === 'paused' ? gameState = 'playing' : null"
      >
        <Icon :name="gameState === 'paused' ? 'mdi:play' : 'mdi:pause'" size="18" />
      </button>
    </div>
    <div
      class="flex-1 relative outline-none"
      tabindex="0"
      ref="gameContainerRef"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @click="onMouseDown"
      @mousedown="onMouseDown"
      @touchstart.prevent="onTouchStart"
    >
      <canvas ref="canvasRef" class="w-full h-full block touch-none" />
      <!-- Invisible click catcher for cutscene/loading - ensures clicks always register -->
      <div
        v-if="gameState === 'cutscene' || gameState === 'loading' || gameState === 'dead' || gameState === 'levelcomplete'"
        class="absolute inset-0 z-10 cursor-pointer"
        @click="gameState === 'cutscene' ? advanceCutscene() : gameState === 'loading' ? startGame() : gameState === 'dead' && deadDelay <= 0 ? resetLevel() : gameState === 'levelcomplete' ? advanceLevel() : null"
      />
    </div>
  </div>
</template>
