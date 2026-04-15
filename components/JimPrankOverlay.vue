<script setup lang="ts">
import type { PrankDef } from '~/composables/useJimPranks'

const props = defineProps<{
  prank: PrankDef | null
  quote: string
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const isDalmatian = computed(() => props.prank?.type === 'dalmatian')
const isRant = computed(() => props.prank?.type === 'jim-rant')

// Rant-countdown — visuel ring, så brugeren ser at det slutter om lidt
// Synkroniseret med prank.duration i useJimPranks.ts (starter ved 100%, drænes til 0)
const rantProgress = ref(100)
let rantInterval: ReturnType<typeof setInterval> | null = null

watch(() => props.prank, (next) => {
  if (rantInterval) { clearInterval(rantInterval); rantInterval = null }
  if (next?.type === 'jim-rant') {
    rantProgress.value = 100
    const startedAt = Date.now()
    const duration = next.duration
    rantInterval = setInterval(() => {
      const elapsed = Date.now() - startedAt
      rantProgress.value = Math.max(0, 100 - (elapsed / duration) * 100)
      if (elapsed >= duration && rantInterval) {
        clearInterval(rantInterval)
        rantInterval = null
      }
    }, 50)
  }
})

onUnmounted(() => {
  if (rantInterval) clearInterval(rantInterval)
})

function dismissRant() {
  emit('dismiss')
}
</script>

<template>
  <!-- Dalmatian runs across screen -->
  <Transition name="dalmatian-run">
    <div
      v-if="isDalmatian"
      class="fixed inset-x-0 top-[40%] z-[80] pointer-events-none"
    >
      <div class="dalmatian-container">
        <svg viewBox="0 0 80 50" class="w-20 h-12" fill="none">
          <!-- Body -->
          <ellipse cx="40" cy="30" rx="22" ry="12" fill="#F5F0E8"/>
          <!-- Spots -->
          <circle cx="30" cy="26" r="3" fill="#1A1A1A"/>
          <circle cx="44" cy="28" r="4" fill="#1A1A1A"/>
          <circle cx="50" cy="33" r="2.5" fill="#1A1A1A"/>
          <circle cx="36" cy="34" r="2" fill="#1A1A1A"/>
          <circle cx="26" cy="32" r="2" fill="#1A1A1A"/>
          <!-- Head -->
          <ellipse cx="62" cy="25" rx="9" ry="7" fill="#F5F0E8"/>
          <circle cx="56" cy="26" r="2" fill="#1A1A1A"/>
          <!-- Ear -->
          <ellipse cx="66" cy="20" rx="3" ry="5" fill="#1A1A1A"/>
          <!-- Eye -->
          <circle cx="65" cy="24" r="1" fill="#1A1A1A"/>
          <!-- Tail -->
          <path d="M 18 28 Q 12 20, 8 22" stroke="#F5F0E8" stroke-width="4" stroke-linecap="round" fill="none"/>
          <!-- Legs -->
          <rect x="26" y="38" width="4" height="8" rx="2" fill="#F5F0E8"/>
          <rect x="34" y="38" width="4" height="8" rx="2" fill="#F5F0E8"/>
          <rect x="44" y="38" width="4" height="8" rx="2" fill="#F5F0E8"/>
          <rect x="52" y="38" width="4" height="8" rx="2" fill="#F5F0E8"/>
        </svg>
        <p class="text-accent text-xs font-heading font-bold mt-1 ml-2 bark-bubble">WOOF!</p>
      </div>
    </div>
  </Transition>

  <!-- Jim rant fullscreen — tap anywhere OR click X to dismiss -->
  <Transition name="jim-rant">
    <div
      v-if="isRant"
      class="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-pointer"
      role="button"
      tabindex="0"
      aria-label="Tryk for at lukke Jim's vrede"
      @click="dismissRant"
      @keydown.enter="dismissRant"
      @keydown.space.prevent="dismissRant"
    >
      <div class="max-w-sm mx-6 text-center relative">
        <!-- Close button, top-right -->
        <button
          type="button"
          class="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-error/90 hover:bg-error text-white flex items-center justify-center shadow-lg z-10"
          aria-label="Luk"
          @click.stop="dismissRant"
        >
          <Icon name="mdi:close" size="18" />
        </button>

        <!-- Big Jim SVG shaking -->
        <div class="w-24 h-24 mx-auto mb-3 jim-shake">
          <svg viewBox="0 0 48 52" class="w-full h-full" fill="none">
            <circle cx="24" cy="16" r="14" fill="#E0B89A"/>
            <path d="M14 12 Q24 0 34 12" stroke="#9E3030" stroke-width="1.5" fill="none"/>
            <path d="M16 10 Q24 2 32 10" stroke="#9E3030" stroke-width="1" fill="none"/>
            <circle cx="24" cy="4" r="2" fill="#9E3030"/>
            <circle cx="20" cy="15" r="2" fill="#FF4757"/>
            <circle cx="28" cy="15" r="2" fill="#FF4757"/>
            <path d="M22 20 L26 20" stroke="#B08070" stroke-width="1" stroke-linecap="round"/>
            <rect x="14" y="28" width="20" height="18" rx="3" fill="#F5F0E8"/>
            <circle cx="19" cy="34" r="2.5" fill="#1A1A1A"/>
            <circle cx="29" cy="38" r="3" fill="#1A1A1A"/>
            <circle cx="24" cy="32" r="1.5" fill="#1A1A1A"/>
            <path d="M34 28 L42 14 L43 12" stroke="#E0B89A" stroke-width="3" stroke-linecap="round"/>
            <circle cx="43" cy="11" r="2" fill="#E0B89A"/>
          </svg>
        </div>
        <div class="glass rounded-2xl p-5 border-2 border-error/40">
          <p class="font-heading font-bold text-error text-xs uppercase tracking-widest mb-2">
            Jim's vrede
          </p>
          <p class="text-white font-heading font-bold text-lg leading-snug">
            "{{ quote }}"
          </p>

          <!-- Countdown bar — visuelt aftegner når overlayet auto-lukker -->
          <div class="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              class="h-full bg-error transition-[width] duration-75 ease-linear"
              :style="{ width: rantProgress + '%' }"
            />
          </div>
          <p class="text-muted/70 text-[10px] font-mono mt-2 uppercase tracking-widest">
            Tryk hvor som helst for at lukke
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dalmatian-container {
  position: absolute;
  left: -120px;
  animation: dalmatian-gallop 1.8s ease-in-out forwards;
}

@keyframes dalmatian-gallop {
  0% { transform: translateX(0) translateY(0) rotate(0deg); }
  25% { transform: translateX(25vw) translateY(-10px) rotate(-2deg); }
  50% { transform: translateX(50vw) translateY(0) rotate(0deg); }
  75% { transform: translateX(75vw) translateY(-10px) rotate(-2deg); }
  100% { transform: translateX(calc(100vw + 120px)) translateY(0) rotate(0); }
}

.bark-bubble {
  background: rgba(245, 166, 35, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-block;
  border: 1px solid rgba(245, 166, 35, 0.5);
}

.dalmatian-run-enter-active,
.dalmatian-run-leave-active {
  transition: opacity 0.2s ease;
}
.dalmatian-run-enter-from,
.dalmatian-run-leave-to { opacity: 0; }

.jim-rant-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.jim-rant-leave-active {
  transition: all 0.25s ease-in;
}
.jim-rant-enter-from {
  opacity: 0;
}
.jim-rant-leave-to {
  opacity: 0;
}
.jim-rant-enter-from > div { transform: scale(0.7); }

.jim-shake {
  animation: jim-angry-shake 0.3s ease-in-out infinite;
}

@keyframes jim-angry-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-2px) rotate(-1deg); }
  75% { transform: translateX(2px) rotate(1deg); }
}
</style>
