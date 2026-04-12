<script setup lang="ts">
const props = defineProps<{
  show: boolean
  fact: string
}>()

const emit = defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <Transition name="fact">
    <div
      v-if="show"
      class="absolute inset-0 flex items-center justify-center z-40 bg-black/50 backdrop-blur-sm"
      @click="emit('dismiss')"
    >
      <div
        class="glass rounded-2xl p-6 mx-6 max-w-sm text-center animate-slide-up"
        @click.stop
      >
        <div class="text-3xl mb-3">🍺</div>
        <h3 class="font-heading font-bold text-accent text-sm uppercase tracking-wider mb-2">
          Lars Fakta
        </h3>
        <p class="text-white font-body text-base leading-relaxed">
          {{ fact }}
        </p>
        <button
          class="mt-4 px-6 py-2 rounded-xl bg-accent/20 text-accent font-heading font-semibold text-sm hover:bg-accent/30 transition-colors"
          @click="emit('dismiss')"
        >
          Videre!
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fact-enter-active {
  transition: all 0.3s ease-out;
}
.fact-leave-active {
  transition: all 0.2s ease-in;
}
.fact-enter-from {
  opacity: 0;
}
.fact-leave-to {
  opacity: 0;
}
</style>
