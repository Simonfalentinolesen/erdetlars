<script setup lang="ts">
import type { MinigamePromo } from '~/composables/useMinigamePromo'

const props = defineProps<{
  promo: MinigamePromo | null
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'play'): void
}>()

// Auto-dismiss after 7 seconds if user doesn't interact
let autoTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.promo, (v) => {
  if (autoTimer) clearTimeout(autoTimer)
  if (v) {
    autoTimer = setTimeout(() => emit('dismiss'), 7000)
  }
})

onUnmounted(() => {
  if (autoTimer) clearTimeout(autoTimer)
})
</script>

<template>
  <Transition name="teaser">
    <div
      v-if="promo"
      class="fixed bottom-24 inset-x-3 z-40 flex justify-center pointer-events-none"
    >
      <div
        class="glass rounded-2xl pr-2 pl-3 py-2.5 flex items-center gap-2.5 max-w-sm w-full pointer-events-auto shadow-2xl teaser-card"
        :style="{
          borderColor: promo.accentColor,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          boxShadow: `0 0 24px ${promo.glowColor}, 0 8px 32px rgba(0,0,0,0.4)`,
          background: `linear-gradient(135deg, ${promo.gradientFrom} 0%, rgba(26, 26, 32, 0.95) 60%)`,
        }"
      >
        <!-- Icon circle -->
        <div
          class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center relative overflow-hidden teaser-icon"
          :style="{
            background: `linear-gradient(135deg, ${promo.accentColor}33 0%, ${promo.accentColor}11 100%)`,
            border: `1.5px solid ${promo.accentColor}80`,
          }"
        >
          <Icon :name="promo.icon" size="22" :style="{ color: promo.accentColor }" />
          <!-- "NEW" pulsing dot -->
          <div
            class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
            :style="{ backgroundColor: promo.accentColor }"
          />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0 leading-tight">
          <div class="flex items-center gap-1 mb-0.5">
            <span
              class="text-[8px] font-heading font-bold tracking-widest uppercase"
              :style="{ color: promo.accentColor }"
            >
              <Icon name="mdi:gamepad-variant" size="9" class="inline -mt-0.5" />
              Minispil
            </span>
          </div>
          <p class="font-heading font-bold text-white text-[13px] truncate">
            {{ promo.title }}
          </p>
          <p class="text-muted text-[10px] font-body truncate">
            {{ promo.tagline }}
          </p>
        </div>

        <!-- CTA -->
        <button
          class="flex-shrink-0 px-3 py-2 rounded-lg font-heading font-bold text-[11px] uppercase tracking-wide btn-press transition-all"
          :style="{
            backgroundColor: promo.accentColor,
            color: '#1A1A20',
          }"
          @click="emit('play')"
        >
          Prøv
        </button>

        <!-- Close -->
        <button
          class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors"
          @click="emit('dismiss')"
        >
          <Icon name="mdi:close" size="12" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.teaser-enter-active {
  transition: all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.teaser-leave-active {
  transition: all 0.25s ease-in;
}
.teaser-enter-from {
  opacity: 0;
  transform: translateY(40px) scale(0.92);
}
.teaser-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.teaser-card {
  animation: teaser-shimmer 3s ease-in-out infinite;
}

@keyframes teaser-shimmer {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.08); }
}

.teaser-icon {
  animation: teaser-icon-bob 2.2s ease-in-out infinite;
}

@keyframes teaser-icon-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-2px) rotate(-5deg); }
}
</style>
