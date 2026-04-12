import { ref, onMounted, onUnmounted } from 'vue'

export interface SwipeState {
  offsetX: number
  offsetY: number
  rotation: number
  isDragging: boolean
  direction: 'left' | 'right' | null
  opacity: number
  flyingOut: boolean
}

const SWIPE_THRESHOLD = 60 // Very easy to trigger
const MAX_ROTATION = 20
const FLY_OUT_DISTANCE = 1500
const FLY_OUT_DURATION = 250 // Faster fly-out

export const useSwipe = (
  cardRef: Ref<HTMLElement | null>,
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
) => {
  const swipeState = ref<SwipeState>({
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    isDragging: false,
    direction: null,
    opacity: 1,
    flyingOut: false,
  })

  let startX = 0
  let startY = 0
  let currentX = 0
  let currentY = 0
  let startTime = 0
  let velocityX = 0
  let lastX = 0
  let lastTime = 0

  function handleStart(x: number, y: number) {
    if (swipeState.value.flyingOut) return
    swipeState.value.isDragging = true
    startX = x
    startY = y
    currentX = x
    currentY = y
    lastX = x
    startTime = Date.now()
    lastTime = startTime
    velocityX = 0
  }

  function handleMove(x: number, y: number) {
    if (!swipeState.value.isDragging || swipeState.value.flyingOut) return

    currentX = x
    currentY = y

    // Track velocity
    const now = Date.now()
    const dt = now - lastTime
    if (dt > 0) {
      velocityX = (x - lastX) / dt * 1000 // pixels per second
      lastX = x
      lastTime = now
    }

    const deltaX = currentX - startX
    const deltaY = (currentY - startY) * 0.3

    swipeState.value.offsetX = deltaX
    swipeState.value.offsetY = deltaY
    swipeState.value.rotation = (deltaX / window.innerWidth) * MAX_ROTATION
    swipeState.value.direction = deltaX > 30 ? 'right' : deltaX < -30 ? 'left' : null

    // Fade labels in as card moves
    swipeState.value.opacity = 1
  }

  function flyOut(direction: 'left' | 'right') {
    swipeState.value.flyingOut = true
    swipeState.value.isDragging = false

    const targetX = direction === 'right' ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE
    const targetRotation = direction === 'right' ? 30 : -30

    swipeState.value.offsetX = targetX
    swipeState.value.offsetY = swipeState.value.offsetY - 50
    swipeState.value.rotation = targetRotation
    swipeState.value.opacity = 0

    // Fire callback after fly-out animation completes
    setTimeout(() => {
      if (direction === 'right') {
        onSwipeRight()
      } else {
        onSwipeLeft()
      }
      // Reset after callback
      resetCard()
    }, FLY_OUT_DURATION)
  }

  function resetCard() {
    swipeState.value.offsetX = 0
    swipeState.value.offsetY = 0
    swipeState.value.rotation = 0
    swipeState.value.direction = null
    swipeState.value.opacity = 1
    swipeState.value.flyingOut = false
  }

  function handleEnd() {
    if (!swipeState.value.isDragging || swipeState.value.flyingOut) return
    swipeState.value.isDragging = false

    const deltaX = currentX - startX
    const absVelocity = Math.abs(velocityX)

    // Trigger swipe if either: past threshold OR fast flick
    const pastThreshold = Math.abs(deltaX) >= SWIPE_THRESHOLD
    const fastFlick = absVelocity > 500 && Math.abs(deltaX) > 20

    if (pastThreshold || fastFlick) {
      const direction = deltaX > 0 ? 'right' : 'left'
      flyOut(direction)
    } else {
      // Snap back to center with spring animation
      swipeState.value.offsetX = 0
      swipeState.value.offsetY = 0
      swipeState.value.rotation = 0
      swipeState.value.direction = null
      swipeState.value.opacity = 1
    }
  }

  // Public method to trigger fly-out from buttons
  function triggerSwipe(direction: 'left' | 'right') {
    if (swipeState.value.flyingOut) return
    // Small initial offset for visual feedback
    swipeState.value.offsetX = direction === 'right' ? 20 : -20
    swipeState.value.rotation = direction === 'right' ? 3 : -3
    swipeState.value.direction = direction

    requestAnimationFrame(() => flyOut(direction))
  }

  // Touch events
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.preventDefault()
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  function onTouchEnd() {
    handleEnd()
  }

  // Mouse events
  function onMouseDown(e: MouseEvent) {
    handleStart(e.clientX, e.clientY)
  }

  function onMouseMove(e: MouseEvent) {
    handleMove(e.clientX, e.clientY)
  }

  function onMouseUp() {
    handleEnd()
  }

  onMounted(() => {
    const el = cardRef.value
    if (!el) return

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  })

  onUnmounted(() => {
    const el = cardRef.value
    if (el) {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
    }
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  })

  function getCardStyle() {
    const s = swipeState.value
    const transition = s.isDragging
      ? 'none'
      : s.flyingOut
        ? `transform ${FLY_OUT_DURATION}ms cubic-bezier(0.2, 0, 0.2, 1), opacity ${FLY_OUT_DURATION}ms ease-out`
        : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'

    return {
      transform: `translate(${s.offsetX}px, ${s.offsetY}px) rotate(${s.rotation}deg)`,
      opacity: s.opacity,
      transition,
      cursor: s.flyingOut ? 'default' : s.isDragging ? 'grabbing' : 'grab',
      pointerEvents: s.flyingOut ? 'none' : 'auto' as any,
    }
  }

  return {
    swipeState,
    getCardStyle,
    triggerSwipe,
    resetCard,
  }
}
