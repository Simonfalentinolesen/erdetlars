<script setup lang="ts">
/**
 * Full-screen "BREAKER" that pauses the swipe flow and showcases ALL 3 minigames.
 * Shown only at specific swipe milestones (caller decides — typically 4 and 20).
 *
 * Different from MinigameInterstitial (which promotes ONE game). This is the big
 * cross-promo: "here's everything Er Det Lars has to offer."
 */
import type { MinigamePromo } from '~/composables/useMinigamePromo'

const props = defineProps<{
  promos: MinigamePromo[] | null
  triggerLabel?: string  // e.g. "Efter 4 swipes" — cosmetic context for the user
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'play', path: string): void
}>()

// Ad countdown — prevents skipping instantly
const countdown = ref(3)
let countdownInterval: ReturnType<typeof setInterval> | null = null
const canSkip = computed(() => countdown.value <= 0)

// One of the promos bubbles up as the hover/highlighted one — rotates every 1.6s
const highlightIdx = ref(0)
let highlightInterval: ReturnType<typeof setInterval> | null = null

watch(() => props.promos, (v) => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (highlightInterval) clearInterval(highlightInterval)
  if (v && v.length > 0) {
    countdown.value = 3
    countdownInterval = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }, 1000)

    highlightIdx.value = 0
    highlightInterval = setInterval(() => {
      highlightIdx.value = (highlightIdx.value + 1) % (v?.length || 1)
    }, 1600)
  }
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (highlightInterval) clearInterval(highlightInterval)
})

function trySkip() {
  if (canSkip.value) emit('dismiss')
}

function launch(path: string) {
  emit('play', path)
}

// Rotating headlines — Jim-style
const HEADLINES = [
  'REKLAMEPAUSE',
  'JIM AFBRYDER',
  'LARS UNIVERSET',
  'TRE MINISPIL',
]
const headline = computed(() => {
  if (!props.promos || props.promos.length === 0) return HEADLINES[0]
  // Deterministic per render cycle (doesn't re-randomize on every tick)
  return HEADLINES[countdown.value % HEADLINES.length] ?? HEADLINES[0]
})

const SUBLINES = [
  'Tre patetiske spil. Alle er lige dårlige. Vælg én.',
  'Lars kan ikke klare dem alene. Han har brug for dig.',
  'Betalt af Jim. Godkendt af Lars. Spillet af dig.',
]
const subline = computed(() => SUBLINES[Math.min(countdown.value, SUBLINES.length - 1)] ?? SUBLINES[0])
</script>

<template>
  <Transition name="breaker">
    <div
      v-if="promos && promos.length > 0"
      class="fixed inset-0 z-[70] flex items-center justify-center p-4 breaker-root"
    >
      <!-- Dimmed + blurred backdrop -->
      <div class="absolute inset-0 bg-black/90 backdrop-blur-lg" />

      <!-- Rotating rainbow haze behind the card -->
      <div class="absolute inset-0 pointer-events-none breaker-haze" />

      <!-- TV-static scanlines for the ad-break feel -->
      <div class="absolute inset-0 pointer-events-none breaker-scanlines" />

      <!-- Content container -->
      <div class="relative max-w-md w-full rounded-3xl overflow-hidden breaker-card" @click.stop>
        <!-- Top ad label bar -->
        <div class="flex items-center justify-between px-4 py-2 bg-black/70 border-b border-white/10">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
            <span class="text-error text-[9px] font-heading font-black tracking-widest uppercase">
              LIVE · REKLAME
            </span>
          </div>
          <span class="text-muted text-[9px] font-mono tracking-wider">
            {{ triggerLabel || 'JIM INDKØBT DENNE PLADS' }}
          </span>
        </div>

        <!-- Main gradient panel -->
        <div class="px-5 py-5 breaker-body">
          <!-- Headline -->
          <div class="text-center mb-4">
            <Transition name="hdl" mode="out-in">
              <h2
                :key="headline"
                class="font-heading font-black text-white text-3xl tracking-tight mb-1 breaker-hdl"
              >
                {{ headline }}
              </h2>
            </Transition>
            <p class="text-accent text-xs font-body italic">
              "{{ subline }}"
            </p>
          </div>

          <!-- Jim announcer row -->
          <div class="flex items-center justify-center gap-2 mb-4">
            <div class="flex-shrink-0 w-10 h-10 jim-wobble">
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
            <div class="text-left leading-tight">
              <p class="text-white text-xs font-heading font-bold">Jim Lyngvild præsenterer:</p>
              <p class="text-muted text-[10px] font-body italic">3 minispil. 1 univers. 0 udgifter.</p>
            </div>
          </div>

          <!-- Minigame cards stack -->
          <div class="space-y-2.5 mb-4">
            <button
              v-for="(promo, idx) in promos"
              :key="promo.id"
              type="button"
              class="block w-full rounded-2xl p-3.5 relative overflow-hidden transition-all text-left breaker-game-card"
              :class="{ 'is-highlighted': idx === highlightIdx }"
              :style="{
                background: `linear-gradient(115deg, ${promo.gradientFrom} 0%, rgba(18, 18, 24, 0.95) 70%)`,
                borderColor: idx === highlightIdx ? promo.accentColor : `${promo.accentColor}55`,
                borderWidth: '1.5px',
                borderStyle: 'solid',
                boxShadow: idx === highlightIdx
                  ? `0 0 32px ${promo.glowColor}, inset 0 0 22px ${promo.glowColor}`
                  : `0 0 14px ${promo.glowColor}`,
              }"
              @click="launch(promo.path)"
            >
              <!-- Accent corner glow -->
              <div
                class="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-3xl pointer-events-none opacity-60"
                :style="{ backgroundColor: promo.accentColor }"
              />

              <div class="flex items-center gap-3 relative">
                <!-- Icon block -->
                <div
                  class="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  :style="{
                    background: `linear-gradient(135deg, ${promo.accentColor}55 0%, ${promo.accentColor}11 100%)`,
                    border: `1.5px solid ${promo.accentColor}`,
                  }"
                >
                  <Icon :name="promo.icon" size="30" :style="{ color: promo.accentColor }" />
                  <span class="absolute -top-0.5 -right-0.5 text-base">{{ promo.emoji }}</span>
                </div>

                <!-- Title + tagline -->
                <div class="flex-1 min-w-0 leading-tight">
                  <p
                    class="text-[8px] font-heading font-black tracking-widest uppercase mb-0.5"
                    :style="{ color: promo.accentColor }"
                  >
                    Minispil #{{ idx + 1 }}
                  </p>
                  <p class="font-heading font-bold text-white text-base truncate">
                    {{ promo.title }}
                  </p>
                  <p class="text-muted text-[11px] font-body truncate italic">
                    "{{ promo.tagline }}"
                  </p>
                </div>

                <!-- Play arrow -->
                <div
                  class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                  :style="{
                    backgroundColor: promo.accentColor,
                    color: '#1A1A20',
                  }"
                >
                  <Icon name="mdi:play" size="18" />
                </div>
              </div>
            </button>
          </div>

          <!-- Skip / continue row -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="flex-1 py-3 rounded-xl font-heading font-bold text-sm uppercase tracking-wider btn-press transition-all"
              :class="canSkip
                ? 'bg-accent text-primary hover:bg-accent-light shadow-glow'
                : 'bg-white/5 text-muted cursor-not-allowed border border-white/10'"
              :disabled="!canSkip"
              @click="trySkip"
            >
              <span v-if="canSkip" class="flex items-center justify-center gap-1">
                <Icon name="mdi:play-speed" size="14" />
                Videre med Er Det Lars
              </span>
              <span v-else class="flex items-center justify-center gap-1.5">
                <Icon name="mdi:timer-sand" size="14" />
                Spring over om <span class="font-mono tabular-nums text-accent">{{ countdown }}</span>
              </span>
            </button>
          </div>

          <p class="text-center text-[8px] text-muted/50 font-mono mt-3 uppercase tracking-widest">
            Sponsoreret af Lars' respekt · Du er tilbage om lidt
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.breaker-root {
  isolation: isolate;
}

/* Enter/leave */
.breaker-enter-active {
  transition: all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.breaker-leave-active {
  transition: all 0.3s ease-in;
}
.breaker-enter-from { opacity: 0; }
.breaker-leave-to { opacity: 0; }
.breaker-enter-from .breaker-card {
  transform: scale(0.8) translateY(40px) rotate(-2deg);
}
.breaker-leave-to .breaker-card {
  transform: scale(0.95);
}

/* Card shell */
.breaker-card {
  background: linear-gradient(165deg, #1A1A24 0%, #0F0F17 100%);
  border: 2px solid rgba(245, 166, 35, 0.4);
  box-shadow:
    0 0 80px rgba(232, 67, 147, 0.25),
    0 20px 70px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: breaker-card-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes breaker-card-in {
  from { transform: scale(0.8) translateY(40px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.breaker-body {
  position: relative;
}

/* Headline neon shimmer */
.breaker-hdl {
  background: linear-gradient(90deg, #F5A623, #E84393, #00D68F, #F5A623);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: hdl-shimmer 3s linear infinite;
  text-shadow: 0 0 30px rgba(232, 67, 147, 0.45);
}

@keyframes hdl-shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

.hdl-enter-active, .hdl-leave-active { transition: all 0.25s ease; }
.hdl-enter-from { opacity: 0; transform: translateY(6px); }
.hdl-leave-to { opacity: 0; transform: translateY(-6px); }

/* Haze behind card */
.breaker-haze {
  background:
    radial-gradient(circle at 25% 20%, rgba(232, 67, 147, 0.35), transparent 45%),
    radial-gradient(circle at 75% 30%, rgba(245, 166, 35, 0.35), transparent 45%),
    radial-gradient(circle at 50% 85%, rgba(0, 229, 255, 0.3), transparent 50%);
  filter: blur(8px);
  animation: haze-drift 7s ease-in-out infinite, haze-hue 12s linear infinite;
}

@keyframes haze-drift {
  0%, 100% { transform: scale(1) translate(0, 0); }
  50% { transform: scale(1.08) translate(4px, -8px); }
}

@keyframes haze-hue {
  0%, 100% { filter: blur(8px) hue-rotate(0deg); }
  50% { filter: blur(8px) hue-rotate(180deg); }
}

/* Scanlines */
.breaker-scanlines {
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.015) 0,
    rgba(255, 255, 255, 0.015) 1px,
    transparent 1px,
    transparent 3px
  );
  mix-blend-mode: overlay;
  opacity: 0.8;
  animation: scanlines-flicker 0.12s steps(2) infinite;
}

@keyframes scanlines-flicker {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.95; }
}

/* Jim avatar wobble */
.jim-wobble {
  animation: jim-wobble 2s ease-in-out infinite;
}
@keyframes jim-wobble {
  0%, 100% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(-6deg) scale(1.05); }
  75% { transform: rotate(6deg) scale(1.05); }
}

/* Game cards — floating / highlighted state */
.breaker-game-card {
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease;
}
.breaker-game-card:hover {
  transform: scale(1.02) translateY(-2px);
}
.breaker-game-card.is-highlighted {
  transform: scale(1.035) translateY(-2px);
}

/* Staggered card-in entrance */
.breaker-game-card {
  animation: card-slide-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
.breaker-game-card:nth-child(1) { animation-delay: 0.15s; }
.breaker-game-card:nth-child(2) { animation-delay: 0.3s; }
.breaker-game-card:nth-child(3) { animation-delay: 0.45s; }

@keyframes card-slide-in {
  from { opacity: 0; transform: translateX(40px) scale(0.9); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
</style>
