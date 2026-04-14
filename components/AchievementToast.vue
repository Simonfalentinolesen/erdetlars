<script setup lang="ts">
import type { AchievementDef, AchievementTier } from '~/composables/useAchievements'

const { consumeToast } = useAchievements()

const current = ref<AchievementDef | null>(null)
const visible = ref(false)

let pollInterval: ReturnType<typeof setInterval> | null = null

function tierConfig(tier: AchievementTier) {
  switch (tier) {
    case 'bronze': return { color: '#CD7F32', label: 'BRONZE', glow: 'rgba(205, 127, 50, 0.5)' }
    case 'silver': return { color: '#C0C0C0', label: 'SØLV', glow: 'rgba(192, 192, 192, 0.5)' }
    case 'gold': return { color: '#F5A623', label: 'GULD', glow: 'rgba(245, 166, 35, 0.6)' }
    case 'legendary': return { color: '#E84393', label: 'LEGENDARISK', glow: 'rgba(232, 67, 147, 0.7)' }
  }
}

function showNext() {
  if (visible.value) return
  const toast = consumeToast()
  if (!toast) return
  current.value = toast
  visible.value = true
  // Auto-dismiss after 4s
  setTimeout(() => {
    visible.value = false
    setTimeout(() => {
      current.value = null
      showNext() // show next one in queue
    }, 400)
  }, 4000)
}

onMounted(() => {
  pollInterval = setInterval(showNext, 600)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

function dismiss() {
  visible.value = false
  setTimeout(() => {
    current.value = null
    showNext()
  }, 300)
}
</script>

<template>
  <Transition name="achievement-slide">
    <div
      v-if="visible && current"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto"
      @click="dismiss"
    >
      <div
        class="glass rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl border"
        :style="{
          borderColor: tierConfig(current.tier).color,
          boxShadow: `0 0 30px ${tierConfig(current.tier).glow}, 0 8px 24px rgba(0,0,0,0.4)`,
        }"
      >
        <!-- Medal icon circle -->
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 medal-pulse"
          :style="{
            background: `linear-gradient(135deg, ${tierConfig(current.tier).color}33 0%, ${tierConfig(current.tier).color}11 100%)`,
            border: `2px solid ${tierConfig(current.tier).color}`,
          }"
        >
          <Icon
            :name="current.icon"
            size="24"
            :style="{ color: tierConfig(current.tier).color }"
          />
        </div>

        <!-- Text -->
        <div class="min-w-0 pr-2">
          <p
            class="text-[9px] font-heading font-bold tracking-widest uppercase mb-0.5"
            :style="{ color: tierConfig(current.tier).color }"
          >
            {{ tierConfig(current.tier).label }} TROFÆ LÅST OP
          </p>
          <p class="text-white font-heading font-bold text-sm leading-tight">
            {{ current.name }}
          </p>
          <p class="text-muted text-[10px] font-body leading-tight truncate max-w-[220px]">
            {{ current.description }}
          </p>
        </div>

        <!-- Sparkle -->
        <div class="text-lg flex-shrink-0">✨</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.achievement-slide-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.achievement-slide-leave-active {
  transition: all 0.4s ease-in;
}
.achievement-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -30px) scale(0.8);
}
.achievement-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px) scale(0.9);
}

.medal-pulse {
  animation: medal-glow 2s ease-in-out infinite;
}

@keyframes medal-glow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
</style>
