<script setup lang="ts">
const router = useRouter()
const { getMinigameQuote } = useJim()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { ctx, width, height, keys, consumeTap, createGameLoop, clear, drawRect, drawCircle, drawText, drawLine, collides, initCanvas } = useGameEngine(canvasRef)

const gameState = ref<'menu' | 'playing' | 'dead'>('menu')
const score = ref(0)
const highScore = ref(0)
const jimMessage = ref('')
const showJim = ref(false)
let lastJimScore = 0
let beerCount = 0

onMounted(() => {
  const saved = localStorage.getItem('erdetlars_porsche_highscore')
  if (saved) highScore.value = Number(saved)
})

// Car dimensions
const CAR_W = 52
const CAR_H = 84
let carX = 0
let carY = 0 // Now Y is also controllable
let laneWidth = 0
let roadLeft = 0
let roadWidth = 0
let gameSpeed = 200
let distance = 0
let time = 0
let tiltAngle = 0

// Counters for scorecard
let jimCount = 0
let dalmatinerCount = 0

interface RoadObj {
  x: number; y: number
  type: 'viking' | 'beer' | 'cone' | 'jim' | 'dalmatiner'
  collected: boolean
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; size: number
}

interface ScorePopup {
  x: number; y: number; text: string; color: string; life: number
}

let objects: RoadObj[] = []
let particles: Particle[] = []
let scorePopups: ScorePopup[] = []
let spawnTimer = 0
let roadScroll = 0
let shakeX = 0
let shakeY = 0

// Street lights
interface StreetLight { x: number; side: 'left' | 'right' }
let streetLights: StreetLight[] = []

function getLaneX(lane: number): number {
  return roadLeft + laneWidth * 0.5 + lane * laneWidth - CAR_W / 2
}

function spawnParticles(x: number, y: number, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200 - 50,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.4 + Math.random() * 0.4,
      color,
      size: 2 + Math.random() * 4,
    })
  }
}

function addScorePopup(x: number, y: number, text: string, color: string) {
  scorePopups.push({ x, y, text, color, life: 1.2 })
}

function resetGame() {
  if (!width.value) initCanvas()
  roadWidth = Math.min(width.value * 0.72, 320)
  roadLeft = (width.value - roadWidth) / 2
  laneWidth = roadWidth / 3
  carX = (width.value - CAR_W) / 2
  carY = height.value - 140
  tiltAngle = 0
  objects = []; particles = []; scorePopups = []
  spawnTimer = 0; gameSpeed = 200; distance = 0; time = 0
  score.value = 0; beerCount = 0; jimCount = 0; dalmatinerCount = 0
  lastJimScore = 0; roadScroll = 0; shakeX = 0; shakeY = 0

  // Generate street lights
  streetLights = []
  for (let i = 0; i < 20; i++) {
    streetLights.push({ x: i * 150, side: i % 2 === 0 ? 'left' : 'right' })
  }
}

function update(dt: number) {
  if (gameState.value !== 'playing') return
  time += dt
  consumeTap()

  distance += gameSpeed * dt
  roadScroll += gameSpeed * dt
  score.value = Math.floor(distance / 15)
  gameSpeed = 200 + score.value * 0.3

  // Free movement - LEFT/RIGHT/UP/DOWN
  const moveSpeed = 220
  const left = keys.value.has('ArrowLeft') || keys.value.has('KeyA')
  const right = keys.value.has('ArrowRight') || keys.value.has('KeyD')
  const up = keys.value.has('ArrowUp') || keys.value.has('KeyW')
  const down = keys.value.has('ArrowDown') || keys.value.has('KeyS')

  if (left) { carX -= moveSpeed * dt; tiltAngle = -0.08 }
  else if (right) { carX += moveSpeed * dt; tiltAngle = 0.08 }
  else { tiltAngle *= 0.85 }

  if (up) carY -= moveSpeed * 0.7 * dt
  if (down) carY += moveSpeed * 0.7 * dt

  // Mobile touch steering - move car towards touch point
  if (touchActive && gameState.value === 'playing') {
    const targetCarX = touchX - CAR_W / 2
    const targetCarY = touchY - CAR_H / 2
    const dx = targetCarX - carX
    const dy = targetCarY - carY
    carX += dx * 6 * dt
    carY += dy * 4 * dt
    tiltAngle = Math.max(-0.1, Math.min(0.1, dx * 0.001))
  }

  // Clamp to road
  carX = Math.max(roadLeft + 4, Math.min(roadLeft + roadWidth - CAR_W - 4, carX))
  carY = Math.max(60, Math.min(height.value - CAR_H - 10, carY))

  // Spawn objects
  spawnTimer -= dt
  if (spawnTimer <= 0) {
    spawnTimer = 0.5 + Math.random() * 0.6
    const objX = roadLeft + 20 + Math.random() * (roadWidth - 40)

    if (Math.random() < 0.04) {
      objects.push({ x: objX, y: -50, type: 'jim', collected: false })
    } else if (Math.random() < 0.08) {
      objects.push({ x: objX, y: -50, type: 'dalmatiner', collected: false })
    } else {
      const types: RoadObj['type'][] = ['viking', 'viking', 'beer', 'beer', 'beer', 'cone']
      objects.push({ x: objX, y: -50, type: types[Math.floor(Math.random() * types.length)], collected: false })
    }
  }

  for (const obj of objects) obj.y += gameSpeed * dt
  objects = objects.filter(o => o.y < height.value + 60)

  // Collision
  for (const obj of objects) {
    if (obj.collected) continue
    const ow = obj.type === 'jim' || obj.type === 'dalmatiner' ? 34 : obj.type === 'viking' ? 32 : 20
    const oh = obj.type === 'jim' || obj.type === 'dalmatiner' ? 34 : obj.type === 'viking' ? 44 : 20
    if (collides(carX + 6, carY + 6, CAR_W - 12, CAR_H - 14, obj.x - ow / 2, obj.y - oh / 2, ow, oh)) {
      obj.collected = true
      if (obj.type === 'beer') {
        beerCount++; score.value += 50
        spawnParticles(obj.x, obj.y, 12, '#F5A623')
        addScorePopup(obj.x, obj.y, '+50', '#F5A623')
      } else if (obj.type === 'jim') {
        jimCount++; score.value += 200
        spawnParticles(obj.x, obj.y, 20, '#E84393')
        addScorePopup(obj.x, obj.y, '+200 JIM!', '#E84393')
        jimMessage.value = getMinigameQuote('porsche_dash')
        showJim.value = true
        setTimeout(() => { showJim.value = false }, 2500)
      } else if (obj.type === 'dalmatiner') {
        dalmatinerCount++; score.value += 150
        spawnParticles(obj.x, obj.y, 15, '#FFFFFF')
        addScorePopup(obj.x, obj.y, '+150 HUND!', '#FFFFFF')
      } else { die(); return }
    }
  }

  // Particles
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt
  }
  particles = particles.filter(p => p.life > 0)

  // Score popups
  for (const sp of scorePopups) { sp.y -= 60 * dt; sp.life -= dt }
  scorePopups = scorePopups.filter(sp => sp.life > 0)

  // Shake decay
  shakeX *= 0.9; shakeY *= 0.9

  // Street lights scroll
  for (const sl of streetLights) sl.x -= gameSpeed * dt * 0.02
  if (streetLights.length > 0 && streetLights[0].x < -50) {
    streetLights.shift()
    const last = streetLights[streetLights.length - 1]
    streetLights.push({ x: (last?.x ?? 0) + 150, side: last?.side === 'left' ? 'right' : 'left' })
  }

  if (score.value - lastJimScore >= 500 && !showJim.value) {
    lastJimScore = score.value
    jimMessage.value = getMinigameQuote('porsche_dash')
    showJim.value = true
    setTimeout(() => { showJim.value = false }, 3000)
  }
}

function die() {
  gameState.value = 'dead'
  shakeX = (Math.random() - 0.5) * 20; shakeY = (Math.random() - 0.5) * 15
  spawnParticles(carX + CAR_W / 2, height.value - 100, 30, '#FF4757')
  if (score.value > highScore.value) {
    highScore.value = score.value
    localStorage.setItem('erdetlars_porsche_highscore', String(highScore.value))
  }
  jimMessage.value = getMinigameQuote('porsche_dash')
  showJim.value = true
}

function render() {
  if (!width.value || !height.value || !ctx.value) return
  const c = ctx.value
  const W = width.value
  const H = height.value

  c.save()
  c.translate(shakeX, shakeY)

  // === SKY - gradient night sky ===
  const skyGrad = c.createLinearGradient(0, 0, 0, H * 0.3)
  skyGrad.addColorStop(0, '#0A0A1A')
  skyGrad.addColorStop(0.5, '#121230')
  skyGrad.addColorStop(1, '#1A1A3A')
  c.fillStyle = skyGrad; c.fillRect(0, 0, W, H * 0.3)

  // Stars
  for (let i = 0; i < 40; i++) {
    const sx = (i * 73 + time * 2) % W
    const sy = (i * 37) % (H * 0.25)
    const twinkle = 0.2 + Math.sin(time * 3 + i * 1.7) * 0.2
    c.globalAlpha = twinkle
    drawCircle(sx, sy, i % 5 === 0 ? 1.5 : 0.8, '#FFFFFF')
  }
  c.globalAlpha = 1

  // === CITY SKYLINE - parallax layer 1 ===
  const skylineScroll = -(roadScroll * 0.015) % 400
  c.fillStyle = '#0D0D20'
  for (let i = -1; i < W / 80 + 2; i++) {
    const bx = i * 80 + skylineScroll
    const bh = 30 + (i * 37 % 60)
    c.fillRect(bx, H * 0.3 - bh, 35, bh)
    c.fillRect(bx + 40, H * 0.3 - bh * 0.6, 25, bh * 0.6)
    // Windows (tiny yellow dots)
    for (let wy = H * 0.3 - bh + 5; wy < H * 0.3 - 5; wy += 8) {
      for (let wx = bx + 4; wx < bx + 32; wx += 8) {
        if (Math.sin(wx * 3 + wy * 7) > 0.3) {
          drawRect(wx, wy, 3, 3, 'rgba(255, 220, 100, 0.4)')
        }
      }
    }
  }

  // === GRASS / TERRAIN ===
  const grassGrad = c.createLinearGradient(0, H * 0.3, 0, H)
  grassGrad.addColorStop(0, '#1A3A1A')
  grassGrad.addColorStop(1, '#0F2A0F')
  c.fillStyle = grassGrad; c.fillRect(0, H * 0.3, W, H * 0.7)

  // Trees on sides (parallax layer 2)
  const treeScroll = -(roadScroll * 0.08) % 100
  for (let i = -1; i < W / 50 + 2; i++) {
    const tx = i * 100 + treeScroll
    // Left trees
    if (tx < roadLeft - 20) {
      drawCircle(tx, H * 0.45, 18, '#1A4A1A')
      drawCircle(tx, H * 0.45 - 10, 14, '#1A5A1A')
      drawRect(tx - 2, H * 0.45 + 8, 4, 15, '#3A2A1A')
    }
    // Right trees
    const rtx = W - tx
    if (rtx > roadLeft + roadWidth + 20) {
      drawCircle(rtx, H * 0.5, 16, '#1A4A1A')
      drawCircle(rtx, H * 0.5 - 8, 12, '#1A5A1A')
      drawRect(rtx - 2, H * 0.5 + 6, 4, 12, '#3A2A1A')
    }
  }

  // Street lights
  for (const sl of streetLights) {
    const lx = sl.side === 'left' ? roadLeft - 18 : roadLeft + roadWidth + 18
    const scrollY = (sl.x * 3 + roadScroll * 0.5) % H
    if (scrollY < -20 || scrollY > H + 20) continue
    // Pole
    drawRect(lx - 1.5, scrollY - 30, 3, 30, '#555')
    // Light head
    drawRect(lx - 4, scrollY - 33, 8, 5, '#666', 2)
    // Light glow on road
    const glowR = 35
    const gx = sl.side === 'left' ? roadLeft + 15 : roadLeft + roadWidth - 15
    const glowGrad = c.createRadialGradient(gx, scrollY, 0, gx, scrollY, glowR)
    glowGrad.addColorStop(0, 'rgba(255, 230, 150, 0.08)')
    glowGrad.addColorStop(1, 'rgba(255, 230, 150, 0)')
    c.fillStyle = glowGrad; c.fillRect(gx - glowR, scrollY - glowR, glowR * 2, glowR * 2)
  }

  // === ROAD ===
  // Asphalt gradient
  const roadGrad = c.createLinearGradient(roadLeft, 0, roadLeft + roadWidth, 0)
  roadGrad.addColorStop(0, '#252525')
  roadGrad.addColorStop(0.15, '#303030')
  roadGrad.addColorStop(0.5, '#383838')
  roadGrad.addColorStop(0.85, '#303030')
  roadGrad.addColorStop(1, '#252525')
  c.fillStyle = roadGrad; c.fillRect(roadLeft, 0, roadWidth, H)

  // Curb - red/white striped
  for (let y = -(roadScroll % 20); y < H + 20; y += 20) {
    const isRed = Math.floor(y / 10) % 2 === 0
    drawRect(roadLeft - 6, y, 6, 10, isRed ? '#CC2222' : '#FFFFFF')
    drawRect(roadLeft + roadWidth, y, 6, 10, isRed ? '#CC2222' : '#FFFFFF')
  }

  // White solid edge lines
  drawRect(roadLeft, 0, 2.5, H, '#CCCCCC')
  drawRect(roadLeft + roadWidth - 2.5, 0, 2.5, H, '#CCCCCC')

  // Lane dashes (white)
  const dashLen = 40; const dashGap = 30
  const scrollOff = roadScroll % (dashLen + dashGap)
  for (let lane = 1; lane < 3; lane++) {
    const lx = roadLeft + lane * laneWidth
    for (let y = -scrollOff - dashLen; y < H + dashLen; y += dashLen + dashGap) {
      drawRect(lx - 1.5, y, 3, dashLen, 'rgba(255,255,255,0.25)')
    }
  }

  // Wet road reflection (subtle)
  c.globalAlpha = 0.03
  c.fillStyle = '#FFFFFF'
  c.fillRect(roadLeft + roadWidth * 0.3, 0, roadWidth * 0.4, H)
  c.globalAlpha = 1

  // === SPEED LINES (when fast) ===
  const kmh = Math.floor(gameSpeed * 0.4)
  if (kmh > 140 && gameState.value === 'playing') {
    const intensity = Math.min((kmh - 140) / 200, 0.4)
    c.globalAlpha = intensity
    for (let i = 0; i < 8; i++) {
      const slx = roadLeft + Math.random() * roadWidth
      const sly = Math.random() * H
      const slLen = 20 + Math.random() * 40
      drawRect(slx, sly, 1, slLen, '#FFFFFF')
    }
    c.globalAlpha = 1
    // Edge blur
    const blurGrad = c.createLinearGradient(0, 0, roadLeft * 0.5, 0)
    blurGrad.addColorStop(0, `rgba(15, 25, 35, ${intensity * 0.5})`)
    blurGrad.addColorStop(1, 'rgba(15, 25, 35, 0)')
    c.fillStyle = blurGrad; c.fillRect(0, 0, roadLeft, H)
    const blurGrad2 = c.createLinearGradient(W, 0, roadLeft + roadWidth + (W - roadLeft - roadWidth) * 0.5, 0)
    blurGrad2.addColorStop(0, `rgba(15, 25, 35, ${intensity * 0.5})`)
    blurGrad2.addColorStop(1, 'rgba(15, 25, 35, 0)')
    c.fillStyle = blurGrad2; c.fillRect(roadLeft + roadWidth, 0, W - roadLeft - roadWidth, H)
  }

  // === ROAD OBJECTS ===
  for (const obj of objects) {
    if (obj.collected || obj.y < -50 || obj.y > H + 50) continue

    // Shadow
    c.globalAlpha = 0.2
    drawCircle(obj.x + 3, obj.y + 5, obj.type === 'viking' ? 16 : 10, '#000')
    c.globalAlpha = 1

    switch (obj.type) {
      case 'viking': {
        // Body
        drawCircle(obj.x, obj.y + 4, 15, '#4A2A1A')
        // Fur cloak edge
        drawCircle(obj.x, obj.y + 6, 14, '#5A3520')
        // Head
        drawCircle(obj.x, obj.y - 6, 12, '#8B7355')
        // Helmet shine
        drawCircle(obj.x - 2, obj.y - 9, 3, 'rgba(200, 180, 140, 0.3)')
        // Horns (triangular)
        c.beginPath(); c.moveTo(obj.x - 11, obj.y - 7); c.lineTo(obj.x - 18, obj.y - 20); c.lineTo(obj.x - 7, obj.y - 10); c.fillStyle = '#C9A84C'; c.fill()
        c.beginPath(); c.moveTo(obj.x + 11, obj.y - 7); c.lineTo(obj.x + 18, obj.y - 20); c.lineTo(obj.x + 7, obj.y - 10); c.fillStyle = '#C9A84C'; c.fill()
        // Shield
        drawCircle(obj.x, obj.y + 14, 10, '#3A5A7A')
        drawCircle(obj.x, obj.y + 14, 5, '#8B7355')
        // Shield rim
        c.strokeStyle = '#5A7A9A'; c.lineWidth = 1.5; c.beginPath(); c.arc(obj.x, obj.y + 14, 10, 0, Math.PI * 2); c.stroke()
        break
      }
      case 'beer': {
        // Glow pulse
        const pulse = 0.08 + Math.sin(time * 6 + obj.y) * 0.04
        drawCircle(obj.x, obj.y, 18, `rgba(245, 166, 35, ${pulse})`)
        // Can body with gradient look
        drawRect(obj.x - 9, obj.y - 13, 18, 26, '#D8D8D8', 5)
        // Label
        drawRect(obj.x - 8, obj.y - 8, 16, 16, '#1A4A1A', 3)
        // Gold brand stripe
        drawRect(obj.x - 7, obj.y - 2, 14, 4, '#D4860A')
        drawText('IPA', obj.x, obj.y + 3, '#F5A623', 6, 'center', '"Space Grotesk"')
        // Can top with pull tab
        drawCircle(obj.x, obj.y - 12, 6, '#C0C0C0')
        drawRect(obj.x - 1, obj.y - 16, 3, 4, '#B0B0B0', 1)
        // Metallic highlight
        drawRect(obj.x + 4, obj.y - 10, 2, 18, 'rgba(255,255,255,0.15)', 1)
        break
      }
      case 'cone': {
        c.beginPath()
        c.moveTo(obj.x, obj.y - 16)
        c.lineTo(obj.x - 10, obj.y + 8)
        c.lineTo(obj.x + 10, obj.y + 8)
        c.closePath()
        c.fillStyle = '#FF5500'; c.fill()
        c.strokeStyle = '#CC4400'; c.lineWidth = 1; c.stroke()
        drawRect(obj.x - 8, obj.y - 6, 16, 4, '#FFFFFF')
        drawRect(obj.x - 7, obj.y + 1, 14, 3, '#FFFFFF')
        drawRect(obj.x - 12, obj.y + 7, 24, 4, '#FF5500', 2)
        break
      }
      case 'jim': {
        // Pink aura
        const jimPulse = 0.1 + Math.sin(time * 4) * 0.05
        drawCircle(obj.x, obj.y, 24, `rgba(232, 67, 147, ${jimPulse})`)
        // Dalmatian shirt body
        drawRect(obj.x - 13, obj.y + 8, 26, 16, '#F5F0E8', 5)
        drawCircle(obj.x - 5, obj.y + 12, 2.5, '#1A1A1A')
        drawCircle(obj.x + 6, obj.y + 15, 3, '#1A1A1A')
        drawCircle(obj.x + 1, obj.y + 10, 1.5, '#1A1A1A')
        // Bald head
        drawCircle(obj.x, obj.y - 2, 14, '#E0B89A')
        // Scalp tattoo
        c.strokeStyle = '#9E3030'; c.lineWidth = 1.2
        c.beginPath(); c.moveTo(obj.x - 9, obj.y - 5); c.quadraticCurveTo(obj.x, obj.y - 16, obj.x + 9, obj.y - 5); c.stroke()
        c.beginPath(); c.moveTo(obj.x - 6, obj.y - 7); c.quadraticCurveTo(obj.x, obj.y - 14, obj.x + 6, obj.y - 7); c.stroke()
        drawCircle(obj.x, obj.y - 13, 2, '#9E3030')
        // Score indicator
        drawText('+200', obj.x, obj.y - 24, '#E84393', 12, 'center', '"Space Grotesk"')
        break
      }
    }
  }

  // === SCORE POPUPS ===
  for (const sp of scorePopups) {
    c.globalAlpha = Math.min(sp.life / 0.3, 1)
    drawText(sp.text, sp.x, sp.y, sp.color, 14, 'center', '"Space Grotesk"')
    c.globalAlpha = 1
  }

  // === PARTICLES ===
  for (const p of particles) {
    c.globalAlpha = p.life / p.maxLife
    drawCircle(p.x, p.y, p.size * (p.life / p.maxLife), p.color)
  }
  c.globalAlpha = 1

  // Dalmatiner (render in objects pass)
  for (const obj of objects) {
    if (obj.collected || obj.y < -50 || obj.y > H + 50 || obj.type !== 'dalmatiner') continue
    c.globalAlpha = 0.2; drawCircle(obj.x + 2, obj.y + 4, 14, '#000'); c.globalAlpha = 1
    drawCircle(obj.x, obj.y, 14, '#FFFFFF')
    drawCircle(obj.x, obj.y - 6, 10, '#FFFFFF')
    drawCircle(obj.x - 5, obj.y - 2, 3, '#1A1A1A')
    drawCircle(obj.x + 6, obj.y + 3, 3.5, '#1A1A1A')
    drawCircle(obj.x - 2, obj.y + 7, 2, '#1A1A1A')
    drawCircle(obj.x + 3, obj.y - 8, 2.5, '#1A1A1A')
    drawCircle(obj.x - 7, obj.y - 10, 4, '#2A2A2A')
    drawCircle(obj.x + 7, obj.y - 10, 4, '#2A2A2A')
    drawCircle(obj.x, obj.y - 8, 2, '#1A1A1A')
    const tailX = Math.sin(time * 8) * 5
    drawLine(obj.x, obj.y + 12, obj.x + tailX, obj.y + 20, '#FFFFFF', 2.5)
    drawCircle(obj.x, obj.y, 20, 'rgba(255,255,255,0.08)')
    drawText('+150', obj.x, obj.y - 22, '#FFFFFF', 10, 'center', '"Space Grotesk"')
  }

  // === LARS' PORSCHE 911 ===
  const cx = carX + CAR_W / 2
  const cy = carY
  const tilt = tiltAngle

  c.save()
  c.translate(cx, cy + CAR_H / 2)
  c.rotate(tilt)
  c.translate(-cx, -(cy + CAR_H / 2))

  // Shadow
  c.globalAlpha = 0.3
  c.beginPath()
  c.ellipse(cx + 4, cy + CAR_H + 4, CAR_W * 0.48, 10, 0, 0, Math.PI * 2)
  c.fillStyle = '#000'; c.fill()
  c.globalAlpha = 1

  // Car body path - Porsche 911 top-down
  c.beginPath()
  c.moveTo(cx - 14, cy + 10)
  c.quadraticCurveTo(cx - 6, cy - 2, cx, cy - 4) // Left front fender curve
  c.quadraticCurveTo(cx + 6, cy - 2, cx + 14, cy + 10) // Right front fender
  c.lineTo(cx + 18, cy + 20) // Right front wheel arch
  c.lineTo(cx + 16, cy + 28)
  c.lineTo(cx + 20, cy + 34) // Right door
  c.lineTo(cx + 24, cy + 48) // Right rear fender (WIDE - 911 signature)
  c.lineTo(cx + 25, cy + 60)
  c.quadraticCurveTo(cx + 24, cy + CAR_H, cx, cy + CAR_H + 2)
  c.quadraticCurveTo(cx - 24, cy + CAR_H, cx - 25, cy + 60)
  c.lineTo(cx - 24, cy + 48) // Left rear fender
  c.lineTo(cx - 20, cy + 34)
  c.lineTo(cx - 16, cy + 28)
  c.lineTo(cx - 18, cy + 20)
  c.closePath()

  // Metallic gradient
  const carGrad = c.createLinearGradient(cx - 25, cy, cx + 25, cy + CAR_H)
  carGrad.addColorStop(0, '#B86B3A')
  carGrad.addColorStop(0.2, '#9A5525')
  carGrad.addColorStop(0.4, '#A86030')
  carGrad.addColorStop(0.6, '#8B4513')
  carGrad.addColorStop(0.8, '#7A3A10')
  carGrad.addColorStop(1, '#6B3010')
  c.fillStyle = carGrad; c.fill()
  c.strokeStyle = '#4A2508'; c.lineWidth = 1.5; c.stroke()

  // Metallic highlight stripe
  c.globalAlpha = 0.12
  c.fillStyle = '#FFFFFF'
  c.fillRect(cx - 3, cy + 5, 6, CAR_H - 15)
  c.globalAlpha = 1

  // Windshield
  c.beginPath()
  c.moveTo(cx - 11, cy + 8)
  c.quadraticCurveTo(cx, cy + 3, cx + 11, cy + 8)
  c.lineTo(cx + 13, cy + 24)
  c.lineTo(cx - 13, cy + 24)
  c.closePath()
  const windGrad = c.createLinearGradient(cx, cy + 3, cx, cy + 24)
  windGrad.addColorStop(0, 'rgba(120, 200, 255, 0.45)')
  windGrad.addColorStop(1, 'rgba(80, 160, 220, 0.25)')
  c.fillStyle = windGrad; c.fill()
  c.strokeStyle = '#4A2508'; c.lineWidth = 0.7; c.stroke()

  // A-pillar lines
  drawLine(cx - 11, cy + 8, cx - 13, cy + 24, '#4A2508', 0.7)
  drawLine(cx + 11, cy + 8, cx + 13, cy + 24, '#4A2508', 0.7)

  // Rear window
  c.beginPath()
  c.moveTo(cx - 10, cy + CAR_H - 20)
  c.lineTo(cx + 10, cy + CAR_H - 20)
  c.lineTo(cx + 8, cy + CAR_H - 10)
  c.lineTo(cx - 8, cy + CAR_H - 10)
  c.closePath()
  c.fillStyle = 'rgba(80, 160, 220, 0.2)'; c.fill()

  // Headlights - round (classic 911)
  const hlGlow = c.createRadialGradient(cx - 12, cy + 2, 0, cx - 12, cy + 2, 8)
  hlGlow.addColorStop(0, '#FFFFCC'); hlGlow.addColorStop(0.5, '#FFE066'); hlGlow.addColorStop(1, 'rgba(255, 224, 102, 0)')
  c.fillStyle = hlGlow; c.fillRect(cx - 20, cy - 6, 16, 16)
  const hlGlow2 = c.createRadialGradient(cx + 12, cy + 2, 0, cx + 12, cy + 2, 8)
  hlGlow2.addColorStop(0, '#FFFFCC'); hlGlow2.addColorStop(0.5, '#FFE066'); hlGlow2.addColorStop(1, 'rgba(255, 224, 102, 0)')
  c.fillStyle = hlGlow2; c.fillRect(cx + 4, cy - 6, 16, 16)
  drawCircle(cx - 12, cy + 2, 5, '#FFE066')
  drawCircle(cx + 12, cy + 2, 5, '#FFE066')
  drawCircle(cx - 12, cy + 2, 2.5, '#FFFFCC')
  drawCircle(cx + 12, cy + 2, 2.5, '#FFFFCC')

  // Tail lights
  drawRect(cx - 22, cy + CAR_H - 8, 8, 5, '#FF2222', 2)
  drawRect(cx + 14, cy + CAR_H - 8, 8, 5, '#FF2222', 2)
  // Tail light glow
  const tlGlow = c.createRadialGradient(cx - 18, cy + CAR_H - 5, 0, cx - 18, cy + CAR_H - 5, 12)
  tlGlow.addColorStop(0, 'rgba(255, 30, 30, 0.15)'); tlGlow.addColorStop(1, 'rgba(255, 30, 30, 0)')
  c.fillStyle = tlGlow; c.fillRect(cx - 30, cy + CAR_H - 17, 24, 24)

  // Side mirrors
  drawCircle(cx - 20, cy + 16, 3.5, '#7A3A10')
  drawCircle(cx + 20, cy + 16, 3.5, '#7A3A10')

  // Rust patches (subtle)
  c.globalAlpha = 0.35
  drawCircle(cx + 15, cy + 22, 4, '#A06030')
  drawCircle(cx - 10, cy + 52, 5, '#A06030')
  drawCircle(cx + 8, cy + 62, 3, '#A06030')
  c.globalAlpha = 1

  // Porsche badge
  drawCircle(cx, cy + 9, 3.5, '#C9A84C')
  drawCircle(cx, cy + 9, 1.8, '#8B6914')

  // Lars visible (beanie from above in driver position)
  drawCircle(cx, cy + 15, 6, '#1A1A1A') // beanie
  drawCircle(cx, cy + 15, 4.5, '#222222') // beanie center
  // Sunglasses glare
  drawRect(cx - 3, cy + 17, 2.5, 1.5, 'rgba(255,255,255,0.5)', 1)
  drawRect(cx + 0.5, cy + 17, 2.5, 1.5, 'rgba(255,255,255,0.5)', 1)
  // Hands on wheel
  drawCircle(cx - 5, cy + 22, 2, '#D4A574')
  drawCircle(cx + 5, cy + 22, 2, '#D4A574')

  // Headlight beams
  if (gameState.value === 'playing') {
    c.globalAlpha = 0.05
    c.fillStyle = '#FFFF88'
    c.beginPath()
    c.moveTo(cx - 16, cy)
    c.lineTo(cx - 50, cy - 200)
    c.lineTo(cx + 50, cy - 200)
    c.lineTo(cx + 16, cy)
    c.fill()
    c.globalAlpha = 1
  }

  c.restore() // End car tilt

  // Exhaust particles
  if (gameState.value === 'playing') {
    for (let s = 0; s < 6; s++) {
      const sy = cy + CAR_H + 8 + s * 8 + (roadScroll * 0.25 % 10)
      const sx = cx - 4 + Math.sin(time * 5 + s * 1.3) * (2 + s * 0.8)
      const size = 2 + s * 2
      c.globalAlpha = 0.15 - s * 0.02
      drawCircle(sx, sy, size, '#999')
    }
    c.globalAlpha = 1
  }

  c.restore() // End shake

  // === HUD - Top bar ===
  const hudGrad = c.createLinearGradient(0, 0, 0, 58)
  hudGrad.addColorStop(0, 'rgba(15, 25, 35, 0.92)')
  hudGrad.addColorStop(1, 'rgba(15, 25, 35, 0.7)')
  c.fillStyle = hudGrad; c.fillRect(0, 0, W, 58)
  drawLine(0, 58, W, 58, 'rgba(255,255,255,0.05)', 1)

  drawText('SCORE', 14, 14, '#8892A0', 9, 'left', '"Space Grotesk"')
  drawText(`${score.value}`, 14, 35, '#FFFFFF', 20, 'left', '"Space Grotesk"')

  drawText(`${kmh}`, W / 2, 26, '#F5A623', 20, 'center', '"JetBrains Mono"')
  drawText('km/t', W / 2, 45, '#8892A0', 9, 'center')

  drawText(`Best: ${highScore.value}`, W - 14, 14, '#8892A0', 9, 'right')

  // === SCORECARD - Bottom bar ===
  const scY = H - 44
  drawRect(0, scY, W, 44, 'rgba(15, 25, 35, 0.88)')
  drawLine(0, scY, W, scY, 'rgba(255,255,255,0.05)', 1)

  // Beer count
  drawRect(14, scY + 8, 28, 28, 'rgba(245, 166, 35, 0.15)', 6)
  drawText('\u{1F37A}', 28, scY + 22, '#F5A623', 14, 'center')
  drawText(`${beerCount}`, 52, scY + 22, '#F5A623', 14, 'left', '"Space Grotesk"')

  // Jim count
  const jx = W / 2 - 30
  drawRect(jx, scY + 8, 28, 28, 'rgba(232, 67, 147, 0.15)', 6)
  drawText('J', jx + 14, scY + 22, '#E84393', 14, 'center', '"Space Grotesk"')
  drawText(`${jimCount}`, jx + 38, scY + 22, '#E84393', 14, 'left', '"Space Grotesk"')

  // Dalmatiner count
  const dx = W - 80
  drawRect(dx, scY + 8, 28, 28, 'rgba(255, 255, 255, 0.1)', 6)
  drawCircle(dx + 14, scY + 19, 6, '#FFFFFF')
  drawCircle(dx + 11, scY + 17, 2, '#1A1A1A')
  drawCircle(dx + 17, scY + 21, 1.5, '#1A1A1A')
  drawText(`${dalmatinerCount}`, dx + 38, scY + 22, '#FFFFFF', 14, 'left', '"Space Grotesk"')

  // Menu
  if (gameState.value === 'menu') {
    drawRect(0, 0, W, H, 'rgba(8, 12, 20, 0.92)')

    drawCircle(W / 2, H * 0.14, 80, 'rgba(245, 166, 35, 0.06)')
    drawText("LARS'", W / 2, H * 0.14, '#8892A0', 16, 'center', '"Space Grotesk"')
    drawText('PORSCHE DASH', W / 2, H * 0.14 + 28, '#F5A623', 26, 'center', '"Space Grotesk"')

    // What to collect / avoid
    const legend = [
      ['\u{1F37A}', 'Saml \u00f8l', '+50', '#F5A623'],
      ['J', 'Find Jim', '+200', '#E84393'],
      ['\u{1F436}', 'Find dalmatiner', '+150', '#FFFFFF'],
      ['\u2620', 'Undvig vikinger', 'CRASH', '#FF4757'],
      ['\u26d4', 'Undvig kegler', 'CRASH', '#FF5500'],
    ]
    let ly = H * 0.28
    for (const [icon, desc, pts, col] of legend) {
      drawRect(W / 2 - 110, ly - 10, 220, 24, 'rgba(255,255,255,0.03)', 6)
      drawText(icon as string, W / 2 - 85, ly + 2, col as string, 13, 'center')
      drawText(desc as string, W / 2 - 20, ly + 2, '#CCC', 12, 'center')
      drawText(pts as string, W / 2 + 85, ly + 2, col as string, 11, 'center', '"Space Grotesk"')
      ly += 28
    }

    // Controls
    drawRect(W / 2 - 110, H * 0.58, 220, 65, 'rgba(255,255,255,0.03)', 10)
    drawText('\u2190 \u2191 \u2193 \u2192  Kør rundt', W / 2, H * 0.58 + 20, '#FFFFFF', 13, 'center')
    drawText('Mobil: Tryk kanter for at styre', W / 2, H * 0.58 + 44, '#8892A0', 10, 'center')

    drawRect(W / 2 - 80, H * 0.76, 160, 46, '#F5A623', 14)
    drawText('K\u00d8R!', W / 2, H * 0.76 + 23, '#0F1923', 18, 'center', '"Space Grotesk"')
  }

  if (gameState.value === 'dead') {
    drawRect(0, 0, W, H, 'rgba(8, 12, 20, 0.92)')
    drawCircle(W / 2, H * 0.18, 60, 'rgba(255, 71, 87, 0.08)')
    drawText('CRASH!', W / 2, H * 0.2, '#FF4757', 36, 'center', '"Space Grotesk"')
    drawText(`Score: ${score.value}`, W / 2, H * 0.2 + 48, '#FFFFFF', 26, 'center', '"Space Grotesk"')

    // Stats
    let sy = H * 0.2 + 85
    drawText(`\u{1F37A} ${beerCount} \u00f8l`, W / 2 - 60, sy, '#F5A623', 13, 'center')
    drawText(`J ${jimCount} Jim`, W / 2, sy, '#E84393', 13, 'center')
    drawText(`\u{1F436} ${dalmatinerCount}`, W / 2 + 60, sy, '#FFFFFF', 13, 'center')

    if (score.value >= highScore.value && score.value > 0) {
      drawText('\u2605 NY HIGH SCORE! \u2605', W / 2, sy + 30, '#F5A623', 15, 'center', '"Space Grotesk"')
    }
    drawRect(W / 2 - 80, H * 0.6, 160, 46, 'rgba(255,255,255,0.08)', 14)
    drawText('PR\u00d8V IGEN', W / 2, H * 0.6 + 23, '#FFFFFF', 16, 'center', '"Space Grotesk"')
  }
}

const gameLoop = ref<ReturnType<typeof createGameLoop> | null>(null)

// Mobile: hold touch position to steer
let touchActive = false
let touchX = 0
let touchY = 0

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchActive = true
  touchX = touch.clientX
  touchY = touch.clientY
}

function handleTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchX = touch.clientX
  touchY = touch.clientY
}

function handleTouchEnd() {
  touchActive = false
}

onMounted(() => {
  setTimeout(() => {
    initCanvas(); resetGame()
    canvasRef.value?.addEventListener('touchstart', handleTouchStart, { passive: true })
    canvasRef.value?.addEventListener('touchmove', handleTouchMove, { passive: true })
    canvasRef.value?.addEventListener('touchend', handleTouchEnd)
    const loop = createGameLoop(
      (dt) => {
        if (gameState.value !== 'playing') {
          if (consumeTap()) {
            if (gameState.value === 'dead') resetGame()
            gameState.value = 'playing'; showJim.value = false
          }
        }
        update(dt)
      },
      render,
    )
    gameLoop.value = loop; loop.start()
  }, 100)
})

onUnmounted(() => {
  gameLoop.value?.stop()
  canvasRef.value?.removeEventListener('touchstart', handleTouchStart)
  canvasRef.value?.removeEventListener('touchmove', handleTouchMove)
  canvasRef.value?.removeEventListener('touchend', handleTouchEnd)
})
</script>

<template>
  <div class="h-screen flex flex-col bg-primary overflow-hidden">
    <div class="flex items-center justify-between px-4 pt-3 pb-1 z-10">
      <button class="w-9 h-9 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors" @click="gameLoop?.stop(); router.push('/minigames')">
        <Icon name="mdi:arrow-left" size="18" />
      </button>
      <span class="font-heading font-bold text-sm text-muted">Lars' Porsche Dash</span>
      <div class="w-9" />
    </div>
    <div class="flex-1 relative">
      <canvas ref="canvasRef" class="w-full h-full block touch-none" />
    </div>
    <JimQuote :show="showJim" :quote="jimMessage" mode="toast" @dismiss="showJim = false" />
  </div>
</template>
