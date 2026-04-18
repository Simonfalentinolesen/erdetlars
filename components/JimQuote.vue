<script setup lang="ts">
const props = withDefaults(defineProps<{
  quote: string
  mode?: 'toast' | 'popup' | 'inline'
  show?: boolean
}>(), {
  mode: 'toast',
  show: true,
})

const emit = defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <Transition :name="mode === 'popup' ? 'jim-popup' : mode === 'toast' ? 'jim-toast' : 'jim-inline'">
    <div
      v-if="show"
      :class="[
        mode === 'popup' && 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm',
        mode === 'toast' && 'fixed bottom-52 md:bottom-56 left-4 right-4 z-50 flex justify-center pointer-events-none',
        mode === 'inline' && 'w-full',
      ]"
      @click="mode === 'popup' ? emit('dismiss') : undefined"
    >
      <div
        class="flex items-start gap-3 max-w-md rounded-2xl p-4 pointer-events-auto"
        :class="[
          mode === 'popup' ? 'glass border border-accent/20 shadow-glow p-6' : '',
          mode === 'toast' ? 'glass border border-accent/20 shadow-lg' : '',
          mode === 'inline' ? 'bg-surface/60 border border-white/5' : '',
        ]"
        @click.stop
      >
        <!-- Jim silhouette -->
        <div class="flex-shrink-0 w-12 h-12 relative">
          <svg viewBox="0 0 48 52" class="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Body (dalmatian pattern shirt) -->
            <rect x="14" y="24" width="20" height="20" rx="3" fill="#F5F0E8"/>
            <!-- Dalmatian spots -->
            <circle cx="18" cy="28" r="2.5" fill="#1A1A1A"/>
            <circle cx="25" cy="32" r="3" fill="#1A1A1A"/>
            <circle cx="30" cy="27" r="2" fill="#1A1A1A"/>
            <circle cx="20" cy="36" r="2.5" fill="#1A1A1A"/>
            <circle cx="28" cy="39" r="2" fill="#1A1A1A"/>
            <ellipse cx="16" cy="34" rx="1.5" ry="2" fill="#1A1A1A"/>
            <!-- V-neck detail -->
            <path d="M20 24 L24 30 L28 24" stroke="#D0C8B8" stroke-width="0.8" fill="none"/>
            <!-- Neck -->
            <rect x="20" y="20" width="8" height="6" fill="#E0B89A"/>
            <!-- Head (BALD - smooth, skin-toned) -->
            <circle cx="24" cy="13" r="10" fill="#E0B89A"/>
            <!-- Scalp tattoo - reddish viking/celtic knot pattern -->
            <!-- Main arch across forehead -->
            <path d="M16 10 C17 5, 20 3, 24 3 C28 3, 31 5, 32 10" stroke="#9E3030" stroke-width="1.2" fill="none"/>
            <!-- Inner swirl patterns -->
            <path d="M18 8 C19 5, 21 4, 24 4 C27 4, 29 5, 30 8" stroke="#9E3030" stroke-width="0.8" fill="none"/>
            <!-- Celtic knot left -->
            <path d="M17 9 Q19 6, 21 8 Q19 10, 17 9" stroke="#9E3030" stroke-width="0.7" fill="none"/>
            <!-- Celtic knot right -->
            <path d="M31 9 Q29 6, 27 8 Q29 10, 31 9" stroke="#9E3030" stroke-width="0.7" fill="none"/>
            <!-- Heart/diamond shape center top -->
            <path d="M23 4 L24 3 L25 4 L24 6 Z" fill="#9E3030" opacity="0.7"/>
            <!-- Vine/scroll details -->
            <path d="M19 7 C20 5.5, 22 5, 24 5.5" stroke="#9E3030" stroke-width="0.5" fill="none"/>
            <path d="M29 7 C28 5.5, 26 5, 24 5.5" stroke="#9E3030" stroke-width="0.5" fill="none"/>
            <!-- NO beard - clean shaven, strong jaw -->
            <path d="M18 17 Q24 20, 30 17" stroke="#C9A080" stroke-width="0.5" fill="none"/>
            <!-- Piercing ice-blue eyes -->
            <ellipse cx="20.5" cy="12.5" rx="2" ry="1.5" fill="white"/>
            <ellipse cx="27.5" cy="12.5" rx="2" ry="1.5" fill="white"/>
            <circle cx="20.5" cy="12.5" r="1.2" fill="#6AACDB"/>
            <circle cx="27.5" cy="12.5" r="1.2" fill="#6AACDB"/>
            <circle cx="20.5" cy="12.5" r="0.5" fill="#1A2634"/>
            <circle cx="27.5" cy="12.5" r="0.5" fill="#1A2634"/>
            <!-- Slight stern expression - thin lips -->
            <path d="M22 16 L26 16" stroke="#B08070" stroke-width="0.8" stroke-linecap="round"/>
            <!-- Strong brow -->
            <path d="M18 10.5 L23 10" stroke="#C0A090" stroke-width="0.8"/>
            <path d="M30 10.5 L25 10" stroke="#C0A090" stroke-width="0.8"/>
            <!-- Raised finger (right hand) -->
            <path d="M34 24 L40 14 L41 12" stroke="#E0B89A" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="41" cy="11" r="1.5" fill="#E0B89A"/>
          </svg>
          <!-- Glow behind Jim -->
          <div class="absolute inset-0 bg-accent/10 rounded-full blur-lg -z-10" />
        </div>

        <!-- Speech bubble -->
        <div class="flex-1 min-w-0">
          <p class="text-accent text-[10px] font-heading font-bold uppercase tracking-widest mb-1">Jim siger:</p>
          <p class="text-white font-body text-sm leading-relaxed">{{ quote }}</p>
          <button
            v-if="mode === 'popup'"
            class="mt-3 px-4 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-heading font-semibold hover:bg-accent/30 transition-colors"
            @click="emit('dismiss')"
          >
            Ja, Jim...
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Toast - slides up from bottom */
.jim-toast-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jim-toast-leave-active { transition: all 0.3s ease-in; }
.jim-toast-enter-from { opacity: 0; transform: translateY(40px); }
.jim-toast-leave-to { opacity: 0; transform: translateY(20px); }

/* Popup - scales in */
.jim-popup-enter-active { transition: all 0.3s ease-out; }
.jim-popup-leave-active { transition: all 0.2s ease-in; }
.jim-popup-enter-from { opacity: 0; }
.jim-popup-leave-to { opacity: 0; }
.jim-popup-enter-from > div { transform: scale(0.9); }

/* Inline - fades in */
.jim-inline-enter-active { transition: all 0.4s ease-out; }
.jim-inline-leave-active { transition: all 0.2s ease-in; }
.jim-inline-enter-from { opacity: 0; transform: translateY(10px); }
.jim-inline-leave-to { opacity: 0; }
</style>
