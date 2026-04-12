<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
  answers?: { correct: boolean }[]
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      v-for="i in total"
      :key="i"
      class="w-2.5 h-2.5 rounded-full transition-all duration-300"
      :class="[
        i - 1 < current
          ? answers && answers[i - 1]
            ? answers[i - 1].correct
              ? 'bg-success scale-110'
              : 'bg-error scale-110'
            : 'bg-muted'
          : i - 1 === current
            ? 'bg-accent w-4 scale-125'
            : 'bg-white/15',
      ]"
    />
    <span class="text-muted text-xs font-mono ml-1">{{ Math.min(current + 1, total) }}/{{ total }}</span>
  </div>
</template>
