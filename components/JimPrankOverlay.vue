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

// Banner vises for alle visuelle pranks der ellers ikke ville være åbenlyse
// (upside-down, button-swap, blur). Dalmatian har sin egen hund, rant har sin egen toast.
const showJimBanner = computed(() => {
  const t = props.prank?.type
  return t === 'upside-down' || t === 'button-swap' || t === 'blur'
})

const prankLabel = computed(() => {
  switch (props.prank?.type) {
    case 'upside-down': return 'PÅ HOVEDET!'
    case 'button-swap': return 'KNAPPER BYTTET!'
    case 'blur': return 'UKLART BILLEDE!'
    default: return 'PRANK!'
  }
})

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
  <!-- JIM PRANKER banner — stor, tydelig, centreret øverst.
       Vises for visuelle pranks hvor spilleren ellers kunne tvivle på om det er en fejl
       i spillet (upside-down, button-swap, blur). Pulserende rød/pink med Jim-avatar. -->
  <div
    v-show="showJimBanner"
    class="fixed top-16 left-1/2 -translate-x-1/2 z-[95] pointer-events-none transition-all duration-300"
    :class="showJimBanner ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'"
  >
      <div class="jim-prank-banner">
        <!-- Jim-avatar med shake -->
        <div class="jim-banner-avatar">
          <svg viewBox="0 0 48 52" class="w-full h-full" fill="none">
            <circle cx="24" cy="16" r="14" fill="#E0B89A"/>
            <path d="M14 12 Q24 0 34 12" stroke="#9E3030" stroke-width="1.5" fill="none"/>
            <circle cx="24" cy="4" r="2" fill="#9E3030"/>
            <circle cx="20" cy="15" r="2" fill="#FF4757"/>
            <circle cx="28" cy="15" r="2" fill="#FF4757"/>
            <rect x="14" y="28" width="20" height="18" rx="3" fill="#F5F0E8"/>
            <circle cx="19" cy="34" r="2.5" fill="#1A1A1A"/>
            <circle cx="29" cy="38" r="3" fill="#1A1A1A"/>
            <!-- Peg-finger -->
            <path d="M34 24 L42 14 L43 12" stroke="#E0B89A" stroke-width="3" stroke-linecap="round"/>
            <circle cx="43" cy="11" r="2" fill="#E0B89A"/>
          </svg>
        </div>
        <div class="flex flex-col items-start gap-0.5">
          <span class="jim-banner-label">
            JIM PRANKER!
          </span>
          <span class="jim-banner-sublabel">
            {{ prankLabel }}
          </span>
        </div>
        <!-- Grinende emoji -->
        <div class="text-2xl jim-banner-emoji">😈</div>
      </div>
  </div>

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

  <!-- Jim rant — top-toast, ikke blokerende. Auto-lukker via prank.duration.
       Bruger slider-ind fra toppen så spilleren kan fortsætte med at swipe.
       Klik lukker, men er valgfrit. -->
  <Transition name="jim-rant-toast">
    <div
      v-if="isRant"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[85] max-w-sm w-[calc(100%-2rem)] pointer-events-none"
    >
      <div
        class="relative glass border-2 border-error/40 rounded-2xl p-3 pr-4 flex items-start gap-3 shadow-xl pointer-events-auto cursor-pointer"
        role="button"
        tabindex="0"
        aria-label="Tryk for at lukke"
        @click="dismissRant"
        @keydown.enter="dismissRant"
        @keydown.space.prevent="dismissRant"
      >
        <!-- Lille Jim-ikon med shake -->
        <div class="w-12 h-12 flex-shrink-0 jim-shake">
          <svg viewBox="0 0 48 52" class="w-full h-full" fill="none">
            <circle cx="24" cy="16" r="14" fill="#E0B89A"/>
            <path d="M14 12 Q24 0 34 12" stroke="#9E3030" stroke-width="1.5" fill="none"/>
            <circle cx="24" cy="4" r="2" fill="#9E3030"/>
            <circle cx="20" cy="15" r="2" fill="#FF4757"/>
            <circle cx="28" cy="15" r="2" fill="#FF4757"/>
            <rect x="14" y="28" width="20" height="18" rx="3" fill="#F5F0E8"/>
            <circle cx="19" cy="34" r="2.5" fill="#1A1A1A"/>
            <circle cx="29" cy="38" r="3" fill="#1A1A1A"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-error text-[9px] font-heading font-bold uppercase tracking-widest mb-0.5">
            Jim er sur
          </p>
          <p class="text-white font-body text-sm leading-snug">
            "{{ quote }}"
          </p>
          <!-- Subtil countdown-bar i bunden -->
          <div class="mt-2 h-0.5 rounded-full bg-white/10 overflow-hidden">
            <div
              class="h-full bg-error transition-[width] duration-75 ease-linear"
              :style="{ width: rantProgress + '%' }"
            />
          </div>
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

.jim-rant-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jim-rant-leave-active { transition: all 0.25s ease-in; }
.jim-rant-enter-from { opacity: 0; }
.jim-rant-leave-to { opacity: 0; }
.jim-rant-enter-from > div { transform: scale(0.7); }

/* Jim-rant top-toast: glider ned fra toppen */
.jim-rant-toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.jim-rant-toast-leave-active {
  transition: all 0.25s ease-in;
}
.jim-rant-toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -40px);
}
.jim-rant-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.jim-shake {
  animation: jim-angry-shake 0.3s ease-in-out infinite;
}

@keyframes jim-angry-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-2px) rotate(-1deg); }
  75% { transform: translateX(2px) rotate(1deg); }
}

/* ==================== JIM PRANKER-banner ==================== */
/* Tydelig rød/pink banner øverst der viser at det er Jim der driller,
   ikke en fejl i spillet. Shake + pulse så den fanger opmærksomheden. */
.jim-prank-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 10px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, #E84393 0%, #F5A623 100%);
  box-shadow:
    0 8px 24px rgba(232, 67, 147, 0.55),
    0 0 40px rgba(232, 67, 147, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.2);
  animation: jim-banner-wiggle 0.4s ease-in-out infinite, jim-banner-glow 1.2s ease-in-out infinite;
}
.jim-banner-avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  animation: jim-banner-shake 0.3s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
.jim-banner-label {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 900;
  font-size: 14px;
  color: #1A1A20;
  letter-spacing: 0.1em;
  line-height: 1;
}
.jim-banner-sublabel {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 10px;
  color: rgba(26, 26, 32, 0.8);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  line-height: 1;
}
.jim-banner-emoji {
  animation: jim-banner-shake 0.25s ease-in-out infinite;
}

@keyframes jim-banner-wiggle {
  0%, 100% { transform: translateX(0) rotate(-1deg); }
  50% { transform: translateX(0) rotate(1deg); }
}
@keyframes jim-banner-shake {
  0%, 100% { transform: translateX(0) rotate(0deg) scale(1); }
  25% { transform: translateX(-2px) rotate(-3deg) scale(1.05); }
  75% { transform: translateX(2px) rotate(3deg) scale(1.05); }
}
@keyframes jim-banner-glow {
  0%, 100% { box-shadow: 0 8px 24px rgba(232, 67, 147, 0.55), 0 0 40px rgba(232, 67, 147, 0.4); }
  50% { box-shadow: 0 8px 32px rgba(232, 67, 147, 0.75), 0 0 70px rgba(232, 67, 147, 0.6); }
}

.jim-prank-banner-enter-active { transition: opacity 0.35s ease-out, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jim-prank-banner-leave-active { transition: opacity 0.25s ease-in, transform 0.25s ease-in; }
.jim-prank-banner-enter-from {
  opacity: 0;
  transform: translate(-50%, -30px) scale(0.7);
}
.jim-prank-banner-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px) scale(0.9);
}
</style>
