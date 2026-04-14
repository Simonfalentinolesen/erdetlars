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
} = useGame()
const { playCorrect, playWrong, playStreak } = useSound()
const { getCorrectQuote, getWrongQuote } = useJim()
const { unlock: unlockCard, unlockedCount, totalCount, mythicalUnlocked } = useCollection()
const { checkAll, recordCorrectAnswer, resetStreakTimer, recordFooled, recordFactRead, recordPrankSurvived, recordPowerUpUsed } = useAchievements()
const { inventory, hintActive, recentlyEarned, awardRandom, use: usePowerUp, consumeShield, consumeDouble, startSession } = usePowerUps()
const { activePrank, prankQuote, maybeTrigger: maybeJimPrank, enabled: pranksEnabled } = useJimPranks()
const { shouldShowTeaser, shouldShowInterstitial, getAdBreakCopy, markTeaserDismissed, markTeaserClicked } = useMinigamePromo()

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

// Lars Fact state
const showFact = ref(false)
const factText = ref('')

// Jim state
const showJimToast = ref(false)
const jimToastQuote = ref('')

// Card ref
const swipeCardRef = ref<any>(null)

// Track answers for Lars Fact timing
const localAnswerCount = ref(0)
const answerFromButton = ref(false)

// Minigame promo state
const teaserPromo = ref<ReturnType<typeof shouldShowTeaser>>(null)
const interstitialPromo = ref<ReturnType<typeof shouldShowInterstitial>>(null)
const interstitialCopy = ref<{ headline: string; sub: string } | null>(null)

function dismissTeaser() {
  markTeaserDismissed()
  teaserPromo.value = null
}
function playTeaser() {
  if (!teaserPromo.value) return
  markTeaserClicked()
  const path = teaserPromo.value.path
  teaserPromo.value = null
  // Stop current game so it doesn't linger
  stopGame()
  router.push(path)
}

function dismissInterstitial() {
  interstitialPromo.value = null
}
function playInterstitial() {
  if (!interstitialPromo.value) return
  markTeaserClicked()
  const path = interstitialPromo.value.path
  interstitialPromo.value = null
  stopGame()
  router.push(path)
}

// Prank-induced button swap
const buttonsSwapped = computed(() => activePrank.value?.type === 'button-swap')
const cardBlurred = computed(() => activePrank.value?.type === 'blur')
const upsideDown = computed(() => activePrank.value?.type === 'upside-down')

// Shield/double indicators (visual state)
const shieldActive = computed(() => {
  return (window as any).__erdetlars_shield_active ?? false
})

function onKeyDown(e: KeyboardEvent) {
  // Dismiss fact
  if (showFact.value) {
    e.preventDefault()
    dismissFact()
    return
  }
  // Dismiss Jim-rant prank
  if (activePrank.value?.type === 'jim-rant') {
    e.preventDefault()
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
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
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

async function processAnswer(guessedLars: boolean) {
  const image = getCurrentImage()
  if (!image) return

  const result = answer(guessedLars)
  const wasCorrect = result.correct

  // Apply power-up effects
  let finalPoints = result.points
  const doubleMult = consumeDouble()
  if (doubleMult > 1 && wasCorrect) {
    finalPoints = Math.round(finalPoints * doubleMult)
    // Retroactively add the extra points (original answer already counted base)
    state.value.score = Math.max(0, state.value.score + (finalPoints - result.points))
  }

  // Determine what Jim says this round — priority: shield > streak milestone > regular quote
  let jimSays = wasCorrect ? getCorrectQuote() : getWrongQuote()

  // Shield: if wrong, restore streak + override quote
  if (!wasCorrect) {
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

  // Sound + confetti
  if (wasCorrect) {
    playCorrect()
    if (state.value.streak >= 5) {
      confetti({
        particleCount: state.value.streak * 10,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F5A623', '#00D68F', '#E84393', '#FFFFFF'],
      })
      playStreak()
    }

    // Award power-up every 5 in a row
    if (state.value.streak > 0 && state.value.streak % 5 === 0) {
      const pickedUp = awardRandom()
      // Let existing toast show, then supplement
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

  // Lars Fact every 5 answers
  if (localAnswerCount.value % 5 === 0) {
    factText.value = getRandomFact()
    showFact.value = true
    recordFactRead()
    return
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

  // Minigame promo — interstitial takes priority over teaser
  // Don't trigger during a prank (would clash visually)
  if (!prank && !showFact.value) {
    const interstitial = shouldShowInterstitial(localAnswerCount.value, state.value.streak)
    if (interstitial) {
      interstitialCopy.value = getAdBreakCopy()
      interstitialPromo.value = interstitial
    } else {
      const teaser = shouldShowTeaser(localAnswerCount.value)
      if (teaser) {
        teaserPromo.value = teaser
      }
    }
  }

  readyForNext()
}

function dismissFact() {
  showFact.value = false
  readyForNext()
}

function readyForNext() {
  isProcessing.value = false
}

function handleStopGame() {
  stopGame()
  router.push('/result')
}

// Card ref forwarding for buttons (they show swapped labels)
const leftLabel = computed(() => buttonsSwapped.value ? 'Det er Lars!' : 'Ikke Lars')
const rightLabel = computed(() => buttonsSwapped.value ? 'Ikke Lars' : 'Det er Lars!')
</script>

<template>
  <div v-if="state.screen === 'playing'" class="h-screen flex flex-col relative overflow-hidden">
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

    <!-- Swiped counter + collection progress -->
    <div class="text-center py-1 flex items-center justify-center gap-3">
      <span class="text-muted text-xs font-mono">{{ state.totalSwiped }} swiped</span>
      <NuxtLink to="/samling" class="text-muted text-xs font-mono hover:text-accent transition-colors flex items-center gap-1">
        <Icon name="mdi:cards" size="12" />
        {{ unlockedCount }}/{{ totalCount }}
      </NuxtLink>
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
        :class="{ 'hint-zoom': hintActive, 'card-blur-prank': cardBlurred }"
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
          v-if="unlockedCardToast"
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

    <!-- Jim's speech bubble -->
    <div class="px-4 py-1 min-h-[50px] flex items-center justify-center relative">
      <Transition name="jim-bubble">
        <div
          v-if="showJimToast"
          :key="jimToastQuote"
          class="flex items-center gap-2.5 max-w-sm w-full rounded-2xl px-3 py-2.5 relative jim-speech-bubble"
          :class="feedbackCorrect ? 'bg-success/15 border border-success/30' : 'bg-error/15 border border-error/30'"
        >
          <div class="flex-shrink-0 w-10 h-10 jim-avatar-bounce">
            <svg viewBox="0 0 32 32" class="w-full h-full" fill="none">
              <circle cx="16" cy="12" r="8" fill="#E0B89A"/>
              <path d="M10 9 Q16 2 22 9" stroke="#9E3030" stroke-width="0.8" fill="none"/>
              <circle cx="16" cy="4" r="1" fill="#9E3030"/>
              <circle cx="13.5" cy="11" r="1" fill="#6AACDB"/>
              <circle cx="18.5" cy="11" r="1" fill="#6AACDB"/>
              <rect x="10" y="18" width="12" height="10" rx="2" fill="#F5F0E8"/>
              <circle cx="13" cy="22" r="1.5" fill="#1A1A1A"/>
              <circle cx="19" cy="24" r="1.5" fill="#1A1A1A"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white text-sm font-body leading-snug font-medium">
              {{ jimToastQuote }}
            </p>
          </div>
          <span class="text-lg flex-shrink-0">{{ feedbackCorrect ? '👆' : '😤' }}</span>
        </div>
      </Transition>
    </div>

    <!-- Power-up bar -->
    <div class="pt-1 pb-2">
      <PowerUpBar :disabled="isProcessing" @use="handleUsePowerUp" />
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

    <!-- JIM FAKTA - fullscreen overlay -->
    <Transition name="jim-fact">
      <div
        v-if="showFact"
        class="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        @click="dismissFact"
      >
        <div class="mx-6 max-w-sm w-full text-center" @click.stop>
          <div class="w-20 h-20 mx-auto mb-4">
            <svg viewBox="0 0 48 52" class="w-full h-full" fill="none">
              <circle cx="24" cy="16" r="14" fill="#E0B89A"/>
              <path d="M14 12 Q24 0 34 12" stroke="#9E3030" stroke-width="1.5" fill="none"/>
              <path d="M16 10 Q24 2 32 10" stroke="#9E3030" stroke-width="1" fill="none"/>
              <circle cx="24" cy="4" r="2" fill="#9E3030"/>
              <circle cx="20" cy="15" r="2" fill="#6AACDB"/>
              <circle cx="28" cy="15" r="2" fill="#6AACDB"/>
              <path d="M22 20 L26 20" stroke="#B08070" stroke-width="1" stroke-linecap="round"/>
              <rect x="14" y="28" width="20" height="18" rx="3" fill="#F5F0E8"/>
              <circle cx="19" cy="34" r="2.5" fill="#1A1A1A"/>
              <circle cx="29" cy="38" r="3" fill="#1A1A1A"/>
              <circle cx="24" cy="32" r="1.5" fill="#1A1A1A"/>
              <path d="M34 28 L40 18 L41 16" stroke="#E0B89A" stroke-width="3" stroke-linecap="round"/>
              <circle cx="41" cy="15" r="2" fill="#E0B89A"/>
            </svg>
          </div>

          <div class="glass rounded-2xl p-6 border border-accent/20">
            <p class="font-heading font-bold text-accent text-sm uppercase tracking-widest mb-3">
              Jim fortæller
            </p>
            <p class="text-white font-body text-lg leading-relaxed mb-5">
              {{ factText }}
            </p>
            <button
              class="px-8 py-3 rounded-xl bg-accent text-primary font-heading font-bold text-sm uppercase tracking-wider btn-press hover:bg-accent-light transition-colors"
              @click="dismissFact"
            >
              Ja, Jim... Videre!
            </button>
            <p class="text-muted/40 text-xs mt-3 font-mono">Tryk hvor som helst for at fortsætte</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Jim Pranks overlay -->
    <JimPrankOverlay :prank="activePrank" :quote="prankQuote" />

    <!-- Power-up earned toast -->
    <PowerUpEarnedToast :type="recentlyEarned" />

    <!-- Achievement toasts -->
    <AchievementToast />

    <!-- Minigame teaser (light touch, dismissable) -->
    <MinigameTeaser
      :promo="teaserPromo"
      @dismiss="dismissTeaser"
      @play="playTeaser"
    />

    <!-- Minigame interstitial (bigger ad break) -->
    <MinigameInterstitial
      :promo="interstitialPromo"
      :headline="interstitialCopy?.headline"
      :sub="interstitialCopy?.sub"
      @dismiss="dismissInterstitial"
      @play="playInterstitial"
    />
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

/* Power-up effects */
.hint-zoom {
  transform: scale(1.15);
}

.card-blur-prank {
  filter: blur(8px) saturate(0.7);
  transition: filter 0.3s ease;
}

/* Prank: upside down */
.upside-down-wrapper {
  transform: rotate(180deg);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
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
</style>
