<script setup lang="ts">
const { state, setNickname, startGame } = useGame()
const { getIdleQuote, shouldJimAppear } = useJim()
const { unlockedCount, totalCount, completionPct } = useCollection()
const { unlockedCount: achUnlocked, totalCount: achTotal } = useAchievements()
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

function handleDrunkPlay() {
  if (!nicknameInput.value.trim()) {
    showNicknameInput.value = true
    return
  }
  setNickname(nicknameInput.value)
  router.push('/fuld-med-lars')
}

function handleNicknameSubmit() {
  if (nicknameInput.value.trim()) {
    setNickname(nicknameInput.value)
    showNicknameInput.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-6 py-8 relative">
    <!-- Background glow effects -->
    <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-glow-accent opacity-30 blur-3xl pointer-events-none" />
    <div class="absolute bottom-0 inset-x-0 h-[300px] bg-gradient-to-t from-[#E84393]/10 to-transparent pointer-events-none" />

    <!-- Logo area -->
    <div
      class="text-center mb-8 transition-all duration-1000 relative z-10"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <div class="relative inline-block mb-5">
        <div class="w-24 h-24 rounded-full bg-surface border-2 border-accent/30 flex items-center justify-center mx-auto shadow-glow">
          <span class="text-5xl font-heading font-bold text-accent">?</span>
        </div>
        <div class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent animate-pulse-glow" />
      </div>

      <h1 class="font-heading font-bold text-4xl sm:text-5xl tracking-tight mb-2">
        <span class="text-white">ER DET</span>
        <br>
        <span class="text-accent text-5xl sm:text-6xl">LARS</span>
        <span class="text-accent text-5xl sm:text-6xl">?</span>
      </h1>

      <p class="text-muted text-base mt-3 font-body">
        Kan <span class="text-white font-semibold">DU</span> spotte den rigtige Lars?
      </p>
    </div>

    <!-- Nickname input -->
    <div
      class="w-full max-w-xs mb-5 transition-all duration-700 delay-300 relative z-10"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <div v-if="showNicknameInput" class="space-y-3">
        <input
          v-model="nicknameInput"
          type="text"
          placeholder="Dit navn..."
          maxlength="20"
          class="w-full px-5 py-3 rounded-xl bg-surface border border-white/10 text-white text-center text-lg font-body placeholder-muted focus:outline-none focus:border-accent/50 focus:shadow-glow transition-all"
          @keyup.enter="handleNicknameSubmit"
        >
      </div>
      <div v-else class="text-center">
        <p class="text-muted text-sm">
          Spiller som <button class="text-accent font-semibold hover:underline" @click="showNicknameInput = true">{{ state.nickname }}</button>
        </p>
      </div>
    </div>

    <!-- Play buttons -->
    <div
      class="flex flex-col items-stretch gap-2.5 w-full max-w-xs transition-all duration-700 delay-500 relative z-10"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <button
        class="relative w-full py-4 rounded-2xl bg-accent text-primary font-heading font-bold text-lg uppercase tracking-wider shadow-glow btn-press animate-pulse-glow hover:bg-accent-light transition-colors"
        @click="handlePlay"
      >
        SPIL
      </button>

      <button
        class="w-full py-3 rounded-xl glass text-white font-heading font-bold text-sm uppercase tracking-wider border border-pink-accent/40 hover:bg-pink-accent/10 transition-colors btn-press flex items-center justify-center gap-2"
        @click="handleDrunkPlay"
      >
        <Icon name="mdi:glass-mug-variant" size="18" class="text-pink-accent" />
        <span class="text-pink-accent">Fuld med Lars</span>
      </button>
    </div>

    <!-- Progress Pills: Collection + Achievements -->
    <div
      class="flex gap-2.5 mt-6 transition-all duration-700 delay-700 relative z-10"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <NuxtLink
        to="/samling"
        class="glass rounded-2xl px-3.5 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors btn-press"
      >
        <Icon name="mdi:cards" size="18" class="text-accent" />
        <div class="text-left leading-tight">
          <p class="text-[9px] font-heading font-bold text-muted uppercase tracking-widest">Pokédex</p>
          <p class="font-mono font-bold text-sm text-white tabular-nums">
            {{ unlockedCount }}<span class="text-muted">/{{ totalCount }}</span>
          </p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/achievements"
        class="glass rounded-2xl px-3.5 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors btn-press"
      >
        <Icon name="mdi:trophy" size="18" class="text-accent" />
        <div class="text-left leading-tight">
          <p class="text-[9px] font-heading font-bold text-muted uppercase tracking-widest">Trofæer</p>
          <p class="font-mono font-bold text-sm text-white tabular-nums">
            {{ achUnlocked }}<span class="text-muted">/{{ achTotal }}</span>
          </p>
        </div>
      </NuxtLink>
    </div>

    <!-- Bottom nav -->
    <div
      class="flex gap-5 mt-6 transition-all duration-700 delay-900 relative z-10"
      :class="isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'"
    >
      <NuxtLink
        to="/minigames"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:gamepad-variant" size="24" />
        <span class="text-[10px] font-body">Minispil</span>
      </NuxtLink>
      <NuxtLink
        to="/leaderboard"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:podium" size="24" />
        <span class="text-[10px] font-body">Leaderboard</span>
      </NuxtLink>
      <NuxtLink
        to="/submit"
        class="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
      >
        <Icon name="mdi:camera-plus" size="24" />
        <span class="text-[10px] font-body">Indsend</span>
      </NuxtLink>
    </div>

    <!-- Stats -->
    <div
      v-if="state.totalRounds > 0"
      class="mt-5 text-center transition-all duration-700 delay-1000 relative z-10"
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

    <!-- Achievement toasts -->
    <AchievementToast />
  </div>
</template>
