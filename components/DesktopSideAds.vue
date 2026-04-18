<script setup lang="ts">
/**
 * Desktop side-panel reklamer.
 * Vises KUN på desktop (viewport >= 1280px) ude i siderne af spillet.
 * Fader ind ved bestemte swipe-milepæle, blir i 7 sekunder, fader ud selv.
 * Ingen klik nødvendig. Klik åbner dog minispillet direkte.
 *
 * Erstatter den gamle MinigameBreaker fullscreen-takeover. Brugeren bliver
 * ikke længere afbrudt.
 */
import type { MinigamePromo } from '~/composables/useMinigamePromo'

const props = defineProps<{
  promos: MinigamePromo[] | null
  triggerLabel?: string
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
  (e: 'play', path: string): void
}>()

// Auto-dismiss efter X sekunder. Genindlæser timeren hvis promos skifter.
const DISMISS_AFTER_MS = 7000
let dismissTimer: ReturnType<typeof setTimeout> | null = null

// Viewport-gate. Vi gemmer ads helt på mobil (<1280px) så hoved-kortet
// får al pladsen.
const isDesktop = ref(false)
function checkDesktop() {
  if (typeof window === 'undefined') return
  isDesktop.value = window.innerWidth >= 1280
}

onMounted(() => {
  checkDesktop()
  window.addEventListener('resize', checkDesktop)
})
onUnmounted(() => {
  window.removeEventListener('resize', checkDesktop)
  if (dismissTimer) clearTimeout(dismissTimer)
})

// Når nye promos kommer ind, start auto-dismiss timer
watch(() => props.promos, (val) => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (val && val.length > 0) {
    dismissTimer = setTimeout(() => {
      emit('dismiss')
      dismissTimer = null
    }, DISMISS_AFTER_MS)
  }
})

// Fordel de 3 minispil på venstre + højre panel.
// Venstre: 1 stort fremhævet. Højre: 2 små.
const leftPromo = computed(() => props.promos?.[0] ?? null)
const rightPromos = computed(() => props.promos?.slice(1) ?? [])

// Mobil-fallback: hvis vi ikke er desktop, auto-dismiss straks
// så promos ikke sidder og venter i state.
watch(() => [props.promos, isDesktop.value], ([promos, desk]) => {
  if (promos && Array.isArray(promos) && promos.length > 0 && !desk) {
    // På mobil: spring over reklamen helt (ingen visning, ingen afbrydelse)
    setTimeout(() => emit('dismiss'), 50)
  }
})

function clickPromo(path: string) {
  emit('play', path)
}
</script>

<template>
  <!-- Venstre side-panel: fremhævet minispil -->
  <Transition name="ad-slide-left">
    <aside
      v-if="isDesktop && leftPromo"
      class="fixed left-4 top-1/2 -translate-y-1/2 z-30 w-60 pointer-events-auto"
    >
      <button
        type="button"
        class="group w-full rounded-2xl overflow-hidden text-left transition-all relative"
        :style="{
          background: `linear-gradient(135deg, ${leftPromo.gradientFrom} 0%, rgba(18, 18, 24, 0.96) 75%)`,
          borderColor: `${leftPromo.accentColor}99`,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          boxShadow: `0 0 28px ${leftPromo.glowColor}, 0 8px 24px rgba(0,0,0,0.5)`,
        }"
        @click="clickPromo(leftPromo.path)"
      >
        <!-- Top ad label -->
        <div class="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 border-b border-white/5">
          <div class="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
          <span class="text-error text-[9px] font-heading font-black tracking-widest uppercase">
            REKLAME
          </span>
          <span class="ml-auto text-muted text-[9px] font-mono">
            {{ triggerLabel || 'JIM BETALTE' }}
          </span>
        </div>

        <div class="px-4 py-3.5 relative">
          <div
            class="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-3xl pointer-events-none opacity-50"
            :style="{ backgroundColor: leftPromo.accentColor }"
          />

          <div class="flex items-center gap-2.5 mb-2 relative">
            <div
              class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center relative overflow-hidden"
              :style="{
                background: `linear-gradient(135deg, ${leftPromo.accentColor}55 0%, ${leftPromo.accentColor}11 100%)`,
                border: `1.5px solid ${leftPromo.accentColor}`,
              }"
            >
              <Icon :name="leftPromo.icon" size="22" :style="{ color: leftPromo.accentColor }" />
              <span class="absolute -top-0.5 -right-0.5 text-xs">{{ leftPromo.emoji }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="text-[7px] font-heading font-black tracking-widest uppercase mb-0.5"
                :style="{ color: leftPromo.accentColor }"
              >
                Minispil
              </p>
              <p class="font-heading font-bold text-white text-sm truncate">
                {{ leftPromo.title }}
              </p>
            </div>
          </div>
          <p class="text-muted/80 text-[11px] font-body italic leading-snug mb-2.5">
            "{{ leftPromo.tagline }}"
          </p>
          <div
            class="inline-flex items-center gap-1.5 rounded-full py-1 px-3 text-[10px] font-heading font-bold group-hover:scale-105 transition-transform"
            :style="{
              backgroundColor: leftPromo.accentColor,
              color: '#1A1A20',
            }"
          >
            <Icon name="mdi:play" size="12" />
            SPIL NU
          </div>
        </div>
      </button>
      <!-- Lukkeknap-hint (ikke krævet — auto-dismiss) -->
      <button
        type="button"
        class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white/70 hover:text-white flex items-center justify-center"
        aria-label="Luk reklame"
        @click.stop="emit('dismiss')"
      >
        <Icon name="mdi:close" size="12" />
      </button>
    </aside>
  </Transition>

  <!-- Højre side-panel: 2 mindre minispil (stakket) -->
  <Transition name="ad-slide-right">
    <aside
      v-if="isDesktop && rightPromos.length > 0"
      class="fixed right-4 top-1/2 -translate-y-1/2 z-30 w-56 space-y-2 pointer-events-auto"
    >
      <button
        v-for="(promo, idx) in rightPromos"
        :key="promo.id"
        type="button"
        class="group w-full rounded-xl overflow-hidden text-left transition-all block ad-stagger"
        :style="{
          background: `linear-gradient(135deg, ${promo.gradientFrom} 0%, rgba(18, 18, 24, 0.96) 70%)`,
          borderColor: `${promo.accentColor}80`,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          boxShadow: `0 0 18px ${promo.glowColor}`,
          animationDelay: `${(idx + 1) * 0.12}s`,
        }"
        @click="clickPromo(promo.path)"
      >
        <div class="px-3 py-2.5 relative">
          <div
            class="absolute -top-4 -right-4 w-14 h-14 rounded-full blur-2xl pointer-events-none opacity-50"
            :style="{ backgroundColor: promo.accentColor }"
          />
          <div class="flex items-center gap-2 relative">
            <div
              class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center relative overflow-hidden"
              :style="{
                background: `linear-gradient(135deg, ${promo.accentColor}55 0%, ${promo.accentColor}11 100%)`,
                border: `1.5px solid ${promo.accentColor}`,
              }"
            >
              <Icon :name="promo.icon" size="18" :style="{ color: promo.accentColor }" />
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="text-[7px] font-heading font-black tracking-widest uppercase"
                :style="{ color: promo.accentColor }"
              >
                Minispil
              </p>
              <p class="font-heading font-bold text-white text-xs truncate">
                {{ promo.title }}
              </p>
            </div>
            <Icon name="mdi:arrow-right" size="14" class="text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </button>
    </aside>
  </Transition>
</template>

<style scoped>
.ad-slide-left-enter-active,
.ad-slide-left-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ad-slide-left-enter-from {
  opacity: 0;
  transform: translate(-60px, -50%);
}
.ad-slide-left-leave-to {
  opacity: 0;
  transform: translate(-30px, -50%);
  transition: all 0.35s ease-in;
}

.ad-slide-right-enter-active,
.ad-slide-right-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ad-slide-right-enter-from {
  opacity: 0;
  transform: translate(60px, -50%);
}
.ad-slide-right-leave-to {
  opacity: 0;
  transform: translate(30px, -50%);
  transition: all 0.35s ease-in;
}

/* Staggered in for the 2 small cards */
.ad-stagger {
  animation: ad-stagger 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
@keyframes ad-stagger {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
