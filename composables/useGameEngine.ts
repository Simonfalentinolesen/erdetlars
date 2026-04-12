import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export function useGameEngine(canvasRef: Ref<HTMLCanvasElement | null>) {
  const ctx = ref<CanvasRenderingContext2D | null>(null)
  const width = ref(0)
  const height = ref(0)
  let animFrameId: number | null = null
  let lastTime = 0
  let eventsAttached = false

  function initCanvas() {
    const canvas = canvasRef.value
    if (!canvas) return false

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false

    width.value = rect.width
    height.value = rect.height
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const context = canvas.getContext('2d')!
    context.scale(dpr, dpr)
    ctx.value = context

    // Attach events if not already
    if (!eventsAttached) {
      canvas.addEventListener('touchstart', onTouchStart, { passive: false })
      canvas.addEventListener('touchend', onTouchEnd)
      canvas.addEventListener('mousedown', onMouseDown)
      eventsAttached = true
    }

    return true
  }

  function createGameLoop(updateFn: (dt: number) => void, renderFn: () => void) {
    const isRunning = ref(false)

    function loop(timestamp: number) {
      if (!isRunning.value) return

      const dt = Math.min((timestamp - lastTime) / 1000, 0.05)
      lastTime = timestamp

      updateFn(dt)
      renderFn()

      animFrameId = requestAnimationFrame(loop)
    }

    return {
      start() {
        if (isRunning.value) return
        isRunning.value = true
        lastTime = performance.now()
        // Ensure canvas is ready
        if (!width.value || !height.value) initCanvas()
        animFrameId = requestAnimationFrame(loop)
      },
      stop() {
        isRunning.value = false
        if (animFrameId) {
          cancelAnimationFrame(animFrameId)
          animFrameId = null
        }
      },
      isRunning,
    }
  }

  // Input handling
  const keys = ref<Set<string>>(new Set())
  const tapped = ref(false)

  function onKeyDown(e: KeyboardEvent) {
    keys.value.add(e.code)
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      tapped.value = true
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.value.delete(e.code)
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault()
    tapped.value = true
    keys.value.add('Space')
  }

  function onTouchEnd() {
    keys.value.delete('Space')
  }

  function onMouseDown() {
    tapped.value = true
  }

  function consumeTap(): boolean {
    if (tapped.value) {
      tapped.value = false
      return true
    }
    return false
  }

  onMounted(async () => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Try init immediately, then retry after nextTick
    if (!initCanvas()) {
      await nextTick()
      initCanvas()
    }

    window.addEventListener('resize', () => initCanvas())
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)

    const canvas = canvasRef.value
    if (canvas && eventsAttached) {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('mousedown', onMouseDown)
    }

    if (animFrameId) cancelAnimationFrame(animFrameId)
  })

  // Drawing helpers
  function clear(color: string = '#0F1923') {
    if (!ctx.value) return
    ctx.value.fillStyle = color
    ctx.value.fillRect(0, 0, width.value, height.value)
  }

  function drawRect(x: number, y: number, w: number, h: number, color: string, radius: number = 0) {
    if (!ctx.value) return
    ctx.value.fillStyle = color
    if (radius > 0) {
      ctx.value.beginPath()
      ctx.value.roundRect(x, y, w, h, radius)
      ctx.value.fill()
    } else {
      ctx.value.fillRect(x, y, w, h)
    }
  }

  function drawCircle(x: number, y: number, r: number, color: string) {
    if (!ctx.value) return
    ctx.value.fillStyle = color
    ctx.value.beginPath()
    ctx.value.arc(x, y, r, 0, Math.PI * 2)
    ctx.value.fill()
  }

  function drawText(text: string, x: number, y: number, color: string, size: number = 16, align: CanvasTextAlign = 'left', font: string = 'DM Sans') {
    if (!ctx.value) return
    ctx.value.fillStyle = color
    ctx.value.font = `bold ${size}px ${font}`
    ctx.value.textAlign = align
    ctx.value.textBaseline = 'middle'
    ctx.value.fillText(text, x, y)
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number = 2) {
    if (!ctx.value) return
    ctx.value.strokeStyle = color
    ctx.value.lineWidth = lineWidth
    ctx.value.beginPath()
    ctx.value.moveTo(x1, y1)
    ctx.value.lineTo(x2, y2)
    ctx.value.stroke()
  }

  function collides(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
  }

  // Draw Lars helper - consistent across all games
  function drawLars(x: number, y: number, scale: number = 1, variant: 'normal' | 'drunk' | 'viking' | 'rainbow' = 'normal') {
    if (!ctx.value) return
    const s = scale
    const c = ctx.value

    c.save()
    c.translate(x, y)
    c.scale(s, s)

    // Body
    const bodyColor = variant === 'rainbow' ? '#FF69B4' : variant === 'viking' ? '#5A3A2A' : variant === 'drunk' ? '#4A6A3A' : '#3A4A3A'
    drawRect(-12, 2, 24, 18, bodyColor, 3)

    // Head (big, round)
    drawCircle(0, -8, 11, '#D4A574')

    // Beanie
    drawRect(-11, -20, 22, 10, '#1A1A1A', 4)
    drawCircle(0, -22, 4, '#1A1A1A') // pom pom

    // Viking helmet horns (if viking)
    if (variant === 'viking') {
      drawRect(-12, -20, 24, 10, '#8B7355', 4)
      drawLine(-12, -16, -20, -28, '#A89070', 3)
      drawLine(12, -16, 20, -28, '#A89070', 3)
    }

    // Dark thick beard
    drawRect(-8, -2, 16, 8, '#2A1A0A', 3)
    drawRect(-6, 4, 12, 4, '#1A0A00', 2) // longer bottom

    // Sunglasses
    drawRect(-8, -11, 7, 5, '#0A0A0A', 2)
    drawRect(1, -11, 7, 5, '#0A0A0A', 2)
    drawLine(-1, -9, 1, -9, '#0A0A0A', 1)
    // Lens glare
    drawRect(-6, -11, 2, 1, 'rgba(255,255,255,0.3)')
    drawRect(3, -11, 2, 1, 'rgba(255,255,255,0.3)')

    // Gold chain
    c.strokeStyle = '#F5A623'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(-6, 4)
    c.quadraticCurveTo(0, 10, 6, 4)
    c.stroke()
    drawCircle(0, 9, 2.5, '#F5A623')

    // Beer can in hand
    drawRect(14, -4, 8, 14, '#C0C0C0', 2) // can
    drawRect(14, -2, 8, 3, '#D4260A', 1)   // label red
    drawRect(14, 1, 8, 3, '#F5A623', 1)    // label gold
    // Can top
    drawRect(15, -6, 6, 3, '#A0A0A0', 1)

    // Legs
    drawRect(-8, 20, 7, 10, '#2A2A5A', 2)
    drawRect(1, 20, 7, 10, '#2A2A5A', 2)

    // Rainbow effect
    if (variant === 'rainbow') {
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF']
      for (let i = 0; i < 6; i++) {
        drawCircle(Math.sin(Date.now() * 0.005 + i) * 18, -10 + i * 6, 3, colors[i] + '40')
      }
    }

    c.restore()
  }

  // Draw Jim Lyngvild helper - BALD, red scalp tattoos, ice-blue eyes, stern look
  function drawJim(x: number, y: number, scale: number = 1) {
    if (!ctx.value) return
    const c = ctx.value

    c.save()
    c.translate(x, y)
    c.scale(scale, scale)

    // Body (dalmatian pattern shirt - Jim loves his dalmatian!)
    drawRect(-10, 6, 20, 18, '#F5F0E8', 3)
    // Dalmatian spots
    drawCircle(-5, 10, 2.5, '#1A1A1A')
    drawCircle(4, 14, 3, '#1A1A1A')
    drawCircle(-3, 18, 2, '#1A1A1A')
    drawCircle(6, 9, 1.5, '#1A1A1A')
    // V-neck
    c.strokeStyle = '#D0C8B8'
    c.lineWidth = 0.8
    c.beginPath()
    c.moveTo(-4, 6)
    c.lineTo(0, 12)
    c.lineTo(4, 6)
    c.stroke()

    // Neck
    drawRect(-4, 2, 8, 6, '#E0B89A', 2)

    // Head (BALD - smooth skin)
    drawCircle(0, -6, 10, '#E0B89A')

    // Red viking/celtic tattoo on scalp
    c.strokeStyle = '#9E3030'
    c.lineWidth = 1
    // Main arch
    c.beginPath()
    c.moveTo(-8, -9)
    c.quadraticCurveTo(-5, -16, 0, -16)
    c.quadraticCurveTo(5, -16, 8, -9)
    c.stroke()
    // Inner arch
    c.lineWidth = 0.7
    c.beginPath()
    c.moveTo(-6, -10)
    c.quadraticCurveTo(-3, -14, 0, -14.5)
    c.quadraticCurveTo(3, -14, 6, -10)
    c.stroke()
    // Knot patterns
    c.beginPath()
    c.moveTo(-5, -11)
    c.quadraticCurveTo(-3, -13, -1, -11)
    c.stroke()
    c.beginPath()
    c.moveTo(5, -11)
    c.quadraticCurveTo(3, -13, 1, -11)
    c.stroke()
    // Center diamond
    drawCircle(0, -15, 1.5, '#9E3030')

    // NO beard - clean jaw line
    // Strong brow
    drawLine(-7, -8, -2, -8.5, '#C8A890', 1)
    drawLine(7, -8, 2, -8.5, '#C8A890', 1)

    // Piercing ice-blue eyes
    drawCircle(-3.5, -5.5, 2, '#FFFFFF')
    drawCircle(3.5, -5.5, 2, '#FFFFFF')
    drawCircle(-3.5, -5.5, 1.3, '#6AACDB')
    drawCircle(3.5, -5.5, 1.3, '#6AACDB')
    drawCircle(-3.5, -5.5, 0.5, '#1A2634')
    drawCircle(3.5, -5.5, 0.5, '#1A2634')

    // Stern mouth - thin line
    drawLine(-3, -0.5, 3, -0.5, '#B08070', 1)

    // Raised finger
    drawLine(12, 6, 18, -6, '#E0B89A', 2.5)
    drawCircle(18, -7, 1.8, '#E0B89A')

    c.restore()
  }

  return {
    ctx,
    width,
    height,
    keys,
    tapped,
    consumeTap,
    createGameLoop,
    initCanvas,
    clear,
    drawRect,
    drawCircle,
    drawText,
    drawLine,
    collides,
    drawLars,
    drawJim,
  }
}
