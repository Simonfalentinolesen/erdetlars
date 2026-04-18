<script setup lang="ts">
import { POWERUP_DEFS, type PowerUpType } from '~/composables/usePowerUps'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  use: [type: PowerUpType]
}>()

const { inventory, recentlyEarned, activeEffects, hintActive } = usePowerUps()

// Hvilken power-up er "lige nu aktiv" \u2014 bruges til at skjule tooltip
// n\u00e5r en effekt k\u00f8rer (ellers overlapper tooltip med den ai-genererede
// Jim-toast, og brugeren ser 2 beskeder samtidig).
function isActiveType(type: PowerUpType): boolean {
  if (type === 'hint') return hintActive.value
  if (type === 'shield') return activeEffects.value.shield
  if (type === 'double') return activeEffects.value.double
  return false
}

const TYPES: PowerUpType[] = ['hint', 'shield', 'double', 'skip']

function handleClick(type: PowerUpType) {
  if (props.disabled) return
  if (inventory.value[type] <= 0) return
  emit('use', type)
}
</script>

<template>
  <div class="flex items-center justify-center gap-2.5 px-4">
    <button
      v-for="type in TYPES"
      :key="type"
      class="powerup-btn group relative"
      :class="{
        'powerup-empty': inventory[type] <= 0,
        'powerup-recently-earned': recentlyEarned === type,
        'powerup-active-effect':
          (type === 'shield' && activeEffects.shield) ||
          (type === 'double' && activeEffects.double),
      }"
      :disabled="disabled || inventory[type] <= 0"
      @click="handleClick(type)"
    >
      <!-- Icon button -->
      <div
        class="w-11 h-11 rounded-xl glass flex items-center justify-center transition-all border"
        :style="{
          borderColor: inventory[type] > 0 ? POWERUP_DEFS[type].glowColor : 'rgba(255,255,255,0.06)',
          boxShadow: inventory[type] > 0 ? `0 0 10px ${POWERUP_DEFS[type].glowColor}` : 'none',
        }"
      >
        <Icon
          :name="POWERUP_DEFS[type].icon"
          size="20"
          :class="inventory[type] > 0 ? POWERUP_DEFS[type].color : 'text-muted/30'"
        />
      </div>

      <!-- Count badge -->
      <div
        v-if="inventory[type] > 0"
        class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center px-1 count-badge"
      >
        <span class="text-primary text-[10px] font-mono font-bold tabular-nums leading-none">
          {{ inventory[type] }}
        </span>
      </div>

      <!-- Tooltip on hover (desktop) \u2014 skjules n\u00e5r denne power-up er aktiv
           for at undg\u00e5 dobbelt Jim-besked -->
      <div
        v-if="!isActiveType(type)"
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
      >
        <div class="glass rounded-lg px-2.5 py-1.5 whitespace-nowrap border border-white/10">
          <p class="font-heading font-bold text-[10px] text-white">
            {{ POWERUP_DEFS[type].name }}
          </p>
          <p class="text-muted text-[9px] font-body">
            {{ POWERUP_DEFS[type].description }}
          </p>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.powerup-btn {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}

.powerup-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.powerup-btn:disabled {
  cursor: not-allowed;
}

.powerup-empty {
  opacity: 0.55;
}

.count-badge {
  animation: count-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes count-pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

.powerup-recently-earned {
  animation: earned-pulse 1.8s ease-out;
}

@keyframes earned-pulse {
  0% { transform: scale(0.7) rotate(-8deg); }
  30% { transform: scale(1.3) rotate(4deg); }
  60% { transform: scale(0.95) rotate(-2deg); }
  100% { transform: scale(1) rotate(0); }
}

.powerup-active-effect > div:first-child {
  animation: active-ring 1.4s ease-in-out infinite;
}

@keyframes active-ring {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
