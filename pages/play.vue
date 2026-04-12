<script setup lang="ts">
import confetti from 'canvas-confetti'

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

// Redirect if no game started
if (state.value.screen !== 'playing') {
  router.replace('/')
}

const currentImage = computed(() => getCurrentImage())
const isProcessing = ref(false)

// Feedback state
const showFeedback = ref(false)
const feedbackCorrect = ref(false)
const feedbackPoints = ref(0)
const feedbackMessage = ref('')
const feedbackSpeedBonus = ref(false)

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

// Track if answer came from button
const answerFromButton = ref(false)

// Keyboard arrow keys for desktop swipe + dismiss facts
function onKeyDown(e: KeyboardEvent) {
  // Dismiss Jim Fact overlay with any key
  if (showFact.value) {
    e.preventDefault()
    dismissFact()
    return
  }
  if (isProcessing.value) return
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

  const direction = guessedLars ? 'right' : 'left'
  if (swipeCardRef.value?.triggerSwipe) {
    swipeCardRef.value.triggerSwipe(direction)
  }

  setTimeout(() => {
    processAnswer(guessedLars)
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

async function processAnswer(guessedLars: boolean) {
  const result = answer(guessedLars)

  feedbackCorrect.value = result.correct
  feedbackPoints.value = result.points
  feedbackSpeedBonus.value = result.speedBonus
  feedbackMessage.value = result.correct ? getCorrectQuote() : getWrongQuote()
  showFeedback.value = true

  // Jim shows immediately with his comment
  jimToastQuote.value = feedbackMessage.value
  showJimToast.value = true

  // Sound + confetti
  if (result.correct) {
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
  } else {
    playWrong()
  }

  // Streak message overrides
  const streakMsg = getStreakMessage()
  if (streakMsg) feedbackMessage.value = streakMsg

  localAnswerCount.value++

  await new Promise(r => setTimeout(r, 650))
  showFeedback.value = false
  // Jim stays visible until next answer (dismissed in processAnswer)

  // Lars Fact every 5 answers
  if (localAnswerCount.value % 5 === 0) {
    factText.value = getRandomFact()
    showFact.value = true
    return
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

    <!-- Swiped counter -->
    <div class="text-center py-1">
      <span class="text-muted text-xs font-mono">{{ state.totalSwiped }} swiped</span>
    </div>

    <!-- Card area -->
    <div class="flex-1 flex items-center justify-center px-6 relative">
      <!-- Background card for depth -->
      <div
        class="absolute w-full max-w-[320px] aspect-[4/5] rounded-3xl bg-surface/50 border border-white/5 scale-[0.92] translate-y-3 opacity-50"
      />

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

    <!-- Jim's speech bubble (pops up with animation) -->
    <div class="px-4 py-1 min-h-[50px] flex items-center justify-center relative">
      <Transition name="jim-bubble">
        <div
          v-if="showJimToast"
          :key="jimToastQuote"
          class="flex items-center gap-2.5 max-w-sm w-full rounded-2xl px-3 py-2.5 relative jim-speech-bubble"
          :class="feedbackCorrect ? 'bg-success/15 border border-success/30' : 'bg-error/15 border border-error/30'"
        >
          <!-- Jim avatar with bounce -->
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
          <!-- Emoji reaction -->
          <span class="text-lg flex-shrink-0">{{ feedbackCorrect ? '👆' : '😤' }}</span>
        </div>
      </Transition>
    </div>

    <!-- Action buttons -->
    <div class="pb-5 pt-1 px-6 safe-bottom">
      <ActionButtons
        @not-lars="handleButtonAnswer(false)"
        @is-lars="handleButtonAnswer(true)"
      />
    </div>

    <!-- Points float overlay (just the number, no message) -->
    <FeedbackOverlay
      :show="showFeedback"
      :correct="feedbackCorrect"
      :points="feedbackPoints"
      :message="''"
      :speed-bonus="feedbackSpeedBonus"
    />

    <!-- JIM FAKTA - Big fullscreen overlay -->
    <Transition name="jim-fact">
      <div
        v-if="showFact"
        class="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        @click="dismissFact"
      >
        <div class="mx-6 max-w-sm w-full text-center" @click.stop>
          <!-- Jim large avatar -->
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
            <p class="text-muted/40 text-xs mt-3 font-mono">Tryk hvor som helst eller brug piltaster</p>
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
/* Jim speech bubble - bounces in */
.jim-bubble-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jim-bubble-leave-active { transition: all 0.2s ease-in; }
.jim-bubble-enter-from { opacity: 0; transform: scale(0.7) translateY(15px); }
.jim-bubble-leave-to { opacity: 0; transform: scale(0.9) translateY(-5px); }

/* Jim avatar bounces */
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
</style>
