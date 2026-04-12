<script setup lang="ts">
const props = defineProps<{
  show: boolean
  correct: boolean
  points: number
  message: string
  speedBonus: boolean
}>()
</script>

<template>
  <Transition name="feedback">
    <div
      v-if="show"
      class="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none"
    >
      <!-- Points float -->
      <div
        class="score-float"
        :class="correct ? 'text-success' : 'text-error'"
      >
        {{ correct ? '+' : '' }}{{ points }}
      </div>

      <!-- Speed bonus indicator -->
      <div
        v-if="speedBonus"
        class="score-float text-accent !text-base mt-12"
        style="animation-delay: 0.15s"
      >
        SPEED BONUS!
      </div>

      <!-- Jim handles the text feedback via toast -->
    </div>
  </Transition>
</template>

<style scoped>
.feedback-enter-active {
  transition: all 0.2s ease-out;
}
.feedback-leave-active {
  transition: all 0.5s ease-in;
}
.feedback-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.feedback-leave-to {
  opacity: 0;
}
</style>
