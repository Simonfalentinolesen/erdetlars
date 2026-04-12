<script setup lang="ts">
import jimData from '~/data/valhalla/jim-dialogue.json'

const router = useRouter()
const canvasRef = ref<HTMLCanvasElement | null>(null)

// ==================== GAME STATE ====================
const gameState = ref<'loading' | 'cutscene' | 'playing' | 'boss' | 'levelcomplete' | 'dead' | 'paused'>('loading')
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

let px = 60, py = 0, pvx = 0, pvy = 0
let onGround = false, facing = 1, invTimer = 0
let playerPower = 'none' as string
let powerTimer = 0

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
let jimPrankActive = '' as string // 'drunk' | 'heavy' | ''
let jimPrankTimer = 0
let dalmatinerActive = false
let dalmatinerX = 0, dalmatinerY = 0, dalmatinerVx = 0, dalmatinerCaught = false

// Jim one-liner comments (shown floating above Jim)
const JIM_ONELINERS_L2 = [
  'Charmerende sted...', 'Pas på rødderne.', 'Jeg elsker denne skov.',
  'Hørte du det?', 'Vi er ikke alene.', 'Lugt den luft, Lars.',
  'Min hund ville elske det her.', 'Rør ikke den svamp.',
  'Interessant...', 'Kom nu, Lars.', 'Den vej.',
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
      // LAVA ERUPTIONS from below (volcanic geysers)
      if (Math.random() < 0.015) {
        const lavaX = cameraX + Math.random() * W
        for (let lv = 0; lv < 8; lv++) {
          particles.push({ x: lavaX + (Math.random() - 0.5) * 15, y: H + 5, vx: (Math.random() - 0.5) * 50, vy: -150 - Math.random() * 200, life: 1.5 + Math.random() * 1.5, maxLife: 1.5 + Math.random() * 1.5, size: 2 + Math.random() * 4, color: 'lava' })
        }
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

  // Jim prank: DRUNK - inverted controls!
  if (jimPrankActive === 'drunk') {
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
  pvy += GRAVITY * dt
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

  // Camera
  const targetCam = px - W * 0.35
  cameraX = Math.max(0, Math.min(targetCam, levelWidth - W))

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
      switch (item.type) {
        case 'ol': levelOl.value++; score.value += 10; spawnParticles(item.x, item.y, 6, '#F5A623', 50); break
        case 'jim_token': levelJim.value++; score.value += 50; spawnParticles(item.x, item.y, 10, '#E84393', 60); break
        case 'dalmatiner': levelDal.value++; score.value += 100; spawnParticles(item.x, item.y, 12, '#FFFFFF', 70); break
        case 'powerup_big': playerPower = 'big'; powerTimer = 999; spawnParticles(item.x, item.y, 10, '#FF2222', 60); break
      }
    }
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

    // Random one-liners
    jimCommentTimer -= dt
    if (jimCommentTimer <= 0 && Math.random() < 0.01) {
      jimComment = JIM_ONELINERS_L2[Math.floor(Math.random() * JIM_ONELINERS_L2.length)]
      jimCommentTimer = 5 + Math.random() * 8
    }
    if (jimCommentTimer <= -2) jimComment = '' // Clear after 2s

    // === JIM PRANK TRIGGERS ===
    if (jimPrankTimer > 0) {
      jimPrankTimer -= dt
      if (jimPrankTimer <= 0) { jimPrankActive = '' }
    }

    // Drunk prank at x~700
    if (px > 680 && px < 720 && !jimPrankActive && currentLevel.value === 2) {
      jimPrankActive = 'drunk'; jimPrankTimer = 5
      jimComment = 'Skål, Lars! Drik!'
      jimCommentTimer = 5
    }
    // Heavy stone prank at x~1800 (treetops)
    if (px > 1780 && px < 1820 && !jimPrankActive && currentLevel.value === 2 && jimPrankTimer <= 0) {
      jimPrankActive = 'heavy'; jimPrankTimer = 8
      jimComment = 'Ups! En sten i bukserne!'
      jimCommentTimer = 5
    }
    // Dalmatiner sidequest at x~2200
    if (px > 2180 && px < 2220 && !dalmatinerActive && !dalmatinerCaught && currentLevel.value === 2) {
      dalmatinerActive = true
      dalmatinerX = px + 100; dalmatinerY = py - 20; dalmatinerVx = 80
      jimComment = 'MIN HUND! Fang den, Lars!'
      jimCommentTimer = 6
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
      // Can't finish - boss is still alive!
      showRequirements = true; requirementTimer = 3
      px = goalX - pw - 10
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
          // Actually dead
          e.alive = false
          gameState.value = 'playing'
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 40, '#8B2020', 180)
          score.value += 500 + (e.type === 'boss_berserker' ? 500 : 0)
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
  if (playerPower === 'big') { playerPower = 'none'; invTimer = 2; return }
  lives.value--; invTimer = 2
  if (lives.value <= 0) {
    gameState.value = 'dead'
    deadDelay = 1.5
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
    : currentLevel.value === 4 ? '#140A05' // Warm dark ember
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
    if (currentLevel.value === 4) {
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
    c.globalAlpha = 0.7
    c.drawImage(bgMid.value, midX, 0, W, H)
    c.drawImage(bgMid.value, midX + W, 0, W, H)
    c.globalAlpha = 1
  }

  // Level-specific color overlay (tints everything)
  if (currentLevel.value === 3) {
    c.globalAlpha = 0.08; c.fillStyle = '#2233AA'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
  } else if (currentLevel.value === 2) {
    c.globalAlpha = 0.05; c.fillStyle = '#115511'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
  } else if (currentLevel.value === 4) {
    // Warm fire tint - orange/red
    c.globalAlpha = 0.06; c.fillStyle = '#AA3300'; c.fillRect(0, 0, W, H); c.globalAlpha = 1
    // Bottom heat glow
    const heatGrad = c.createLinearGradient(0, H - 80, 0, H)
    heatGrad.addColorStop(0, 'transparent'); heatGrad.addColorStop(1, 'rgba(200, 60, 10, 0.12)')
    c.fillStyle = heatGrad; c.fillRect(0, H - 80, W, 80)
  }

  // Near layer (foreground overlay - drawn after gameplay)
  // (rendered at end)

  c.save()
  c.translate(-cameraX, 0)

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
      // Fangevogter
      c.fillStyle = '#4A3A2A'; c.beginPath(); c.roundRect(e.x + 3, e.y + 12, 19, 23, 2); c.fill()
      c.fillStyle = '#6A5040'; c.beginPath(); c.arc(e.x + 12, e.y + 8, 8, 0, Math.PI * 2); c.fill()
      // Leather helmet
      c.fillStyle = '#3A2A1A'; c.fillRect(e.x + 4, e.y + 1, 16, 8)
      // Eyes (menacing)
      c.fillStyle = '#AA3333'; c.beginPath(); c.arc(e.x + 9, e.y + 7, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 7, 1.5, 0, Math.PI * 2); c.fill()
      // Weapon
      c.strokeStyle = '#666'; c.lineWidth = 2; c.beginPath()
      c.moveTo(e.x + (e.dir > 0 ? 20 : 4), e.y + 10)
      c.lineTo(e.x + (e.dir > 0 ? 30 : -6), e.y + 2); c.stroke()
    } else if (e.type === 'wolf') {
      // Wolf silhouette
      c.fillStyle = '#3A3A3A'
      c.beginPath(); c.ellipse(e.x + 15, e.y + 14, 15, 10, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 28 : 2), e.y + 8, 7, 0, Math.PI * 2); c.fill()
      // Eyes
      c.fillStyle = '#FFAA00'
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 30 : 4), e.y + 6, 2, 0, Math.PI * 2); c.fill()
      // Legs
      c.strokeStyle = '#3A3A3A'; c.lineWidth = 3
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
      // Raven - flying, flapping wings
      const flapY = Math.sin(time.value * 10) * 3
      c.fillStyle = '#1A1A1A'
      c.beginPath(); c.ellipse(e.x + 10, e.y + 8 + flapY, 10, 5, 0, 0, Math.PI * 2); c.fill()
      // Wings
      const wingAngle = Math.sin(time.value * 12) * 0.5
      c.save(); c.translate(e.x + 10, e.y + 6 + flapY); c.rotate(wingAngle)
      c.fillStyle = '#222'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-14, -6); c.lineTo(-4, 2); c.fill()
      c.restore()
      c.save(); c.translate(e.x + 10, e.y + 6 + flapY); c.rotate(-wingAngle)
      c.fillStyle = '#222'; c.beginPath(); c.moveTo(0, 0); c.lineTo(14, -6); c.lineTo(4, 2); c.fill()
      c.restore()
      // Beak
      c.fillStyle = '#8B6914'
      c.beginPath(); c.moveTo(e.x + (e.dir > 0 ? 20 : 0), e.y + 8 + flapY)
      c.lineTo(e.x + (e.dir > 0 ? 24 : -4), e.y + 9 + flapY); c.lineTo(e.x + (e.dir > 0 ? 20 : 0), e.y + 10 + flapY); c.fill()
      // Eye
      c.fillStyle = '#CC2020'; c.beginPath(); c.arc(e.x + (e.dir > 0 ? 16 : 4), e.y + 6 + flapY, 1, 0, Math.PI * 2); c.fill()
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
      // Fallen warrior skeleton - grey/bone
      c.fillStyle = '#6A6A5A'; c.beginPath(); c.roundRect(e.x + 3, e.y + 10, 19, 25, 2); c.fill()
      c.fillStyle = '#8A8A7A'; c.beginPath(); c.arc(e.x + 12, e.y + 6, 8, 0, Math.PI * 2); c.fill()
      // Empty eye sockets
      c.fillStyle = '#2A0A0A'
      c.beginPath(); c.arc(e.x + 9, e.y + 5, 2, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + 15, e.y + 5, 2, 0, Math.PI * 2); c.fill()
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
      // Burning wolf
      c.fillStyle = '#3A2010'
      c.beginPath(); c.ellipse(e.x + 15, e.y + 14, 15, 10, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(e.x + (e.dir > 0 ? 28 : 2), e.y + 8, 7, 0, Math.PI * 2); c.fill()
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
      // Fire crown
      for (let fc = 0; fc < 5; fc++) {
        const fcX = e.x + 12 + fc * 4 + fShake
        const fcH = 6 + Math.sin(time.value * 8 + fc * 2) * 3
        c.fillStyle = '#FF4400'; c.beginPath(); c.arc(fcX, e.y - fcH, 3, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#FFAA00'; c.beginPath(); c.arc(fcX, e.y - fcH - 2, 1.5, 0, Math.PI * 2); c.fill()
      }
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

    c.save()
    c.translate(px + pw / 2, py + ph / 2 - 4)
    if (facing < 0) c.scale(-1, 1)
    const s = playerPower === 'big' ? 1.0 : 0.8

    // Lars body
    const bodyColor = '#3A4A3A'
    c.fillStyle = bodyColor; c.beginPath(); c.roundRect(-12 * s, 2 * s, 24 * s, 18 * s, 3); c.fill()
    // Head
    c.fillStyle = '#D4A574'; c.beginPath(); c.arc(0, -8 * s, 11 * s, 0, Math.PI * 2); c.fill()
    // Beanie
    c.fillStyle = '#1A1A1A'; c.beginPath(); c.roundRect(-11 * s, -20 * s, 22 * s, 10 * s, 4); c.fill()
    c.beginPath(); c.arc(0, -22 * s, 4 * s, 0, Math.PI * 2); c.fill()
    // Beard
    c.fillStyle = '#2A1A0A'; c.beginPath(); c.roundRect(-8 * s, -2 * s, 16 * s, 8 * s, 3); c.fill()
    c.fillStyle = '#1A0A00'; c.beginPath(); c.roundRect(-6 * s, 4 * s, 12 * s, 4 * s, 2); c.fill()
    // Sunglasses
    c.fillStyle = '#0A0A0A'
    c.beginPath(); c.roundRect(-8 * s, -11 * s, 7 * s, 5 * s, 2); c.fill()
    c.beginPath(); c.roundRect(1 * s, -11 * s, 7 * s, 5 * s, 2); c.fill()
    // Gold chain
    c.strokeStyle = '#F5A623'; c.lineWidth = 1.5 * s
    c.beginPath(); c.moveTo(-6 * s, 4 * s); c.quadraticCurveTo(0, 10 * s, 6 * s, 4 * s); c.stroke()
    // Legs
    c.fillStyle = '#2A2A5A'
    c.beginPath(); c.roundRect(-8 * s, 20 * s, 7 * s, 10 * s, 2); c.fill()
    c.beginPath(); c.roundRect(1 * s, 20 * s, 7 * s, 10 * s, 2); c.fill()

    c.restore()
    c.globalAlpha = 1
  }

  // === JIM COMPANION (Level 2+) ===
  if (jimActive && (gameState.value === 'playing' || gameState.value === 'boss')) {
    // Jim's shadow (foreshadowing - antler-shaped!)
    c.globalAlpha = 0.1
    c.fillStyle = '#000'
    c.beginPath(); c.ellipse(jimX, jimY + 22, 12, 4, 0, 0, Math.PI * 2); c.fill()
    // Shadow has antler hints (Loke foreshadowing)
    c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 2
    c.beginPath(); c.moveTo(jimX - 6, jimY + 18); c.lineTo(jimX - 14, jimY + 10); c.stroke()
    c.beginPath(); c.moveTo(jimX + 6, jimY + 18); c.lineTo(jimX + 14, jimY + 10); c.stroke()
    c.globalAlpha = 1

    // Jim body (dalmatian shirt, bald, tattoo)
    c.fillStyle = '#F5F0E8'; c.beginPath(); c.roundRect(jimX - 8, jimY + 2, 16, 14, 2); c.fill()
    c.fillStyle = '#1A1A1A'
    c.beginPath(); c.arc(jimX - 3, jimY + 6, 2, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(jimX + 4, jimY + 9, 2.5, 0, Math.PI * 2); c.fill()
    // Head (bald)
    c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(jimX, jimY - 5, 8, 0, Math.PI * 2); c.fill()
    // Tattoo
    c.strokeStyle = '#9E3030'; c.lineWidth = 0.7
    c.beginPath(); c.moveTo(jimX - 5, jimY - 8); c.quadraticCurveTo(jimX, jimY - 14, jimX + 5, jimY - 8); c.stroke()
    c.fillStyle = '#9E3030'; c.beginPath(); c.arc(jimX, jimY - 12, 1, 0, Math.PI * 2); c.fill()
    // Blue eyes
    c.fillStyle = '#6AACDB'
    c.beginPath(); c.arc(jimX - 3, jimY - 5, 1.2, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(jimX + 3, jimY - 5, 1.2, 0, Math.PI * 2); c.fill()
    // Raised finger
    c.strokeStyle = '#E0B89A'; c.lineWidth = 2
    c.beginPath(); c.moveTo(jimX + 10, jimY + 2); c.lineTo(jimX + 15, jimY - 6); c.stroke()

    // Floating comment above Jim
    if (jimComment) {
      c.globalAlpha = Math.min(1, jimCommentTimer + 2)
      c.fillStyle = 'rgba(10, 15, 10, 0.8)'
      const tw = c.measureText(jimComment).width
      c.beginPath(); c.roundRect(jimX - tw / 2 - 6, jimY - 30, tw + 12, 18, 6); c.fill()
      c.fillStyle = '#CCC'; c.font = '9px "DM Sans"'; c.textAlign = 'center'
      c.fillText(jimComment, jimX, jimY - 17)
      c.globalAlpha = 1
    }

    // Prank visual indicator
    if (jimPrankActive === 'drunk') {
      c.fillStyle = 'rgba(245, 166, 35, 0.15)'
      c.beginPath(); c.arc(px + getPlayerW() / 2, py + getPlayerH() / 2, 20, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#F5A623'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('FULD!', px + getPlayerW() / 2, py - 10)
    }
    if (jimPrankActive === 'heavy') {
      c.fillStyle = '#888'; c.font = 'bold 8px "Space Grotesk"'; c.textAlign = 'center'
      c.fillText('TUNG!', px + getPlayerW() / 2, py - 10)
      // Draw stone at Lars' foot
      c.fillStyle = '#555'; c.beginPath(); c.arc(px + getPlayerW() / 2, py + getPlayerH() + 5, 6, 0, Math.PI * 2); c.fill()
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

  // Lives
  c.textAlign = 'right'; c.font = '14px sans-serif'
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i < lives.value ? '#CC2020' : '#3A3A3A'
    c.fillText('♥', W - 14 - i * 20, 20)
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

      // Jim portrait - BIGGER
      const portR = 24
      const portX = 50, portY = boxY + 40
      // Portrait background circle
      c.fillStyle = 'rgba(139, 32, 32, 0.15)'; c.beginPath(); c.arc(portX, portY, portR + 4, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#E0B89A'; c.beginPath(); c.arc(portX, portY, portR, 0, Math.PI * 2); c.fill()
      // Tattoo
      c.strokeStyle = '#9E3030'; c.lineWidth = 1.5
      c.beginPath(); c.moveTo(portX - 14, portY - 6); c.quadraticCurveTo(portX, portY - 22, portX + 14, portY - 6); c.stroke()
      c.fillStyle = '#9E3030'; c.beginPath(); c.arc(portX, portY - 18, 2, 0, Math.PI * 2); c.fill()
      // Eyes
      c.fillStyle = '#6AACDB'
      c.beginPath(); c.arc(portX - 6, portY - 1, 2.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(portX + 6, portY - 1, 2.5, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#1A2634'
      c.beginPath(); c.arc(portX - 6, portY - 1, 1, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(portX + 6, portY - 1, 1, 0, Math.PI * 2); c.fill()
      // Mouth
      c.strokeStyle = '#B08070'; c.lineWidth = 0.8
      c.beginPath(); c.moveTo(portX - 4, portY + 6); c.lineTo(portX + 4, portY + 6); c.stroke()

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

  // ==================== LEVEL COMPLETE ====================
  if (gameState.value === 'levelcomplete') {
    c.fillStyle = 'rgba(5, 10, 5, 0.92)'; c.fillRect(0, 0, W, H)

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
    c.fillText('FALDET', W / 2, H * 0.28)

    // Jim's death quote - SINGLE, LARGE, READABLE
    c.fillStyle = '#BBBBBB'; c.font = 'italic 16px "DM Sans"'
    c.fillText(`"${deathQuote}"`, W / 2, H * 0.28 + 50)

    // Jim attribution
    c.fillStyle = '#8B2020'; c.font = 'bold 10px "Space Grotesk"'
    c.fillText('— JIM', W / 2, H * 0.28 + 75)

    // Score
    c.fillStyle = '#CCC'; c.font = 'bold 18px "Space Grotesk"'
    c.fillText(`Score: ${score.value}`, W / 2, H * 0.55)

    // Retry button (only after delay)
    if (deadDelay <= 0) {
      const pulse = 0.5 + Math.sin(time.value * 3) * 0.3
      c.fillStyle = `rgba(139, 32, 32, ${pulse})`
      c.beginPath(); c.roundRect(W / 2 - 90, H * 0.66, 180, 40, 10); c.fill()
      c.fillStyle = '#EEE'; c.font = 'bold 14px "Space Grotesk"'
      c.fillText('PRØV IGEN', W / 2, H * 0.66 + 24)
    } else {
      c.fillStyle = '#444'; c.font = '12px "DM Sans"'
      c.fillText('Vent...', W / 2, H * 0.7)
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
  }
}

// ==================== INPUT ====================
function onKeyDown(e: KeyboardEvent) {
  keysDown.add(e.code)
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); tapped = true }

  // PAUSE (Escape or P)
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (gameState.value === 'playing' || gameState.value === 'boss') {
      gameState.value = 'paused'
    } else if (gameState.value === 'paused') {
      gameState.value = 'playing'
    }
    return
  }

  if (gameState.value === 'paused') { gameState.value = 'playing'; return }
  if (gameState.value === 'cutscene') { e.preventDefault(); advanceCutscene() }
  else if (gameState.value === 'loading') { startGame() }
  else if (gameState.value === 'dead' && deadDelay <= 0) { resetLevel() }
  else if (gameState.value === 'levelcomplete') { advanceLevel() }
}

function onKeyUp(e: KeyboardEvent) { keysDown.delete(e.code) }

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  tapped = true
  if (gameState.value === 'cutscene') advanceCutscene()
  else if (gameState.value === 'loading') startGame()
  else if (gameState.value === 'dead' && deadDelay <= 0) resetLevel()
  else if (gameState.value === 'levelcomplete') gameState.value = 'loading'
}

function onMouseDown() {
  tapped = true
  if (gameState.value === 'cutscene') advanceCutscene()
  else if (gameState.value === 'loading') startGame()
  else if (gameState.value === 'dead' && deadDelay <= 0) resetLevel()
  else if (gameState.value === 'levelcomplete') gameState.value = 'loading'
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

  gameState.value = 'playing'
}

function resetLevel() {
  lives.value = 3; score.value = 0
  initLevel()
}

function advanceLevel() {
  currentLevel.value++
  if (currentLevel.value > 6) {
    gameState.value = 'loading' // Victory - placeholder
    return
  }
  loadLevelImages(currentLevel.value)
  initLevel()
  const dialog = getLevelDialog('intro')
  if (dialog) startCutscene(dialog, () => { gameState.value = 'playing' })
}

function getLevelDialog(key: string) {
  const lvlKey = `level${currentLevel.value}` as keyof typeof jimData
  const lvlData = jimData[lvlKey] as any
  return lvlData?.[key] || null
}

function loadLevelImages(lvl: number) {
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

onMounted(() => {
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

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvasRef.value?.addEventListener('touchstart', onTouchStart, { passive: false })
    canvasRef.value?.addEventListener('mousedown', onMouseDown)

    lastTime = performance.now()
    animFrame = requestAnimationFrame(gameLoop)
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
    <div class="flex-1 relative">
      <canvas ref="canvasRef" class="w-full h-full block touch-none" />
    </div>
  </div>
</template>
