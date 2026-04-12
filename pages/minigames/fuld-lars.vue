<script setup lang="ts">
const router = useRouter()
const { getMinigameQuote } = useJim()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { ctx, width, height, consumeTap, createGameLoop, clear, drawRect, drawCircle, drawText, drawLars, drawJim, collides, initCanvas } = useGameEngine(canvasRef)

const gameState = ref<'menu' | 'playing' | 'dead'>('menu')
const score = ref(0)
const highScore = ref(0)
const jimMessage = ref('')
const showJim = ref(false)
let lastJimScore = 0

onMounted(() => {
  const saved = localStorage.getItem('erdetlars_flappy_highscore')
  if (saved) highScore.value = Number(saved)
})

const GRAVITY = 800
const FLAP_FORCE = -300
const PIPE_WIDTH = 50
const PIPE_GAP = 160
const PIPE_SPEED = 160

let larsX = 0, larsY = 0, larsVelocity = 0, larsRotation = 0
let beerSplash = 0 // Splash animation timer

interface Pipe { x: number; gapY: number; scored: boolean }
let pipes: Pipe[] = []
let pipeTimer = 0
let time = 0

function resetGame() {
  if (!height.value) initCanvas()
  larsX = (width.value || 400) * 0.3
  larsY = (height.value || 600) * 0.4
  larsVelocity = 0
  larsRotation = 0
  beerSplash = 0
  pipes = []
  pipeTimer = 0.6 // First pipe comes quickly
  score.value = 0
  time = 0
  lastJimScore = 0
}

function update(dt: number) {
  if (gameState.value !== 'playing') return
  time += dt
  beerSplash = Math.max(0, beerSplash - dt)

  if (consumeTap()) {
    larsVelocity = FLAP_FORCE
    beerSplash = 0.5 // Bigger beer splash!
  }

  larsVelocity += GRAVITY * dt
  larsY += larsVelocity * dt
  larsRotation = Math.min(Math.max(larsVelocity * 0.08, -25), 60)

  // Pipes
  pipeTimer -= dt
  if (pipeTimer <= 0) {
    pipeTimer = 1.6 + Math.random() * 0.5
    const minY = 80
    const gap = Math.max(PIPE_GAP - score.value * 1.5, 120)
    const maxY = (height.value || 600) - 80 - gap
    pipes.push({ x: (width.value || 400) + 20, gapY: minY + Math.random() * (maxY - minY), scored: false })
  }

  const speed = PIPE_SPEED + score.value * 2
  for (const pipe of pipes) {
    pipe.x -= speed * dt
    if (!pipe.scored && pipe.x + PIPE_WIDTH < larsX) { pipe.scored = true; score.value++ }
  }
  pipes = pipes.filter(p => p.x > -PIPE_WIDTH - 10)

  // Death: ceiling/floor
  if (larsY < 0 || larsY + 30 > (height.value || 600)) { die(); return }

  // Death: pipes
  const gap = Math.max(PIPE_GAP - score.value * 1.5, 120)
  for (const pipe of pipes) {
    if (collides(larsX, larsY, 28, 30, pipe.x, 0, PIPE_WIDTH, pipe.gapY) ||
        collides(larsX, larsY, 28, 30, pipe.x, pipe.gapY + gap, PIPE_WIDTH, (height.value || 600))) {
      die(); return
    }
  }

  if (score.value - lastJimScore >= 10 && score.value > 0) {
    lastJimScore = score.value
    jimMessage.value = getMinigameQuote('fuld_lars')
    showJim.value = true
    setTimeout(() => { showJim.value = false }, 3000)
  }
}

function die() {
  gameState.value = 'dead'
  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem('erdetlars_flappy_highscore', String(highScore.value))
  }
  jimMessage.value = getMinigameQuote('fuld_lars')
  showJim.value = true
}

function render() {
  if (!width.value || !height.value || !ctx.value) return

  clear('#0F1923')

  // Stars
  for (let i = 0; i < 30; i++) {
    drawCircle((i * 83) % width.value, (i * 47) % height.value, 1, `rgba(255,255,255,${0.1 + Math.sin(time * 2 + i) * 0.1})`)
  }

  // Pipes (stacked beer cans!)
  const gap = Math.max(PIPE_GAP - score.value * 1.5, 120)
  for (const pipe of pipes) {
    // Top stack of cans
    const topH = pipe.gapY
    for (let y = 0; y < topH; y += 18) {
      const canH = Math.min(18, topH - y)
      // Alternating can colors
      const isGold = (Math.floor(y / 18) % 2) === 0
      drawRect(pipe.x, y, PIPE_WIDTH, canH - 1, '#A0A0A0', 2)
      drawRect(pipe.x + 2, y + 2, PIPE_WIDTH - 4, canH - 5, isGold ? '#C9860A' : '#1A6B2A', 1)
      // Can ring top
      drawRect(pipe.x + 5, y, PIPE_WIDTH - 10, 2, '#D0D0D0', 1)
    }
    // Cap
    drawRect(pipe.x - 3, topH - 6, PIPE_WIDTH + 6, 6, '#808080', 3)

    // Bottom stack
    const bottomY = pipe.gapY + gap
    drawRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 6, '#808080', 3)
    for (let y = bottomY + 6; y < height.value; y += 18) {
      const canH = Math.min(18, height.value - y)
      const isGold = (Math.floor((y - bottomY) / 18) % 2) === 0
      drawRect(pipe.x, y, PIPE_WIDTH, canH - 1, '#A0A0A0', 2)
      drawRect(pipe.x + 2, y + 2, PIPE_WIDTH - 4, canH - 5, isGold ? '#C9860A' : '#1A6B2A', 1)
      drawRect(pipe.x + 5, y, PIPE_WIDTH - 10, 2, '#D0D0D0', 1)
    }
  }

  // Lars
  const cx = larsX + 14
  const cy = larsY + 15
  ctx.value.save()
  ctx.value.translate(cx, cy)
  ctx.value.rotate((larsRotation * Math.PI) / 180)

  // Beer splash particles when flapping
  if (beerSplash > 0) {
    const splashAlpha = beerSplash / 0.5
    // Big beer splash with many droplets
    for (let s = 0; s < 12; s++) {
      const angle = (s / 12) * Math.PI * 2 + time * 4
      const dist = (0.5 - beerSplash) * 60
      const sx = Math.cos(angle) * dist + 12
      const sy = Math.sin(angle) * dist - 5
      const size = 1.5 + Math.random() * 2.5
      drawCircle(sx, sy, size, `rgba(245, 166, 35, ${splashAlpha * 0.7})`)
    }
    // Foam drops
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2 + time * 2 + 0.5
      const dist = (0.5 - beerSplash) * 35
      drawCircle(Math.cos(angle) * dist + 12, Math.sin(angle) * dist - 10, 2, `rgba(255, 255, 255, ${splashAlpha * 0.5})`)
    }
  }

  // Draw Lars with the helper (at 0,0 since we already translated)
  drawLars(0, 0, 0.85, 'drunk')

  ctx.value.restore()

  // HUD
  drawText(String(score.value), width.value / 2, 45, '#FFFFFF', 44, 'center', '"Space Grotesk"')
  drawText(`Best: ${highScore.value}`, width.value / 2, 78, '#8892A0', 13, 'center')

  // Menu
  if (gameState.value === 'menu') {
    drawRect(0, 0, width.value, height.value, 'rgba(15, 25, 35, 0.85)')
    drawText('FULD LARS', width.value / 2, height.value * 0.28, '#00D68F', 30, 'center', '"Space Grotesk"')
    drawText('Lars er stiv. Hjælp ham flyve!', width.value / 2, height.value * 0.28 + 35, '#8892A0', 14, 'center')
    drawText('Tryk = Flap + Øl splash!', width.value / 2, height.value * 0.48, '#FFFFFF', 18, 'center', '"Space Grotesk"')
    drawText('[SPACE] / Tryk / Pil op', width.value / 2, height.value * 0.48 + 30, '#8892A0', 12, 'center')
  }

  if (gameState.value === 'dead') {
    drawRect(0, 0, width.value, height.value, 'rgba(15, 25, 35, 0.85)')
    drawText('LARS FALDT!', width.value / 2, height.value * 0.25, '#FF4757', 30, 'center', '"Space Grotesk"')
    drawText(`${score.value} øldåser passeret`, width.value / 2, height.value * 0.25 + 45, '#FFFFFF', 22, 'center')
    if (score.value >= highScore.value && score.value > 0) drawText('NY REKORD!', width.value / 2, height.value * 0.25 + 80, '#F5A623', 16, 'center')
    drawText('Tryk for at prøve igen', width.value / 2, height.value * 0.6, '#8892A0', 16, 'center')
  }
}

const gameLoop = ref<ReturnType<typeof createGameLoop> | null>(null)

onMounted(() => {
  setTimeout(() => {
    initCanvas()
    resetGame()
    const loop = createGameLoop(
      (dt) => {
        if (gameState.value !== 'playing' && consumeTap()) {
          if (gameState.value === 'dead') resetGame()
          gameState.value = 'playing'
          showJim.value = false
        }
        update(dt)
      },
      render,
    )
    gameLoop.value = loop
    loop.start()
  }, 100)
})

onUnmounted(() => { gameLoop.value?.stop() })
</script>

<template>
  <div class="h-screen flex flex-col bg-primary overflow-hidden">
    <div class="flex items-center justify-between px-4 pt-3 pb-1 z-10">
      <button class="w-9 h-9 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors" @click="gameLoop?.stop(); router.push('/minigames')">
        <Icon name="mdi:arrow-left" size="18" />
      </button>
      <span class="font-heading font-bold text-sm text-muted">Fuld Lars</span>
      <div class="w-9" />
    </div>
    <div class="flex-1 relative">
      <canvas ref="canvasRef" class="w-full h-full block touch-none" />
    </div>
    <JimQuote :show="showJim" :quote="jimMessage" mode="toast" @dismiss="showJim = false" />
  </div>
</template>
