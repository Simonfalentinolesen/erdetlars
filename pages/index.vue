<script setup lang="ts">
const { state, setNickname, startGame } = useGame()
const { getIdleQuote, shouldJimAppear } = useJim()
const router = useRouter()

const nicknameInput = ref(state.value.nickname || '')
const showNicknameInput = ref(!state.value.nickname)
const isAnimating = ref(false)

// Jim random appearance
const showJim = ref(false)
const jimQuote = ref('')

onMounted(() => {
  setTimeout(() => {
    isAnimating.value = true
  }, 100)

  // Jim appears ~15% of the time
  if (shouldJimAppear(0.15)) {
    jimQuote.value = getIdleQuote()
    setTimeout(() => {
      showJim.value = true
    }, 2000)
    // Auto-dismiss after 6s
    setTimeout(() => {
      showJim.value = false
    }, 8000)
  }
})

function handlePlay() {
  if (!nicknameInput.value.trim()) {
    showNicknameInput.value = true
    return
  }
  setNickname(nicknameInput.value)
  startGame()
  router.push('/play')
}

function handleNicknameSubmit() {
  if (nicknameInput.value.trim()) {
    setNickname(nicknameInput.value)
    showNicknameInput.value = false
  }
}
</script>

<template>
  <div class="h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
    <!-- Background glow effects -->
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-glow-accent opacity-30 blur-3xl pointer-events-none" />
    <div class="absolute bottom-0 inset-x-0 h-[300px] bg-gradient-to-t from-[#E84393]/10 to-transparent pointer-events-none" />

    <!-- Logo area -->
    <div
      class="text-center mb-10 transition-all duration-1000"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <div class="relative inline-block mb-6">
        <div class="w-28 h-28 rounded-full bg-surface border-2 border-accent/30 flex items-center justify-center mx-auto shadow-glow">
          <span class="text-6xl font-heading font-bold text-accent">?</span>
        </div>
        <div class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent animate-pulse-glow" />
      </div>

      <h1 class="font-heading font-bold text-5xl sm:text-6xl tracking-tight mb-2">
        <span class="text-white">ER DET</span>
        <br>
        <span class="text-accent text-6xl sm:text-7xl">LARS</span>
        <span class="text-accent text-6xl sm:text-7xl">?</span>
      </h1>

      <p class="text-muted text-lg mt-4 font-body">
        Kan <span class="text-white font-semibold">DU</span> spotte den rigtige Lars?
      </p>
    </div>

    <!-- Nickname input -->
    <div
      class="w-full max-w-xs mb-6 transition-all duration-700 delay-300"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <div v-if="showNicknameInput" class="space-y-3">
        <input
          v-model="nicknameInput"
          type="text"
          placeholder="Dit navn..."
          maxlength="20"
          class="w-full px-5 py-3.5 rounded-xl bg-surface border border-white/10 text-white text-center text-lg font-body placeholder-muted focus:outline-none focus:border-accent/50 focus:shadow-glow transition-all"
          @keyup.enter="handleNicknameSubmit"
        >
      </div>
      <div v-else class="text-center">
        <p class="text-muted text-sm">
          Spiller som <button class="text-accent font-semibold hover:underline" @click="showNicknameInput = true">{{ state.nickname }}</button>
        </p>
      </div>
    </div>

    <!-- Play button -->
    <div
      class="transition-all duration-700 delay-500"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <button
        class="relative px-16 py-5 rounded-2xl bg-accent text-primary font-heading font-bold text-2xl uppercase tracking-wider shadow-glow btn-press animate-pulse-glow hover:bg-accent-light transition-colors"
        @click="handlePlay"
      >
        SPIL
      </button>
    </div>

    <!-- Bottom nav -->
    <div
      class="flex gap-6 mt-10 transition-all duration-700 delay-700"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <NuxtLink
        to="/minigames"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:gamepad-variant" size="28" />
        <span class="text-xs font-body">Minispil</span>
      </NuxtLink>
      <NuxtLink
        to="/leaderboard"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:trophy" size="28" />
        <span class="text-xs font-body">Leaderboard</span>
      </NuxtLink>
      <NuxtLink
        to="/achievements"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:medal" size="28" />
        <span class="text-xs font-body">Achievements</span>
      </NuxtLink>
      <NuxtLink
        to="/submit"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:camera-plus" size="28" />
        <span class="text-xs font-body">Indsend</span>
      </NuxtLink>
    </div>

    <!-- Stats -->
    <div
      v-if="state.totalRounds > 0"
      class="absolute bottom-8 text-center transition-all duration-700 delay-900"
      :class="isAnimating ? 'opacity-100' : 'opacity-0'"
    >
      <p class="text-muted text-xs font-mono">
        {{ state.totalRounds }} runder spillet &middot; {{ state.totalCorrect }} korrekte
      </p>
    </div>

    <!-- Jim random toast -->
    <JimQuote
      :show="showJim"
      :quote="jimQuote"
      mode="toast"
      @dismiss="showJim = false"
    />
  </div>
</template>
