<script setup lang="ts">
import confetti from 'canvas-confetti'

const router = useRouter()
const { state, startGame, getScoreComment } = useGame()
const { getResultQuote } = useJim()

const jimResultQuote = ref('')

// Redirect if no result data
if (!state.value.lastResult) {
  router.replace('/')
}

const isAnimating = ref(false)
const displayScore = ref(0)
const showDetails = ref(false)
const scoreSaved = ref(false)

onMounted(() => {
  const result = state.value.lastResult
  if (!result) return

  // Animate score counter
  const targetScore = result.score
  const duration = 1500
  const startTime = Date.now()

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayScore.value = Math.round(targetScore * eased)

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      showDetails.value = true
    }
  }

  jimResultQuote.value = getResultQuote(result.score, result.isPerfect)

  setTimeout(() => {
    isAnimating.value = true
    animate()
    submitScore()
  }, 300)

  // Confetti for good scores
  if (result.score >= 600) {
    setTimeout(() => {
      confetti({
        particleCount: result.isPerfect ? 200 : 100,
        spread: result.isPerfect ? 160 : 70,
        origin: { y: 0.3 },
        colors: ['#F5A623', '#00D68F', '#E84393'],
      })
    }, 1000)
  }
})

async function submitScore() {
  const result = state.value.lastResult
  if (scoreSaved.value || !state.value.nickname || !result) return
  try {
    await $fetch('/api/leaderboard', {
      method: 'POST',
      body: {
        nickname: state.value.nickname,
        score: result.score,
        correct: result.correct,
        wrong: result.wrong,
        bestStreak: result.bestStreak,
        difficulty: state.value.difficulty,
        durationMs: result.durationMs,
      },
    })
    scoreSaved.value = true
  } catch {}
}

const result = computed(() => state.value.lastResult)
const scoreComment = computed(() => getScoreComment())
const duration = computed(() => Math.round((result.value?.durationMs ?? 0) / 1000))

function playAgain() {
  startGame()
  router.push('/play')
}

async function shareResult() {
  const r = result.value
  if (!r) return
  const text = `Jeg scorede ${r.score} point på ErDetLars.dk! ${r.correct}/${r.totalSwiped} korrekte efter ${r.totalSwiped} swipes. Kan du gøre det bedre? 🔥`
  if (navigator.share) {
    try {
      await navigator.share({ text, url: 'https://erdetlars.dk' })
    } catch {}
  } else {
    await navigator.clipboard.writeText(text)
  }
}
</script>

<template>
  <div v-if="result" class="h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
    <!-- Home button -->
    <NuxtLink
      to="/"
      class="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors z-10"
    >
      <Icon name="mdi:home" size="20" />
    </NuxtLink>

    <!-- Background glow -->
    <div
      class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none transition-opacity duration-1000"
      :class="[
        result.isPerfect ? 'bg-glow-accent' : result.score >= 600 ? 'bg-glow-success' : 'bg-glow-error',
        isAnimating ? 'opacity-40' : 'opacity-0',
      ]"
    />

    <!-- Perfect round badge -->
    <div
      v-if="result.isPerfect"
      class="mb-4 transition-all duration-700 delay-500"
      :class="showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
    >
      <div class="glass rounded-full px-5 py-2 flex items-center gap-2 shadow-glow">
        <span class="text-lg">👑</span>
        <span class="font-heading font-bold text-accent text-sm uppercase tracking-wider">Perfekt runde! +500</span>
        <span class="text-lg">👑</span>
      </div>
    </div>

    <!-- Score -->
    <div
      class="text-center mb-8 transition-all duration-1000"
      :class="isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
    >
      <p class="font-heading font-semibold text-muted text-sm uppercase tracking-widest mb-2">Din score</p>
      <p class="font-mono font-bold text-7xl sm:text-8xl text-white tabular-nums">
        {{ displayScore.toLocaleString() }}
      </p>
      <p class="font-body text-accent text-lg mt-3 italic">
        "{{ scoreComment }}"
      </p>
    </div>

    <!-- Stats breakdown -->
    <div
      class="w-full max-w-sm glass rounded-2xl p-5 mb-8 transition-all duration-700 delay-300"
      :class="showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <div class="grid grid-cols-4 gap-3 text-center">
        <div>
          <p class="font-mono font-bold text-2xl text-white">{{ result.totalSwiped }}</p>
          <p class="text-muted text-xs font-body">Swipes</p>
        </div>
        <div>
          <p class="font-mono font-bold text-2xl text-success">{{ result.correct }}</p>
          <p class="text-muted text-xs font-body">Korrekte</p>
        </div>
        <div>
          <p class="font-mono font-bold text-2xl text-error">{{ result.wrong }}</p>
          <p class="text-muted text-xs font-body">Forkerte</p>
        </div>
        <div>
          <p class="font-mono font-bold text-2xl text-accent">{{ result.bestStreak }}</p>
          <p class="text-muted text-xs font-body">Streak</p>
        </div>
      </div>
      <div class="border-t border-white/10 mt-4 pt-3 text-center">
        <p class="text-muted text-xs font-mono">Tid: {{ duration }}s &middot; {{ Math.round(result.correct / Math.max(result.totalSwiped, 1) * 100) }}% korrekt</p>
      </div>
    </div>

    <!-- Jim's comment -->
    <div
      v-if="jimResultQuote"
      class="w-full max-w-sm mb-6 transition-all duration-700 delay-400"
      :class="showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <JimQuote :quote="jimResultQuote" mode="inline" />
    </div>

    <!-- Buttons -->
    <div
      class="flex flex-col w-full max-w-xs gap-3 transition-all duration-700 delay-500"
      :class="showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <button
        class="w-full py-4 rounded-2xl bg-accent text-primary font-heading font-bold text-lg uppercase tracking-wider shadow-glow btn-press hover:bg-accent-light transition-colors"
        @click="playAgain"
      >
        Spil igen
      </button>

      <button
        class="w-full py-3.5 rounded-2xl glass text-white font-heading font-semibold text-base hover:bg-white/10 transition-colors btn-press"
        @click="shareResult"
      >
        <Icon name="mdi:share-variant" size="18" class="mr-2" />
        Del resultat
      </button>

      <NuxtLink
        to="/minigames"
        class="w-full py-3 rounded-xl glass text-center text-accent font-heading font-semibold text-sm hover:bg-accent/10 transition-colors flex items-center justify-center gap-2"
      >
        <Icon name="mdi:gamepad-variant" size="18" />
        Prøv et minispil!
      </NuxtLink>

      <div class="flex gap-3">
        <NuxtLink
          to="/leaderboard"
          class="flex-1 py-3 rounded-xl glass text-center text-muted font-heading text-sm hover:text-white transition-colors"
        >
          Leaderboard
        </NuxtLink>
        <NuxtLink
          to="/"
          class="flex-1 py-3 rounded-xl glass text-center text-muted font-heading text-sm hover:text-white transition-colors"
        >
          Hjem
        </NuxtLink>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div v-else class="h-screen flex items-center justify-center">
    <div class="text-center">
      <div class="text-4xl mb-3">🍺</div>
      <p class="text-muted font-body">Beregner score...</p>
    </div>
  </div>
</template>
