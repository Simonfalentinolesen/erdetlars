<script setup lang="ts">
import type { MinigamePromo } from '~/composables/useMinigamePromo'

const props = defineProps<{
  promo: MinigamePromo | null
  headline?: string
  sub?: string
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'play'): void
}>()

// Ad countdown — like a real ad break
const countdown = ref(3)
let countdownInterval: ReturnType<typeof setInterval> | null = null
const canSkip = computed(() => countdown.value <= 0)

watch(() => props.promo, (v) => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (v) {
    countdown.value = 3
    countdownInterval = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }, 1000)
  }
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})

function trySkip() {
  if (canSkip.value) emit('dismiss')
}
</script>

<template>
  <Transition name="interstitial">
    <div
      v-if="promo"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-5"
    >
      <!-- Background accent glow -->
      <div
        class="absolute inset-0 pointer-events-none"
        :style="{
          background: `radial-gradient(circle at 50% 40%, ${promo.glowColor} 0%, transparent 60%)`,
        }"
      />

      <!-- Ad banner label -->
      <div class="absolute top-5 left-1/2 -translate-x-1/2 z-10">
        <div class="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1 border border-white/10">
          <Icon name="mdi:bullhorn-variant" size="11" class="text-muted" />
          <span class="text-muted text-[9px] font-heading font-bold tracking-widest uppercase">
            Reklame · Jim betaler ikke
          </span>
        </div>
      </div>

      <!-- Content card -->
      <div
        class="relative max-w-md w-full rounded-3xl p-6 ad-card"
        :style="{
          background: `linear-gradient(155deg, ${promo.gradientFrom} 0%, rgba(20, 20, 28, 0.98) 55%)`,
          borderColor: promo.accentColor,
          borderWidth: '2px',
          borderStyle: 'solid',
          boxShadow: `0 0 60px ${promo.glowColor}, 0 20px 60px rgba(0,0,0,0.7)`,
        }"
        @click.stop
      >
        <!-- Jim mini-announcer at top -->
        <div class="flex items-start gap-3 mb-4">
          <div class="flex-shrink-0 w-12 h-12">
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
          <div class="flex-1 leading-tight">
            <p class="font-heading font-bold text-white text-sm">
              {{ headline || 'Reklame-pause, Lars.' }}
            </p>
            <p class="text-muted text-xs font-body italic mt-0.5">
              "{{ sub || 'Det tager 2 minutter. Maks 3.' }}"
            </p>
          </div>
        </div>

        <!-- Big icon + game name -->
        <div class="text-center pt-2 pb-4">
          <div class="relative inline-block mb-3">
            <div
              class="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center relative overflow-hidden ad-icon-float"
              :style="{
                background: `linear-gradient(135deg, ${promo.accentColor}44 0%, ${promo.accentColor}11 100%)`,
                border: `2px solid ${promo.accentColor}`,
              }"
            >
              <Icon :name="promo.icon" size="48" :style="{ color: promo.accentColor }" />
            </div>
            <div class="absolute -top-1 -right-1 text-3xl">{{ promo.emoji }}</div>
          </div>

          <p
            class="text-[10px] font-heading font-bold tracking-widest uppercase mb-1"
            :style="{ color: promo.accentColor }"
          >
            Minispil
          </p>
          <h2 class="font-heading font-bold text-white text-2xl mb-1">
            {{ promo.title }}
          </h2>
          <p class="text-muted text-sm font-body italic">
            {{ promo.tagline }}
          </p>
        </div>

        <!-- Ad copy -->
        <div class="glass rounded-xl p-4 mb-4 border border-white/5">
          <p class="text-white text-sm font-body leading-relaxed">
            {{ promo.adCopy }}
          </p>
        </div>

        <!-- Bullet points -->
        <div class="space-y-1.5 mb-5">
          <div
            v-for="(bullet, idx) in promo.bulletPoints"
            :key="idx"
            class="flex items-start gap-2 text-[13px] font-body text-muted"
          >
            <Icon
              name="mdi:check-circle"
              size="14"
              class="flex-shrink-0 mt-0.5"
              :style="{ color: promo.accentColor }"
            />
            <span>{{ bullet }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            class="flex-1 py-3.5 rounded-xl glass text-muted font-heading font-semibold text-sm uppercase tracking-wide transition-colors btn-press relative"
            :class="canSkip ? 'hover:text-white hover:bg-white/10' : 'opacity-50 cursor-not-allowed'"
            :disabled="!canSkip"
            @click="trySkip"
          >
            <span v-if="canSkip">Spil videre</span>
            <span v-else class="flex items-center justify-center gap-1">
              Spring over om
              <span class="font-mono tabular-nums" :style="{ color: promo.accentColor }">{{ countdown }}</span>
            </span>
          </button>
          <button
            class="flex-1 py-3.5 rounded-xl font-heading font-bold text-sm uppercase tracking-wider btn-press transition-all shadow-lg"
            :style="{
              backgroundColor: promo.accentColor,
              color: '#1A1A20',
              boxShadow: `0 0 22px ${promo.glowColor}`,
            }"
            @click="emit('play')"
          >
            <Icon name="mdi:play" size="16" class="inline -mt-0.5 mr-1" />
            Spil nu
          </button>
        </div>

        <p class="text-center text-[9px] text-muted/50 font-mono mt-3 uppercase tracking-widest">
          Du kan altid komme tilbage til Er Det Lars
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.interstitial-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.interstitial-leave-active {
  transition: all 0.3s ease-in;
}
.interstitial-enter-from {
  opacity: 0;
}
.interstitial-leave-to {
  opacity: 0;
}
.interstitial-enter-from .ad-card {
  transform: scale(0.85) translateY(30px);
}
.interstitial-leave-to .ad-card {
  transform: scale(0.95);
}

.ad-card {
  animation: ad-card-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes ad-card-in {
  from { transform: scale(0.85) translateY(30px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.ad-icon-float {
  animation: ad-icon-float 2.8s ease-in-out infinite;
}

@keyframes ad-icon-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-4px) rotate(-3deg); }
  75% { transform: translateY(-2px) rotate(3deg); }
}
</style>
