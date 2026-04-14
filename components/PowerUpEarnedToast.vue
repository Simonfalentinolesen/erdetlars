<script setup lang="ts">
import { POWERUP_DEFS, type PowerUpType } from '~/composables/usePowerUps'

const props = defineProps<{
  type: PowerUpType | null
}>()

const visible = computed(() => props.type !== null)
const def = computed(() => (props.type ? POWERUP_DEFS[props.type] : null))
</script>

<template>
  <Transition name="powerup-earned">
    <div
      v-if="visible && def"
      class="fixed left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
      style="top: 30%"
    >
      <div class="glass rounded-2xl px-5 py-4 border flex flex-col items-center gap-2"
        :style="{
          borderColor: def.glowColor,
          boxShadow: `0 0 30px ${def.glowColor}`,
        }"
      >
        <!-- Big icon -->
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center"
          :style="{
            background: `linear-gradient(135deg, ${def.glowColor} 0%, rgba(26, 38, 52, 0.8) 100%)`,
          }"
        >
          <Icon :name="def.icon" size="28" :class="def.color" />
        </div>
        <p class="text-[9px] font-heading font-bold tracking-widest text-accent uppercase">
          Power-up fundet!
        </p>
        <p class="text-white font-heading font-bold text-base">{{ def.name }}</p>
        <p class="text-muted text-[10px] font-body text-center max-w-[180px]">
          {{ def.description }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.powerup-earned-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.powerup-earned-leave-active {
  transition: all 0.4s ease-in;
}
.powerup-earned-enter-from {
  opacity: 0;
  transform: translateX(-50%) scale(0.5) translateY(20px);
}
.powerup-earned-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.9) translateY(-10px);
}
</style>
