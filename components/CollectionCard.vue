<script setup lang="ts">
import type { CollectionCard } from '~/composables/useCollection'

const props = defineProps<{
  card: CollectionCard
  fact?: string
}>()

const flipped = ref(false)
const showVideo = ref(false)

function toggleFlip() {
  if (!props.card.unlocked) return
  flipped.value = !flipped.value
}

const rarityConfig = computed(() => {
  if (props.card.rarity === 'mythical') {
    return {
      label: 'MYTISK',
      borderClass: 'mythical-border',
      labelClass: 'text-accent',
      glow: '0 0 20px rgba(245, 166, 35, 0.6)',
    }
  }
  if (props.card.rarity === 'rare') {
    return {
      label: 'SJÆLDEN',
      borderClass: 'rare-border',
      labelClass: 'text-[#6AACDB]',
      glow: '0 0 14px rgba(106, 172, 219, 0.5)',
    }
  }
  return {
    label: 'ALMINDELIG',
    borderClass: 'common-border',
    labelClass: 'text-muted',
    glow: 'none',
  }
})

const isVideo = computed(() => props.card.type === 'video')
const posterSrc = computed(() => {
  if (isVideo.value) return props.card.file.replace(/\.[^.]+$/, '.jpg')
  return props.card.file
})
</script>

<template>
  <div class="collection-card relative aspect-[3/4] cursor-pointer" @click="toggleFlip">
    <div class="card-inner w-full h-full" :class="{ 'is-flipped': flipped }">
      <!-- FRONT -->
      <div
        class="card-face card-front rounded-2xl overflow-hidden"
        :class="rarityConfig.borderClass"
        :style="{ boxShadow: card.unlocked ? rarityConfig.glow : 'none' }"
      >
        <!-- Image container -->
        <div class="w-full h-full bg-surface overflow-hidden flex items-center justify-center relative">
          <!-- Video indicator -->
          <div
            v-if="card.unlocked && isVideo"
            class="absolute top-2 left-2 bg-black/60 backdrop-blur rounded-full px-2 py-0.5 flex items-center gap-1 z-10"
          >
            <Icon name="mdi:play-circle" size="10" class="text-accent" />
            <span class="text-accent text-[8px] font-mono font-bold">VIDEO</span>
          </div>

          <!-- Unlocked: show image/poster -->
          <img
            v-if="card.unlocked"
            :src="posterSrc"
            :alt="card.isLars ? 'Lars' : 'Ikke Lars'"
            class="w-full h-full object-cover"
            draggable="false"
          >

          <!-- Locked: silhouette -->
          <div v-else class="absolute inset-0 flex items-center justify-center bg-surface">
            <div class="relative">
              <Icon name="mdi:help-circle" size="40" class="text-muted/30" />
              <div class="absolute inset-0 flex items-center justify-center">
                <Icon name="mdi:lock" size="16" class="text-muted/40" />
              </div>
            </div>
          </div>

          <!-- Number badge -->
          <div
            class="absolute top-2 right-2 bg-black/60 backdrop-blur rounded-md px-1.5 py-0.5 z-10"
          >
            <span class="text-white text-[9px] font-mono font-bold">
              #{{ String(card.id).padStart(3, '0') }}
            </span>
          </div>

          <!-- Bottom gradient overlay -->
          <div
            v-if="card.unlocked"
            class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-end justify-center pb-2"
          >
            <span
              class="text-[9px] font-mono font-bold tracking-widest"
              :class="rarityConfig.labelClass"
            >
              {{ rarityConfig.label }}
            </span>
          </div>

          <!-- Locked overlay label -->
          <div
            v-else
            class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 to-transparent z-10 flex items-end justify-center pb-2"
          >
            <span class="text-[9px] font-mono font-bold tracking-widest text-muted/50">
              ???
            </span>
          </div>

          <!-- Mythical sparkles -->
          <template v-if="card.unlocked && card.rarity === 'mythical'">
            <div class="sparkle" style="top: 10%; left: 15%; animation-delay: 0s" />
            <div class="sparkle" style="top: 20%; right: 20%; animation-delay: 0.3s" />
            <div class="sparkle" style="bottom: 30%; left: 25%; animation-delay: 0.7s" />
            <div class="sparkle" style="bottom: 15%; right: 30%; animation-delay: 1.1s" />
          </template>
        </div>
      </div>

      <!-- BACK -->
      <div
        class="card-face card-back rounded-2xl overflow-hidden flex flex-col p-3"
        :class="rarityConfig.borderClass"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-[9px] font-mono font-bold" :class="rarityConfig.labelClass">
            #{{ String(card.id).padStart(3, '0') }}
          </span>
          <span
            class="text-[8px] font-mono font-bold tracking-widest"
            :class="rarityConfig.labelClass"
          >
            {{ rarityConfig.label }}
          </span>
        </div>

        <div class="flex-1 flex flex-col justify-center gap-2">
          <div class="flex items-center gap-2">
            <Icon
              :name="card.isLars ? 'mdi:account-check' : 'mdi:account-question'"
              size="16"
              :class="card.isLars ? 'text-success' : 'text-error'"
            />
            <span
              class="text-xs font-heading font-bold"
              :class="card.isLars ? 'text-success' : 'text-error'"
            >
              {{ card.isLars ? 'DET ER LARS' : 'IKKE LARS' }}
            </span>
          </div>

          <p class="text-white/80 text-[10px] font-body leading-relaxed">
            {{ fact || 'Et ægte øjeblik fanget i Lars-kronikerne.' }}
          </p>
        </div>

        <div class="text-center mt-2">
          <p class="text-muted text-[8px] font-mono">Tryk for at vende</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.collection-card {
  perspective: 1000px;
}

.card-inner {
  position: relative;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-style: preserve-3d;
}

.card-inner.is-flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, #1A2634 0%, #0F1923 100%);
}

/* Rarity borders */
.common-border {
  border: 2px solid rgba(136, 146, 160, 0.3);
}

.rare-border {
  border: 2px solid rgba(106, 172, 219, 0.55);
}

.mythical-border {
  border: 2px solid transparent;
  background-clip: padding-box;
  position: relative;
}

.mythical-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 1rem;
  padding: 2px;
  background: linear-gradient(
    45deg,
    #F5A623, #E84393, #F5A623, #FFD166, #F5A623
  );
  background-size: 300% 300%;
  animation: mythical-shift 3s linear infinite;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

@keyframes mythical-shift {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

/* Sparkles for mythical */
.sparkle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #FFD166;
  border-radius: 50%;
  box-shadow: 0 0 6px #FFD166;
  animation: sparkle-twinkle 1.6s ease-in-out infinite;
  pointer-events: none;
  z-index: 5;
}

@keyframes sparkle-twinkle {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1); }
}
</style>
