<script setup lang="ts">
import confetti from 'canvas-confetti'
import imageData from '~/data/images.json'
import type { GameImage } from '~/composables/useGame'

const router = useRouter()
const { getCorrectQuote, getWrongQuote } = useJim()
const { unlock: unlockCard } = useCollection()
const { recordDrunkMax, recordFooled, recordCorrectAnswer, resetStreakTimer, checkAll } = useAchievements()
const { unlockedCount, totalCount, mythicalUnlocked } = useCollection()
const { shouldShowTeaser, markTeaserDismissed, markTeaserClicked } = useMinigamePromo()

// Minigame teaser state (only teaser here — interstitial would break the drinking flow)
const teaserPromo = ref<ReturnType<typeof shouldShowTeaser>>(null)
function dismissTeaser() {
  markTeaserDismissed()
  teaserPromo.value = null
}
function playTeaser() {
  if (!teaserPromo.value) return
  markTeaserClicked()
  const path = teaserPromo.value.path
  teaserPromo.value = null
  stopDrinking()
  router.push(path)
}

// State
const score = ref(0)
const streak = ref(0)
const correct = ref(0)
const totalSwiped = ref(0)

// Promille (0 - 3.0)
const promille = ref(0)
const holding = ref(false)
const drunkMaxReached = ref(false)

// Queue
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const queue = ref<GameImage[]>(shuffle(imageData.images as GameImage[]))
const queueIndex = ref(0)

const currentImage = computed(() => queue.value[queueIndex.value] || null)

// Feedback
const showFeedback = ref(false)
const feedbackCorrect = ref(false)
const feedbackPoints = ref(0)
const jimQuote = ref('')
const showJim = ref(false)

const isProcessing = ref(false)
const swipeCardRef = ref<any>(null)
const answerFromButton = ref(false)

// Multiplier based on promille
const multiplier = computed(() => {
  if (promille.value < 1) return 1
  if (promille.value < 2) return 2
  return 3
})

// Blur modes — rotates per card so each new image has a different visual distortion
type BlurMode = 'heavy' | 'double' | 'motion' | 'tunnel' | 'chromatic'
const BLUR_MODES: BlurMode[] = ['heavy', 'double', 'motion', 'tunnel', 'chromatic']
const blurMode = ref<BlurMode>('heavy')

function pickRandomBlurMode() {
  // Don't repeat the same mode twice in a row
  const options = BLUR_MODES.filter(m => m !== blurMode.value)
  blurMode.value = options[Math.floor(Math.random() * options.length)]!
}

// Animation loop for visual wobble when drunk (drives the reactive tick)
let wobbleFrame: number | null = null
const wobbleTick = ref(0)
function wobbleLoop() {
  wobbleTick.value++
  wobbleFrame = requestAnimationFrame(wobbleLoop)
}

// Visual distortion based on promille — much heavier than before, with 5 rotating modes
const distortionStyle = computed(() => {
  // Read tick to force per-frame reactivity
  const tick = wobbleTick.value
  const p = promille.value
  if (p < 0.3) return {}

  const t = tick * 0.016 // approx seconds
  // Organic pulsing of the blur (breathing)
  const pulse = 1 + Math.sin(t * 1.8) * 0.18
  // Base intensity scales hard with promille
  const baseBlur = p * p * 1.2 * pulse        // at p=1: 1.4px, p=2: 5.6px, p=3: 12.6px
  const wobble = p * 4.5                       // degrees, way more than before
  const saturate = 1 + p * 0.45
  const hue = Math.sin(t * 0.7) * p * 22
  const rot = Math.sin(t * 2.2) * wobble
  const skewY = Math.sin(t * 1.4) * p * 0.8
  const drift = p * 2                          // position drift

  let filter = ''

  switch (blurMode.value) {
    case 'heavy':
      // Pure heavy gaussian — the classic drunk blur
      filter = `blur(${baseBlur}px) saturate(${saturate}) hue-rotate(${hue}deg) brightness(${1 + p * 0.08}) contrast(${1 + p * 0.12})`
      break

    case 'double':
      // Double vision — two offset ghost copies via drop-shadow
      {
        const ghostOffset = p * 5
        filter = `blur(${baseBlur * 0.55}px) saturate(${saturate}) ` +
          `drop-shadow(${ghostOffset}px 0 0 rgba(255, 100, 200, 0.55)) ` +
          `drop-shadow(${-ghostOffset}px ${ghostOffset * 0.3}px 0 rgba(100, 200, 255, 0.55))`
      }
      break

    case 'motion':
      // Motion blur — smearing + stronger hue wobble
      filter = `blur(${baseBlur * 0.9}px) saturate(${saturate * 1.1}) hue-rotate(${hue * 2.5}deg) contrast(${1 + p * 0.3})`
      break

    case 'tunnel':
      // Tunnel vision — heavy blur + dark + high contrast
      filter = `blur(${baseBlur * 1.4}px) saturate(${saturate * 0.65}) brightness(${1 - p * 0.18}) contrast(${1 + p * 0.35})`
      break

    case 'chromatic':
      // Chromatic aberration — RGB channels split
      {
        const split = p * 3.5
        filter = `blur(${baseBlur * 0.5}px) saturate(${saturate * 1.3}) ` +
          `drop-shadow(${split}px 0 0 rgba(255, 40, 120, 0.6)) ` +
          `drop-shadow(${-split}px 0 0 rgba(40, 220, 255, 0.6)) ` +
          `drop-shadow(0 ${split * 0.4}px 0 rgba(255, 200, 40, 0.4))`
      }
      break
  }

  return {
    filter,
    transform: `rotate(${rot}deg) skewY(${skewY}deg) translate(${Math.sin(t * 1.1) * drift}px, ${Math.cos(t * 0.8) * drift * 0.6}px)`,
  }
})

// Blink — triggers between cards when drunk enough, simulating eyelids
const showBlink = ref(false)
function triggerBlink() {
  showBlink.value = true
  setTimeout(() => { showBlink.value = false }, 450)
}

// Promille tick
let drinkInterval: ReturnType<typeof setInterval> | null = null

function startDrinking() {
  holding.value = true
  if (drinkInterval) clearInterval(drinkInterval)
  drinkInterval = setInterval(() => {
    if (promille.value < 3) {
      promille.value = Math.min(3, promille.value + 0.1)
      if (promille.value >= 3 && !drunkMaxReached.value) {
        drunkMaxReached.value = true
        recordDrunkMax()
        // Jim notification
        jimQuote.value = 'LARS! Du kan slet ikke se længere. DET er Lars-ånd. SKÅL!'
        showJim.value = true
        setTimeout(() => { showJim.value = false }, 3500)
      }
    }
  }, 180)
}

function stopDrinking() {
  holding.value = false
  if (drinkInterval) clearInterval(drinkInterval)
  drinkInterval = null
}

// Keyboard + pointer hold
function onKeyDown(e: KeyboardEvent) {
  if (isProcessing.value) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (!holding.value) startDrinking()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    handleButtonAnswer(false)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    handleButtonAnswer(true)
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') stopDrinking()
}

function onPointerDown() {
  if (!isProcessing.value && !holding.value) startDrinking()
}
function onPointerUp() {
  if (holding.value) stopDrinking()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  wobbleLoop()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  if (drinkInterval) clearInterval(drinkInterval)
  if (wobbleFrame) cancelAnimationFrame(wobbleFrame)
})

function handleButtonAnswer(guessedLars: boolean) {
  if (isProcessing.value || !currentImage.value) return
  isProcessing.value = true
  answerFromButton.value = true

  const direction = guessedLars ? 'right' : 'left'
  if (swipeCardRef.value?.triggerSwipe) {
    swipeCardRef.value.triggerSwipe(direction)
  }

  setTimeout(() => processAnswer(guessedLars), 280)
}

function handleSwipeAnswer(guessedLars: boolean) {
  if (answerFromButton.value) {
    answerFromButton.value = false
    return
  }
  if (isProcessing.value) return
  isProcessing.value = true
  processAnswer(guessedLars)
}

function processAnswer(guessedLars: boolean) {
  stopDrinking()  // stop drinking when answering
  const img = currentImage.value
  if (!img) return

  const isCorrect = img.isLars === guessedLars
  const basePoints = isCorrect ? 100 : -50
  const points = Math.round(basePoints * multiplier.value)
  const mult = multiplier.value

  feedbackCorrect.value = isCorrect
  feedbackPoints.value = points
  jimQuote.value = isCorrect ? getCorrectQuote() : getWrongQuote()

  if (isCorrect) {
    score.value += points
    streak.value++
    correct.value++
    unlockCard(img.id)
    recordCorrectAnswer(streak.value)
  } else {
    score.value = Math.max(0, score.value + points)
    streak.value = 0
    if (!img.isLars) recordFooled()
    resetStreakTimer()
  }

  totalSwiped.value++
  showFeedback.value = true
  showJim.value = true

  if (isCorrect && promille.value >= 2) {
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#F5A623', '#E84393', '#00D68F'],
    })
  }

  // Check achievements
  checkAll({
    totalCorrect: correct.value,
    streak: streak.value,
    bestStreak: streak.value,
    totalRounds: 0,
    collectionCount: unlockedCount.value,
    collectionTotal: totalCount.value,
    mythicalCount: mythicalUnlocked.value,
  })

  setTimeout(() => {
    showFeedback.value = false
    setTimeout(() => {
      showJim.value = false
      advance()
      // Minigame teaser — trigger after advance so UI is calm
      const teaser = shouldShowTeaser(totalSwiped.value)
      if (teaser) teaserPromo.value = teaser
    }, 1000)
  }, 700)
}

function advance() {
  queueIndex.value++
  if (queueIndex.value >= queue.value.length) {
    queue.value = shuffle(imageData.images as GameImage[])
    queueIndex.value = 0
  }
  // Pick a new blur-mode for the next card
  pickRandomBlurMode()
  // Blink at promille >= 0.8 (eyelids getting heavy)
  if (promille.value >= 0.8) {
    triggerBlink()
  }
  isProcessing.value = false
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-[#1A0F2E] to-[#0F1923]">
    <!-- Drunk vignette overlay -->
    <div
      class="absolute inset-0 pointer-events-none transition-opacity duration-500 z-0"
      :style="{ opacity: promille * 0.25 }"
      style="background: radial-gradient(circle, transparent 40%, #E84393 120%)"
    />

    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-3 pb-1 safe-top relative z-10">
      <button
        class="w-9 h-9 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
        @click="goHome"
      >
        <Icon name="mdi:home" size="18" />
      </button>

      <!-- Mode badge -->
      <div class="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-pink-accent/30">
        <Icon name="mdi:glass-mug-variant" size="14" class="text-pink-accent" />
        <span class="text-pink-accent font-heading font-bold text-[10px] uppercase tracking-widest">
          Fuld med Lars
        </span>
      </div>

      <div class="flex items-center gap-1.5 glass rounded-xl px-3 py-1.5">
        <Icon name="mdi:lightning-bolt" size="14" class="text-accent" />
        <span class="font-mono font-bold text-sm text-white tabular-nums">{{ score }}</span>
      </div>
    </div>

    <!-- Swiped counter -->
    <div class="text-center py-1 relative z-10">
      <span class="text-muted text-xs font-mono">{{ totalSwiped }} swiped · streak {{ streak }}</span>
    </div>

    <!-- Breathalyzer meter -->
    <div class="px-4 pt-1 pb-2 relative z-10">
      <BreathalyzerMeter
        :promille="promille"
        :holding="holding"
        :multiplier="multiplier"
      />
    </div>

    <!-- Card area -->
    <div
      class="flex-1 flex items-center justify-center px-6 relative z-10"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <!-- Drunk wobble wrapper -->
      <div
        :style="distortionStyle"
        :class="['drunk-wrap', `drunk-mode-${blurMode}`]"
      >
        <SwipeCard
          v-if="currentImage"
          ref="swipeCardRef"
          :key="queueIndex"
          :image="currentImage"
          :is-active="!isProcessing"
          @swipe-left="handleSwipeAnswer(false)"
          @swipe-right="handleSwipeAnswer(true)"
        />
      </div>
    </div>

    <!-- Jim toast -->
    <div class="px-4 py-1 min-h-[50px] flex items-center justify-center relative z-10">
      <Transition name="jim-bubble">
        <div
          v-if="showJim"
          :key="jimQuote"
          class="flex items-center gap-2.5 max-w-sm w-full rounded-2xl px-3 py-2.5 relative"
          :class="feedbackCorrect
            ? 'bg-success/15 border border-success/30'
            : 'bg-error/15 border border-error/30'"
        >
          <span class="text-xl flex-shrink-0">{{ feedbackCorrect ? '🍺' : '😵' }}</span>
          <p class="text-white text-sm font-body leading-snug font-medium">{{ jimQuote }}</p>
        </div>
      </Transition>
    </div>

    <!-- Buttons -->
    <div class="pb-5 pt-1 px-6 safe-bottom relative z-10">
      <ActionButtons
        @not-lars="handleButtonAnswer(false)"
        @is-lars="handleButtonAnswer(true)"
      />
    </div>

    <!-- Points feedback -->
    <FeedbackOverlay
      :show="showFeedback"
      :correct="feedbackCorrect"
      :points="feedbackPoints"
      :message="''"
      :speed-bonus="false"
    />

    <!-- Instructions on first load -->
    <Transition name="fade">
      <div
        v-if="totalSwiped === 0 && !holding && promille === 0"
        class="absolute bottom-40 inset-x-6 text-center z-10 pointer-events-none"
      >
        <div class="glass rounded-xl p-3 border border-accent/20 inline-block">
          <p class="text-accent text-xs font-heading font-bold mb-1">🍺 HOLD kortet nede for at drikke</p>
          <p class="text-muted text-[10px] font-mono">Jo mere fuld, jo højere multiplier — men sværere at se</p>
        </div>
      </div>
    </Transition>

    <!-- Jim pranks + toasts -->
    <AchievementToast />

    <!-- Blink overlay — eyelids closing when drunk -->
    <div
      v-if="showBlink"
      class="fixed inset-0 z-[60] pointer-events-none blink-container"
    >
      <div class="blink-lid blink-lid-top" />
      <div class="blink-lid blink-lid-bottom" />
    </div>

    <!-- Minigame teaser -->
    <MinigameTeaser
      :promo="teaserPromo"
      @dismiss="dismissTeaser"
      @play="playTeaser"
    />
  </div>
</template>

<style scoped>
.safe-top {
  padding-top: max(0.75rem, env(safe-area-inset-top));
}
.safe-bottom {
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
}
.jim-bubble-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jim-bubble-leave-active { transition: all 0.2s ease-in; }
.jim-bubble-enter-from { opacity: 0; transform: scale(0.7) translateY(15px); }
.jim-bubble-leave-to { opacity: 0; }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* Drunk wrapper — per-frame filter updates, no CSS transitions */
.drunk-wrap {
  will-change: filter, transform;
  /* No transitions — the per-frame updates drive the animation */
}
/* GPU-accelerated — keeps it smooth */
.drunk-wrap > * {
  backface-visibility: hidden;
}

/* Blink eyelid overlay — simulates blinking when drunk */
.blink-container {
  /* Two black bars closing from top and bottom */
}

.blink-lid {
  position: absolute;
  left: 0;
  right: 0;
  background: linear-gradient(to var(--to, bottom),
    #000 0%,
    #000 60%,
    rgba(20, 10, 15, 0.9) 85%,
    rgba(20, 10, 15, 0) 100%);
}

.blink-lid-top {
  top: 0;
  height: 50vh;
  --to: bottom;
  transform: translateY(-100%);
  animation: eyelid-top 0.45s cubic-bezier(0.42, 0, 0.32, 1) forwards;
}

.blink-lid-bottom {
  bottom: 0;
  height: 50vh;
  --to: top;
  transform: translateY(100%);
  animation: eyelid-bottom 0.45s cubic-bezier(0.42, 0, 0.32, 1) forwards;
}

@keyframes eyelid-top {
  0%   { transform: translateY(-100%); }
  38%  { transform: translateY(-8%); }     /* eyes mostly closed */
  50%  { transform: translateY(2%); }      /* fully shut — slight overlap */
  62%  { transform: translateY(-8%); }     /* starting to open */
  100% { transform: translateY(-100%); }   /* back open */
}

@keyframes eyelid-bottom {
  0%   { transform: translateY(100%); }
  38%  { transform: translateY(8%); }
  50%  { transform: translateY(-2%); }
  62%  { transform: translateY(8%); }
  100% { transform: translateY(100%); }
}
</style>
