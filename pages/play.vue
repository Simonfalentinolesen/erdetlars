<script setup lang="ts">
import confetti from 'canvas-confetti'
import type { PowerUpType } from '~/composables/useAchievements'

const router = useRouter()
const {
  state,
  answer,
  stopGame,
  getCurrentImage,
  getRandomFact,
  getStreakMessage,
  getMultiplier,
  getDifficultyConfig,
} = useGame()
const difficulty = computed(() => getDifficultyConfig())
const { playCorrect, playWrong, playStreak, playTension, enabled: soundEnabled, toggle: toggleSound } = useSound()

// Trigger tension lyd når Kvit-eller-dobbelt kortet er synligt (én gang)
const donTensionFired = ref(false)
const { getCorrectQuote, getWrongQuote } = useJim()
const { unlock: unlockCard, unlockedCount, totalCount, mythicalUnlocked } = useCollection()
const { checkAll, recordCorrectAnswer, resetStreakTimer, recordFooled, recordFactRead, recordPrankSurvived, recordPowerUpUsed } = useAchievements()
const { inventory, hintActive, recentlyEarned, awardRandom, use: usePowerUp, consumeShield, consumeDouble, startSession } = usePowerUps()
const { activePrank, prankQuote, maybeTrigger: maybeJimPrank, enabled: pranksEnabled, dismiss: dismissPrank, endCardPranks } = useJimPranks()
const { getAll: getAllMinigames, markTeaserClicked } = useMinigamePromo()

// Redirect if no game started
if (state.value.screen !== 'playing') {
  router.replace('/')
}

// Init power-up session
if (import.meta.client) startSession()

const currentImage = computed(() => getCurrentImage())
const isProcessing = ref(false)

// Feedback state
const showFeedback = ref(false)
const feedbackCorrect = ref(false)
const feedbackPoints = ref(0)
const feedbackMessage = ref('')
const feedbackSpeedBonus = ref(false)

// Unlocked card toast
const unlockedCardToast = ref<{ rarity: string; id: number } | null>(null)

// Lars Fact state — vises nu som Jim-toast (se showJimToast/jimToastQuote nedenfor),
// ikke længere som blokerende fullscreen popup.
const factText = ref('')

// Jim state
const showJimToast = ref(false)
const jimToastQuote = ref('')

// Card ref
const swipeCardRef = ref<any>(null)

// Track answers for Lars Fact timing
const localAnswerCount = ref(0)
const answerFromButton = ref(false)

// ==================== DIFFICULTY TIMER ====================
// Viking+ har timer pr. swipe. Når den rammer 0 → auto-wrong svar (behandles som "ikke Lars"
// men answer() ignorerer valget pga. timedOut-flag og giver fuld straf).
// Pause timer under: processing, fullscreen-overlays (fact/breaker/rant), kvit-eller-dobbelt (for lang at læse).
const timerRemainingMs = ref(0)
const timerProgress = computed(() => {
  const total = difficulty.value.timerPerSwipeMs
  if (!total) return 0
  return Math.max(0, Math.min(100, (timerRemainingMs.value / total) * 100))
})
const timerCritical = computed(() => {
  const total = difficulty.value.timerPerSwipeMs
  if (!total) return false
  return timerRemainingMs.value / total < 0.3
})

let timerInterval: ReturnType<typeof setInterval> | null = null
let timerStartTime = 0
let timerAutoFired = false

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function startTimer() {
  stopTimer()
  const total = difficulty.value.timerPerSwipeMs
  if (!total) return
  timerRemainingMs.value = total
  timerStartTime = Date.now()
  timerAutoFired = false
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - timerStartTime
    timerRemainingMs.value = Math.max(0, total - elapsed)
    if (timerRemainingMs.value <= 0 && !timerAutoFired) {
      timerAutoFired = true
      stopTimer()
      // Fire auto-wrong med swipe-animation så kortet forlader skærmen.
      // Samme flow som handleButtonAnswer, bare med timedOut=true.
      if (!isProcessing.value) {
        isProcessing.value = true
        answerFromButton.value = true
        if (swipeCardRef.value?.triggerSwipe) {
          swipeCardRef.value.triggerSwipe('left')
        }
        setTimeout(() => processAnswer(false, true), 280)
      }
    }
  }, 50)
}

// ==================== MINIGAME BREAKER ====================
// Full-screen takeover that showcases ALL 3 minigames at specific swipe milestones.
// Fires ONLY at swipe 4 and swipe 20 (user's explicit spec) — no other teasers,
// no per-game rotation. One big break covering everything.
const BREAKER_TRIGGERS: ReadonlyArray<number> = [4, 20]
const breakerPromos = ref<ReturnType<typeof getAllMinigames> | null>(null)
const breakerLabel = ref('')

// ==================== KVIT ELLER DOBBELT ====================
// Every 12th swipe: OFFER a DoN bet. Spilleren vælger nu aktivt om de tør satse.
// - `donPending`: runden er DoN-slot, men spilleren har ikke valgt endnu → vis choice modal
// - `donAccepted`: null = ikke spurgt, true = satset, false = afvist (normal runde)
// - `isDoubleOrNothing`: aktiv kun når spilleren har SATSET
const donAccepted = ref<boolean | null>(null)

const isDonSlot = computed(() => {
  return (localAnswerCount.value + 1) % 12 === 0 && localAnswerCount.value + 1 > 0
})

// Spilleren skal vælge før DoN-kortet vises
const donPending = computed(() => isDonSlot.value && donAccepted.value === null)

// Final DoN-flag — kun true når accepteret
const isDoubleOrNothing = computed(() => isDonSlot.value && donAccepted.value === true)

// Nulstil valget når vi forlader DoN-sloten
watch(isDonSlot, (slot) => {
  if (!slot) donAccepted.value = null
})

function acceptDoN() {
  donAccepted.value = true
  if (!donTensionFired.value) {
    donTensionFired.value = true
    playTension()
  }
}

function declineDoN() {
  donAccepted.value = false
}

// Fyr tension-lyd når DoN-kortet vises (men kun én gang pr. DoN-runde)
watch(isDoubleOrNothing, (isDoN) => {
  if (!isDoN) {
    donTensionFired.value = false
  }
})

// ==================== EVOLVING DESIGN ====================
// Streak-based intensity tier (0-5). Drives background, border, confetti scale.
const streakTier = computed(() => {
  const s = state.value.streak
  if (s >= 30) return 5
  if (s >= 20) return 4
  if (s >= 10) return 3
  if (s >= 5) return 2
  if (s >= 3) return 1
  return 0
})

// ==================== FULLSCREEN OVERLAY COORDINATOR ====================
// Blokerer swipes + skjuler toasts mens DoN-valget venter på svar.
// - Jim-facts er toasts i bunden (auto-dismiss 5s)
// - Reklamer er side-panels på desktop (auto-dismiss 7s)
// - Jim-rant er top-toast (auto-dismiss via prank.duration)
// - DoN-choice modal ER blokerende (valget kræver aktiv handling)
const hasFullscreenOverlay = computed(() => donPending.value)

// ==================== PROGRESSIVE CONFETTI ====================
// Ramps from a tiny pop at streak 3 → full rainbow firework show at streak 30+.
function fireConfetti(correct: boolean, isDoNWin = false) {
  if (!correct) return

  const s = state.value.streak
  const baseColors = ['#F5A623', '#00D68F', '#E84393', '#FFFFFF']
  const rainbow = ['#FF0080', '#FF8C00', '#FFD700', '#00E5FF', '#8A2BE2', '#00FF7F', '#FF1493']

  // DoN win always gets a celebration, regardless of streak
  if (isDoNWin) {
    confetti({ particleCount: 150, spread: 140, origin: { y: 0.5 }, colors: rainbow, startVelocity: 70 })
    setTimeout(() => {
      confetti({ particleCount: 100, spread: 160, startVelocity: 80, shapes: ['star'], colors: ['#FFD700', '#FF1493'], origin: { y: 0.4 } })
    }, 180)
    playStreak()
    return
  }

  if (s < 3) return

  if (s < 5) {
    // Tier 1: tiny pop
    confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 }, colors: baseColors })
  } else if (s < 10) {
    // Tier 2: bigger pop + golden stars
    confetti({ particleCount: 70, spread: 75, origin: { y: 0.6 }, colors: baseColors })
    confetti({ particleCount: 25, spread: 100, startVelocity: 55, shapes: ['star'], colors: ['#FFD700', '#FFA500'], origin: { y: 0.6 } })
    playStreak()
  } else if (s < 20) {
    // Tier 3: rainbow blast + delayed star burst
    confetti({ particleCount: 110, spread: 100, origin: { y: 0.6 }, colors: rainbow })
    setTimeout(() => confetti({ particleCount: 60, spread: 140, startVelocity: 65, shapes: ['star'], colors: ['#FFD700', '#FF1493'], origin: { y: 0.4 } }), 180)
    playStreak()
  } else if (s < 30) {
    // Tier 4: side cannons + center star fountain
    confetti({ particleCount: 130, angle: 60, spread: 75, origin: { x: 0, y: 0.7 }, colors: rainbow, startVelocity: 70 })
    confetti({ particleCount: 130, angle: 120, spread: 75, origin: { x: 1, y: 0.7 }, colors: rainbow, startVelocity: 70 })
    setTimeout(() => confetti({ particleCount: 100, spread: 160, startVelocity: 75, shapes: ['star'], colors: ['#FFD700', '#FF1493', '#00E5FF'], origin: { y: 0.3 } }), 220)
    playStreak()
  } else {
    // Tier 5: FULL CHAOS — 2s rolling side cannons + massive star fountain
    const end = Date.now() + 2000
    const frame = () => {
      confetti({ particleCount: 10, angle: 60, spread: 60, origin: { x: 0 }, colors: rainbow, startVelocity: 75 })
      confetti({ particleCount: 10, angle: 120, spread: 60, origin: { x: 1 }, colors: rainbow, startVelocity: 75 })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
    setTimeout(() => {
      confetti({ particleCount: 250, spread: 170, startVelocity: 85, shapes: ['star'], colors: ['#FFD700', '#FF1493', '#00E5FF', '#FF8C00'], origin: { y: 0.2 } })
    }, 400)
    playStreak()
  }
}

function dismissBreaker() {
  breakerPromos.value = null
}
function playFromBreaker(path: string) {
  markTeaserClicked()
  breakerPromos.value = null
  // Stop current game so it doesn't linger in the background
  stopGame()
  router.push(path)
}

// Prank-induced button swap
const buttonsSwapped = computed(() => activePrank.value?.type === 'button-swap')
// Blur prank — kort duration (1.5s) + banner så det er tydeligt det er Jim der driller
const cardBlurred = computed(() => activePrank.value?.type === 'blur')
const upsideDown = computed(() => activePrank.value?.type === 'upside-down')

// Shield/double indicators (visual state)
const shieldActive = computed(() => {
  return (window as any).__erdetlars_shield_active ?? false
})

function onKeyDown(e: KeyboardEvent) {
  // DoN choice modal er åben — Enter accepterer, Escape afviser
  if (donPending.value) {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); acceptDoN(); return }
    if (e.code === 'Escape') { e.preventDefault(); declineDoN(); return }
    // Bloker alle andre taster så man ikke ved en fejl swiper
    e.preventDefault()
    return
  }
  // Dismiss Jim-rant prank — ANY key closes it (user was stuck før)
  if (activePrank.value?.type === 'jim-rant') {
    e.preventDefault()
    dismissPrank()
    return
  }
  if (isProcessing.value) return

  // Power-up shortcuts
  if (e.code === 'KeyQ') { e.preventDefault(); handleUsePowerUp('hint'); return }
  if (e.code === 'KeyW') { e.preventDefault(); handleUsePowerUp('shield'); return }
  if (e.code === 'KeyE') { e.preventDefault(); handleUsePowerUp('double'); return }
  if (e.code === 'KeyR') { e.preventDefault(); handleUsePowerUp('skip'); return }

  if (e.code === 'ArrowLeft') {
    e.preventDefault()
    handleButtonAnswer(false)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    handleButtonAnswer(true)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  // Start timer for første kort
  if (canRunTimer.value) startTimer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopTimer()
})

function handleButtonAnswer(guessedLars: boolean) {
  if (isProcessing.value || !currentImage.value) return
  isProcessing.value = true
  answerFromButton.value = true

  // If buttons swapped, invert
  const actualAnswer = buttonsSwapped.value ? !guessedLars : guessedLars

  const direction = actualAnswer ? 'right' : 'left'
  if (swipeCardRef.value?.triggerSwipe) {
    swipeCardRef.value.triggerSwipe(direction)
  }

  setTimeout(() => {
    processAnswer(actualAnswer)
  }, 280)
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

function handleUsePowerUp(type: PowerUpType) {
  if (isProcessing.value) return
  if (inventory.value[type] <= 0) return

  // Skip = just advance
  if (type === 'skip') {
    if (usePowerUp('skip')) {
      recordPowerUpUsed('skip')
      // Simulate a neutral advance: no point gain/loss, streak preserved
      state.value.queueIndex++
      if (state.value.queueIndex >= state.value.queue.length) {
        state.value.queue = [...state.value.queue].sort(() => Math.random() - 0.5)
        state.value.queueIndex = 0
      }
      jimToastQuote.value = 'Sprang den over, Lars. Heldige dig.'
      showJimToast.value = true
      feedbackCorrect.value = false
      setTimeout(() => { showJimToast.value = false }, 1200)
    }
    return
  }

  if (usePowerUp(type)) {
    recordPowerUpUsed(type)
    // Feedback messages
    const msgs: Record<PowerUpType, string> = {
      hint: 'Jim kigger nærmere...',
      shield: 'Shield aktiveret — næste fejl tilgives.',
      double: 'Double Down — næste kort giver 2x point!',
      skip: '',
    }
    jimToastQuote.value = msgs[type]
    feedbackCorrect.value = true
    showJimToast.value = true
    setTimeout(() => { showJimToast.value = false }, 1800)
  }
}

async function processAnswer(guessedLars: boolean, timedOut = false) {
  stopTimer()  // Stop sværhedsgrad-timer så den ikke triggrer under fx feedback
  const image = getCurrentImage()
  if (!image) return

  // Capture Kvit-eller-dobbelt state BEFORE answer() increments the counter
  const wasDoN = isDoubleOrNothing.value

  const result = answer(guessedLars, { timedOut })
  const wasCorrect = result.correct

  // Apply power-up effects
  let finalPoints = result.points
  const doubleMult = consumeDouble()
  if (doubleMult > 1 && wasCorrect) {
    finalPoints = Math.round(finalPoints * doubleMult)
    // Retroactively add the extra points (original answer already counted base)
    state.value.score = Math.max(0, state.value.score + (finalPoints - result.points))
  }

  // Determine what Jim says this round — priority: DoN > timedOut > shield > streak milestone > regular quote
  let jimSays = wasCorrect ? getCorrectQuote() : getWrongQuote()
  if (timedOut) {
    jimSays = '⏱️ For sent, Lars! Timeren løb ud.'
  }

  // Kvit eller dobbelt: doubles winnings, crushes losses
  if (wasDoN) {
    if (wasCorrect) {
      // Original answer() already added base. Add another equal chunk to make it 2x total.
      const extra = finalPoints
      finalPoints = finalPoints * 2
      state.value.score = Math.max(0, state.value.score + extra)
      jimSays = '🔥 KVIT ELLER DOBBELT — DU VANDT! 2X POINT!'
    } else {
      // Extra penalty: remove another 100 on top of the -50 already applied
      state.value.score = Math.max(0, state.value.score - 100)
      finalPoints = -150
      jimSays = '💀 KVIT ELLER DOBBELT — DU TABTE! -150'
    }
  }

  // Shield: if wrong (and not DoN loss, which is too brutal to shield), restore streak + override quote
  if (!wasCorrect && !wasDoN) {
    const shielded = consumeShield()
    if (shielded) {
      // The answer() call already reset streak to 0. Revert:
      state.value.streak = state.value.bestStreak > 0 ? Math.max(state.value.bestStreak, 1) : 1
      jimSays = 'Shield reddede dig! Streak bevaret.'
    }
  }

  // Unlock collection card on correct
  if (wasCorrect) {
    const newlyUnlocked = unlockCard(image.id)
    if (newlyUnlocked) {
      const rarity = image.type === 'video' ? 'MYTISK' : image.isLars ? 'ALMINDELIG' : 'SJÆLDEN'
      unlockedCardToast.value = { rarity, id: image.id }
      setTimeout(() => { unlockedCardToast.value = null }, 2200)
    }
    recordCorrectAnswer(state.value.streak)
  } else {
    if (!image.isLars) recordFooled()
    resetStreakTimer()
  }

  // Streak milestone message overrides regular quote on correct
  const streakMsg = getStreakMessage()
  if (wasCorrect && streakMsg) {
    jimSays = streakMsg
  }

  feedbackCorrect.value = wasCorrect
  feedbackPoints.value = finalPoints
  feedbackSpeedBonus.value = result.speedBonus
  feedbackMessage.value = jimSays
  showFeedback.value = true

  // Toggle toast off → on so the Transition fires on identical consecutive quotes too
  showJimToast.value = false
  await nextTick()
  jimToastQuote.value = jimSays
  showJimToast.value = true

  // Sound + progressive confetti
  if (wasCorrect) {
    playCorrect()
    fireConfetti(true, wasDoN)

    // Award power-up every 5 in a row
    if (state.value.streak > 0 && state.value.streak % 5 === 0) {
      awardRandom()
    }
  } else {
    playWrong()
  }

  localAnswerCount.value++

  // Check achievements
  checkAll({
    totalCorrect: state.value.totalCorrect,
    streak: state.value.streak,
    bestStreak: state.value.bestStreak,
    totalRounds: state.value.totalRounds,
    collectionCount: unlockedCount.value,
    collectionTotal: totalCount.value,
    mythicalCount: mythicalUnlocked.value,
  })

  await new Promise(r => setTimeout(r, 650))
  showFeedback.value = false

  // Lars Fact every 5 answers — nu som Jim-toast under kortet, ingen popup
  // der blokerer spillet. Fader ind, bliver i 5s, fader ud.
  if (localAnswerCount.value % 5 === 0) {
    factText.value = getRandomFact()
    showJimToast.value = true
    jimToastQuote.value = factText.value
    recordFactRead()
    // Auto-hide efter 5 sekunder — spiller beh\u00f8ver ikke at trykke.
    setTimeout(() => {
      showJimToast.value = false
    }, 5000)
    // Fortsaet spillet uden at pause
  }

  // Maybe trigger Jim prank
  const prank = maybeJimPrank(localAnswerCount.value, 0.08)
  if (prank) {
    // When prank expires, record survival
    setTimeout(() => {
      recordPrankSurvived()
      checkAll({
        totalCorrect: state.value.totalCorrect,
        streak: state.value.streak,
        bestStreak: state.value.bestStreak,
        totalRounds: state.value.totalRounds,
        collectionCount: unlockedCount.value,
        collectionTotal: totalCount.value,
        mythicalCount: mythicalUnlocked.value,
      })
    }, prank.duration + 100)
  }

  // Minigame BREAKER — only at swipe 4 and 20. Skip if prank/fact is on screen.
  if (!prank && BREAKER_TRIGGERS.includes(localAnswerCount.value)) {
    breakerPromos.value = getAllMinigames()
    breakerLabel.value = `EFTER ${localAnswerCount.value} SWIPES`
  }

  readyForNext()
}

function readyForNext() {
  isProcessing.value = false
  // Ryd visuelle pranks (upside-down, blur) så næste kort vises normalt.
  // Forhindrer at pranken spænder over flere kort hvis spilleren swiper hurtigt.
  endCardPranks()
  // Start ny timer for næste kort (hvis sværhedsgrad kræver det + ingen overlays blokerer)
  if (canRunTimer.value) startTimer()
}

// Timer må kun køre når brugeren faktisk KAN svare.
// Blokerende tilstande: processing, kvit-eller-dobbelt (ekstra tænketid),
// DoN-choice modal (spilleren skal vælge).
const canRunTimer = computed(() =>
  !isProcessing.value
  && !isDoubleOrNothing.value
  && !donPending.value
  && !!difficulty.value.timerPerSwipeMs
)

// Pause/resume timeren automatisk når overlay-tilstand skifter.
watch(canRunTimer, (can) => {
  if (can) startTimer()
  else stopTimer()
})

function handleStopGame() {
  stopGame()
  router.push('/result')
}

// Card ref forwarding for buttons (they show swapped labels)
const leftLabel = computed(() => buttonsSwapped.value ? 'Det er Lars!' : 'Ikke Lars')
const rightLabel = computed(() => buttonsSwapped.value ? 'Ikke Lars' : 'Det er Lars!')
</script>

<template>
  <div
    v-if="state.screen === 'playing'"
    class="h-screen flex flex-col relative overflow-hidden"
    :class="`streak-tier-${streakTier}`"
  >
    <!-- Evolving background FX (intensifies with streak) -->
    <div class="streak-bg-fx pointer-events-none" aria-hidden="true" />

    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 pt-3 pb-1 safe-top">
      <div class="flex items-center gap-2">
        <NuxtLink
          to="/"
          class="w-9 h-9 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
        >
          <Icon name="mdi:home" size="18" />
        </NuxtLink>
        <button
          class="w-9 h-9 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
          :aria-label="soundEnabled ? 'Slå lyd fra' : 'Slå lyd til'"
          @click="toggleSound"
        >
          <Icon :name="soundEnabled ? 'mdi:volume-high' : 'mdi:volume-off'" size="18" />
        </button>
        <button
          class="px-3 py-2 rounded-xl glass text-xs font-heading font-semibold text-accent hover:bg-accent/10 transition-colors btn-press"
          @click="handleStopGame"
        >
          SE MIN SCORE
        </button>
      </div>

      <ScoreDisplay
        :score="state.score"
        :streak="state.streak"
        :multiplier="getMultiplier()"
      />
    </div>

    <!-- Swiped counter + difficulty badge + collection progress -->
    <div class="text-center py-1 flex items-center justify-center gap-3">
      <span class="text-muted text-xs font-mono">{{ state.totalSwiped }} swiped</span>
      <!-- Difficulty badge: viser hvilken sværhedsgrad der er valgt -->
      <span
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-heading font-bold tracking-widest uppercase"
        :style="{ color: difficulty.color, backgroundColor: `${difficulty.color}20`, borderColor: `${difficulty.color}60`, borderWidth: '1px', borderStyle: 'solid' }"
      >
        <Icon :name="difficulty.icon" size="10" />
        {{ difficulty.label }}
      </span>
      <NuxtLink to="/samling" class="text-muted text-xs font-mono hover:text-accent transition-colors flex items-center gap-1">
        <Icon name="mdi:cards" size="12" />
        {{ unlockedCount }}/{{ totalCount }}
      </NuxtLink>
    </div>

    <!-- Timer-bar: kun synlig på Viking+. Rød-gradient når under 30%. -->
    <div
      v-if="difficulty.timerPerSwipeMs"
      class="mx-6 h-1 rounded-full bg-white/10 overflow-hidden mb-1"
      role="progressbar"
      :aria-valuenow="Math.round(timerProgress)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Tid tilbage"
    >
      <div
        class="h-full transition-[width] duration-75 ease-linear"
        :class="[timerCritical ? 'timer-critical' : '']"
        :style="{
          width: `${timerProgress}%`,
          backgroundColor: timerCritical ? '#E84393' : difficulty.color,
        }"
      />
    </div>

    <!-- Card area -->
    <div
      class="flex-1 flex items-center justify-center px-6 relative"
      :class="{ 'upside-down-wrapper': upsideDown }"
    >
      <!-- Background card for depth -->
      <div
        class="absolute w-full max-w-[320px] aspect-[4/5] rounded-3xl bg-surface/50 border border-white/5 scale-[0.92] translate-y-3 opacity-50"
      />

      <!-- Hint zoom wrapper -->
      <div
        class="relative transition-transform duration-300"
        :class="{
          'hint-zoom': hintActive,
          'card-blur-prank': cardBlurred,
          'don-zoom': isDoubleOrNothing,
        }"
      >
        <!-- Active card -->
        <SwipeCard
          v-if="currentImage"
          ref="swipeCardRef"
          :key="state.queueIndex"
          :image="currentImage"
          :is-active="!isProcessing"
          @swipe-left="handleSwipeAnswer(false)"
          @swipe-right="handleSwipeAnswer(true)"
        />
      </div>

      <!-- KVIT ELLER DOBBELT banner -->
      <Transition name="don-intro">
        <div
          v-if="isDoubleOrNothing"
          class="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5"
        >
          <div class="don-banner">
            <Icon name="mdi:star-four-points" size="12" />
            KVIT ELLER DOBBELT
            <Icon name="mdi:star-four-points" size="12" />
          </div>
          <p class="don-subtitle">Er det Lars? 2× points · forkert = -150</p>
        </div>
      </Transition>

      <!-- Hint indicator badge -->
      <div
        v-if="hintActive"
        class="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass rounded-full px-3 py-1.5 border border-[#6AACDB]/50 pointer-events-none"
      >
        <div class="flex items-center gap-1.5">
          <Icon name="mdi:magnify-plus" size="12" class="text-[#6AACDB]" />
          <span class="text-[#6AACDB] text-[10px] font-heading font-bold tracking-widest">JIM KIGGER</span>
        </div>
      </div>

      <!-- Collection unlock toast (bottom-right of card) -->
      <Transition name="unlock-toast">
        <div
          v-if="unlockedCardToast && !hasFullscreenOverlay"
          class="absolute top-4 right-4 glass rounded-xl px-3 py-2 flex items-center gap-2 border border-accent/40 shadow-glow pointer-events-none z-20"
        >
          <Icon name="mdi:star-plus" size="14" class="text-accent" />
          <div class="flex flex-col leading-none">
            <p class="text-accent text-[9px] font-heading font-bold tracking-widest">
              KORT LÅST OP
            </p>
            <p class="text-white text-[10px] font-mono">
              {{ unlockedCardToast.rarity }} #{{ String(unlockedCardToast.id).padStart(3, '0') }}
            </p>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Jim's speech bubble er flyttet ud i JimQuote-komponenten nedenfor.
         Vi beholder en lille spacer så layoutet ikke springer, men selve
         beskeden vises kun ét sted (JimQuote i toast-mode). -->
    <div class="px-4 py-1 min-h-[50px] flex items-center justify-center relative" />

    <!-- Power-up bar — skjules på Legendarisk (powerUpsEnabled: false) -->
    <div v-if="difficulty.powerUpsEnabled" class="pt-1 pb-2">
      <PowerUpBar :disabled="isProcessing" @use="handleUsePowerUp" />
    </div>
    <div v-else class="pt-1 pb-2 text-center">
      <p class="text-muted/60 text-[10px] font-heading font-bold tracking-widest uppercase flex items-center justify-center gap-1.5">
        <Icon name="mdi:shield-off" size="12" :style="{ color: difficulty.color }" />
        Ingen power-ups · {{ difficulty.label.toLocaleLowerCase() }}
      </p>
    </div>

    <!-- Action buttons (with swap indicator) -->
    <div class="pb-5 pt-1 px-6 safe-bottom relative">
      <div
        v-if="buttonsSwapped"
        class="absolute -top-2 inset-x-0 text-center z-10 pointer-events-none"
      >
        <span class="inline-block px-2 py-0.5 rounded-full bg-error/20 border border-error/40 text-error text-[9px] font-heading font-bold tracking-widest prank-flash">
          KNAPPER BYTTET!
        </span>
      </div>
      <ActionButtons
        @not-lars="handleButtonAnswer(false)"
        @is-lars="handleButtonAnswer(true)"
      />
    </div>

    <!-- Points float overlay -->
    <FeedbackOverlay
      :show="showFeedback"
      :correct="feedbackCorrect"
      :points="feedbackPoints"
      :message="''"
      :speed-bonus="feedbackSpeedBonus"
    />

    <!-- JIM FAKTA — nu som ikke-blokerende Jim-toast i bunden -->
    <JimQuote
      :quote="jimToastQuote"
      :show="showJimToast && !hasFullscreenOverlay"
      mode="toast"
    />

    <!-- Jim Pranks overlay — rant er nu klik-dismissable -->
    <JimPrankOverlay :prank="activePrank" :quote="prankQuote" @dismiss="dismissPrank" />

    <!-- Power-up earned toast -->
    <PowerUpEarnedToast :type="recentlyEarned" />

    <!-- Achievement toasts -->
    <AchievementToast />

    <!-- HINT ZOOM-OVERLAY — når Jim kigger nærmere, vises kortet i fuld skærm
         med dramatisk zoom + dim backdrop. Auto-lukker når hintActive bliver false
         (styret af usePowerUps efter ~2s). Brugeren kan ikke swipe under zoom. -->
    <Transition name="hint-zoom-overlay">
      <div
        v-if="hintActive && currentImage"
        class="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md" />

        <!-- Zoomed card — fylder ~85% af viewport-højden -->
        <div class="relative z-10 hint-zoom-card">
          <!-- Ring af glow omkring -->
          <div class="absolute inset-0 rounded-3xl shadow-[0_0_120px_rgba(106,172,219,0.6)] pointer-events-none" />

          <div class="relative rounded-3xl overflow-hidden border-4 border-[#6AACDB]/70 bg-surface">
            <video
              v-if="currentImage.type === 'video'"
              :src="currentImage.file"
              class="block object-contain max-w-[85vw] max-h-[80vh]"
              muted
              loop
              autoplay
              playsinline
            />
            <img
              v-else
              :src="currentImage.file"
              :alt="currentImage.isLars ? 'Lars?' : 'Person'"
              class="block object-contain max-w-[85vw] max-h-[80vh]"
              draggable="false"
            >
          </div>

          <!-- Top label -->
          <div class="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 glass rounded-full px-4 py-2 border border-[#6AACDB]/60 shadow-glow">
            <Icon name="mdi:magnify-plus" size="18" class="text-[#6AACDB]" />
            <span class="text-[#6AACDB] text-sm font-heading font-black tracking-widest uppercase">
              Jim kigger nærmere
            </span>
          </div>

          <!-- Bottom hint -->
          <p class="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-xs font-body italic whitespace-nowrap">
            Kig grundigt — vinduet lukker selv
          </p>
        </div>
      </div>
    </Transition>

    <!-- Side-panel reklamer — KUN på desktop, auto-fader ind/ud.
         Erstatter den gamle fullscreen BREAKER. Brugeren bliver ikke
         længere afbrudt — reklamerne forsvinder selv efter 7 sekunder.
         På mobil springes de helt over. -->
    <DesktopSideAds
      :promos="breakerPromos"
      :trigger-label="breakerLabel"
      @dismiss="dismissBreaker"
      @play="playFromBreaker"
    />

    <!-- KVIT ELLER DOBBELT — valg-modal. Spilleren vælger aktivt om de tør satse.
         Fullscreen takeover med dramatisk pulse. Swipe og knapper er disabled
         mens modalen er åben (pointer-events-none på resten sker via overlay). -->
    <Transition name="don-choice">
      <div
        v-if="donPending"
        class="fixed inset-0 z-[90] flex items-center justify-center px-6"
        style="background: radial-gradient(ellipse at center, rgba(232, 67, 147, 0.35) 0%, rgba(10, 10, 20, 0.97) 55%, rgba(5, 5, 10, 0.99) 100%); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"
      >
        <!-- Baggrund-pulse rings -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="don-ring don-ring-1" />
          <div class="don-ring don-ring-2" />
          <div class="don-ring don-ring-3" />
        </div>

        <div class="relative z-10 max-w-sm w-full text-center don-modal-in">
          <!-- Header -->
          <div class="mb-4">
            <p class="text-xs font-mono uppercase tracking-[0.3em] text-pink-accent/80 mb-2">
              Specialrunde #{{ Math.floor((localAnswerCount + 1) / 12) }}
            </p>
            <h2 class="don-title">
              KVIT<br>ELLER<br>DOBBELT
            </h2>
          </div>

          <!-- Stakes -->
          <div class="glass rounded-2xl p-5 mb-6 border-2 border-pink-accent/40 shadow-[0_0_40px_rgba(232,67,147,0.4)]">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-[9px] font-heading font-black uppercase tracking-widest text-green-400 mb-1">Vinder du</p>
                <p class="text-white font-heading font-black text-2xl">2×</p>
                <p class="text-muted/70 text-[10px] font-body mt-0.5">point</p>
              </div>
              <div>
                <p class="text-[9px] font-heading font-black uppercase tracking-widest text-error mb-1">Taber du</p>
                <p class="text-white font-heading font-black text-2xl">−150</p>
                <p class="text-muted/70 text-[10px] font-body mt-0.5">point</p>
              </div>
            </div>
          </div>

          <p class="text-white/80 font-body text-sm mb-5 leading-snug">
            Tør du satse på næste kort, Lars?
          </p>

          <!-- Actions -->
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="don-accept-btn"
              @click="acceptDoN"
            >
              <Icon name="mdi:fire" size="20" />
              <span>JA, JEG SATSER!</span>
              <Icon name="mdi:fire" size="20" />
            </button>
            <button
              type="button"
              class="w-full py-3 rounded-xl glass text-muted hover:text-white font-heading font-bold text-xs uppercase tracking-widest border border-white/10 hover:border-white/30 transition-colors"
              @click="declineDoN"
            >
              Nej tak, almindelig runde
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <div v-else class="h-screen flex items-center justify-center">
    <p class="text-muted font-body">Indlæser...</p>
  </div>
</template>

<style scoped>
.safe-top {
  padding-top: max(0.75rem, env(safe-area-inset-top));
}
.safe-bottom {
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
}

/* Jim speech bubble */
.jim-bubble-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jim-bubble-leave-active { transition: all 0.2s ease-in; }
.jim-bubble-enter-from { opacity: 0; transform: scale(0.7) translateY(15px); }
.jim-bubble-leave-to { opacity: 0; transform: scale(0.9) translateY(-5px); }

.jim-avatar-bounce {
  animation: jim-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes jim-bounce {
  0% { transform: scale(0.3) rotate(-15deg); }
  50% { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* Jim fact overlay */
.jim-fact-enter-active { transition: all 0.35s ease-out; }
.jim-fact-leave-active { transition: all 0.25s ease-in; }
.jim-fact-enter-from { opacity: 0; }
.jim-fact-leave-to { opacity: 0; }
.jim-fact-enter-from > div { transform: scale(0.85) translateY(20px); }

/* Speech bubble tail */
.jim-speech-bubble::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 24px;
  width: 12px;
  height: 12px;
  background: inherit;
  border: inherit;
  border-bottom: none;
  border-right: none;
  transform: rotate(45deg);
}

/* Power-up effects.
   .hint-zoom er fjernet som scale-wrapper — Jim-kigger-pranken viser nu
   en fullscreen zoom-overlay i stedet (se .hint-zoom-card nedenfor). */
.hint-zoom {}

/* Hint fullscreen zoom — dramatic enter/leave */
.hint-zoom-overlay-enter-active {
  transition: opacity 0.25s ease-out;
}
.hint-zoom-overlay-leave-active {
  transition: opacity 0.35s ease-in;
}
.hint-zoom-overlay-enter-from,
.hint-zoom-overlay-leave-to {
  opacity: 0;
}

.hint-zoom-card {
  animation: hint-zoom-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hint-zoom-overlay-leave-to .hint-zoom-card {
  animation: hint-zoom-out 0.3s ease-in forwards;
}

@keyframes hint-zoom-in {
  0% {
    transform: scale(0.35);
    opacity: 0;
    filter: blur(8px);
  }
  60% {
    filter: blur(0);
  }
  100% {
    transform: scale(1);
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes hint-zoom-out {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.6);
    opacity: 0;
  }
}

/* Prank: upside down */
.upside-down-wrapper {
  transform: rotate(180deg);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Prank: blur — kort, tydelig, kun via active class så ingen state-leak */
.card-blur-prank {
  filter: blur(8px) saturate(0.7);
  transition: filter 0.3s ease;
}

.prank-flash {
  animation: prank-flash 0.5s ease-in-out infinite;
}

@keyframes prank-flash {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

/* Collection unlock toast */
.unlock-toast-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.unlock-toast-leave-active { transition: all 0.3s ease-in; }
.unlock-toast-enter-from { opacity: 0; transform: translateX(30px) scale(0.8); }
.unlock-toast-leave-to { opacity: 0; transform: translateX(20px); }

/* ==================== KVIT ELLER DOBBELT ==================== */
/* Extreme zoom into the center of the card's image/video */
.don-zoom :deep(img),
.don-zoom :deep(video) {
  transform: scale(5.5);
  transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  filter: contrast(1.15) saturate(1.3);
}
.don-zoom {
  animation: don-card-pulse 1.3s ease-in-out infinite;
  box-shadow:
    0 0 60px rgba(232, 67, 147, 0.55),
    0 0 120px rgba(232, 67, 147, 0.25);
  border-radius: 1.5rem;
  position: relative;
}
.don-zoom::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 2rem;
  background: linear-gradient(135deg, #E84393, #F5A623, #E84393);
  background-size: 300% 300%;
  z-index: -1;
  opacity: 0.9;
  animation: don-border-flow 2.5s linear infinite;
  filter: blur(2px);
}
@keyframes don-card-pulse {
  0%, 100% {
    filter: brightness(1);
    box-shadow: 0 0 50px rgba(232, 67, 147, 0.4), 0 0 110px rgba(232, 67, 147, 0.18);
  }
  50% {
    filter: brightness(1.15);
    box-shadow: 0 0 95px rgba(232, 67, 147, 0.75), 0 0 180px rgba(232, 67, 147, 0.35);
  }
}
@keyframes don-border-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

/* ==================== DON CHOICE MODAL ==================== */
.don-choice-enter-active { transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.don-choice-leave-active { transition: all 0.25s ease-in; }
.don-choice-enter-from,
.don-choice-leave-to { opacity: 0; }

.don-modal-in {
  animation: don-modal-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes don-modal-pop {
  0% { transform: scale(0.7); opacity: 0; }
  70% { transform: scale(1.03); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.don-title {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 3.5rem;
  line-height: 0.95;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #E84393 0%, #F5A623 50%, #E84393 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  text-shadow: 0 0 40px rgba(232, 67, 147, 0.5);
  animation: don-title-shift 3s ease-in-out infinite, don-title-pulse 1.2s ease-in-out infinite;
}
@keyframes don-title-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes don-title-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

/* Pulserende rings bag modalen */
.don-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(232, 67, 147, 0.4);
  animation: don-ring-pulse 2.4s ease-out infinite;
}
.don-ring-1 { width: 300px; height: 300px; }
.don-ring-2 { width: 300px; height: 300px; animation-delay: 0.8s; }
.don-ring-3 { width: 300px; height: 300px; animation-delay: 1.6s; }
@keyframes don-ring-pulse {
  0% { transform: scale(0.8); opacity: 0.8; border-color: rgba(232, 67, 147, 0.6); }
  100% { transform: scale(3); opacity: 0; border-color: rgba(232, 67, 147, 0); }
}

/* Accept-knap — vild og tillokkende */
.don-accept-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 16px 24px;
  border-radius: 16px;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.15em;
  color: #1A1A20;
  background: linear-gradient(135deg, #E84393 0%, #F5A623 50%, #E84393 100%);
  background-size: 200% 200%;
  box-shadow:
    0 8px 24px rgba(232, 67, 147, 0.5),
    0 0 40px rgba(232, 67, 147, 0.35);
  animation: don-accept-glow 1.5s ease-in-out infinite, don-title-shift 3s ease-in-out infinite;
  transition: transform 0.1s ease;
}
.don-accept-btn:hover {
  transform: scale(1.03);
}
.don-accept-btn:active {
  transform: scale(0.97);
}
@keyframes don-accept-glow {
  0%, 100% { box-shadow: 0 8px 24px rgba(232, 67, 147, 0.5), 0 0 40px rgba(232, 67, 147, 0.35); }
  50% { box-shadow: 0 8px 32px rgba(232, 67, 147, 0.75), 0 0 60px rgba(232, 67, 147, 0.55); }
}

.don-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(90deg, #E84393, #F5A623, #E84393, #F5A623);
  background-size: 300% 100%;
  color: #1A1A20;
  padding: 7px 18px;
  border-radius: 999px;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  animation: don-shimmer 1.4s linear infinite;
  box-shadow: 0 0 28px rgba(232, 67, 147, 0.65), 0 6px 18px rgba(0,0,0,0.4);
  white-space: nowrap;
}
.don-subtitle {
  color: rgba(255, 255, 255, 0.85);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  background: rgba(20, 20, 28, 0.8);
  padding: 3px 10px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(232, 67, 147, 0.3);
}

@keyframes don-shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

.don-intro-enter-active { transition: all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.don-intro-leave-active { transition: all 0.25s ease-in; }
.don-intro-enter-from { opacity: 0; transform: translate(-50%, -18px) scale(0.6); }
.don-intro-leave-to { opacity: 0; transform: translate(-50%, 10px) scale(0.9); }

/* ==================== EVOLVING STREAK BACKGROUND ==================== */
/* Root wrapper gets its own stacking context so bg-fx can sit at z-index -1
   without leaking behind the html element — keeps sibling components intact. */
[class*='streak-tier-'] {
  isolation: isolate;
}
.streak-bg-fx {
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.6s ease, filter 0.6s ease;
  pointer-events: none;
}
.streak-tier-0 .streak-bg-fx { opacity: 0; }

.streak-tier-1 .streak-bg-fx {
  opacity: 1;
  background: radial-gradient(circle at 50% 50%, rgba(245, 166, 35, 0.08), transparent 60%);
}

.streak-tier-2 .streak-bg-fx {
  opacity: 1;
  background:
    radial-gradient(circle at 30% 35%, rgba(245, 166, 35, 0.12), transparent 55%),
    radial-gradient(circle at 70% 65%, rgba(0, 214, 143, 0.1), transparent 55%);
  animation: streak-pulse 3.2s ease-in-out infinite;
}

.streak-tier-3 .streak-bg-fx {
  opacity: 1;
  background:
    radial-gradient(circle at 25% 30%, rgba(232, 67, 147, 0.18), transparent 50%),
    radial-gradient(circle at 75% 70%, rgba(245, 166, 35, 0.18), transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(0, 214, 143, 0.1), transparent 65%);
  animation: streak-pulse 2.4s ease-in-out infinite, streak-hue 6s linear infinite;
}

.streak-tier-4 .streak-bg-fx {
  opacity: 1;
  background:
    radial-gradient(circle at 20% 25%, rgba(232, 67, 147, 0.22), transparent 45%),
    radial-gradient(circle at 80% 30%, rgba(255, 215, 0, 0.2), transparent 45%),
    radial-gradient(circle at 50% 85%, rgba(0, 229, 255, 0.18), transparent 50%);
  animation: streak-pulse 1.9s ease-in-out infinite, streak-hue 4.5s linear infinite;
}

.streak-tier-5 .streak-bg-fx {
  opacity: 1;
  background:
    radial-gradient(circle at 15% 20%, rgba(255, 0, 128, 0.28), transparent 42%),
    radial-gradient(circle at 85% 25%, rgba(255, 215, 0, 0.25), transparent 42%),
    radial-gradient(circle at 50% 95%, rgba(0, 229, 255, 0.22), transparent 48%),
    radial-gradient(circle at 30% 75%, rgba(138, 43, 226, 0.2), transparent 45%);
  animation: streak-pulse 1.2s ease-in-out infinite, streak-hue 2.8s linear infinite, streak-shake 0.6s ease-in-out infinite;
}

@keyframes streak-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
@keyframes streak-hue {
  0%, 100% { filter: hue-rotate(0deg); }
  50% { filter: hue-rotate(180deg); }
}
@keyframes streak-shake {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-2px, 1px) scale(1.02); }
  75% { transform: translate(2px, -1px) scale(1.02); }
}

/* Timer-critical: pulsating rød bar når der er <30% tid tilbage */
.timer-critical {
  animation: timer-panic 0.55s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(232, 67, 147, 0.75);
}
@keyframes timer-panic {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

</style>
