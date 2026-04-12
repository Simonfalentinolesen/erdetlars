<script setup lang="ts">
const props = defineProps<{
  score: number
  streak: number
  multiplier: number
}>()

const displayScore = ref(0)
let animFrame: number | null = null

watch(() => props.score, (newScore) => {
  const start = displayScore.value
  const diff = newScore - start
  const duration = 400
  const startTime = Date.now()

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    displayScore.value = Math.round(start + diff * eased)

    if (progress < 1) {
      animFrame = requestAnimationFrame(animate)
    }
  }

  if (animFrame) cancelAnimationFrame(animFrame)
  animate()
}, { immediate: true })
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Score -->
    <div class="flex items-center gap-1.5 glass rounded-xl px-4 py-2">
      <Icon name="mdi:lightning-bolt" size="20" class="text-accent" />
      <span class="font-mono font-bold text-lg tabular-nums text-white">
        {{ displayScore.toLocaleString() }}
      </span>
    </div>

    <!-- Streak -->
    <div
      v-if="streak >= 2"
      class="flex items-center gap-1 glass rounded-xl px-3 py-2"
      :class="{ 'streak-fire': streak >= 5 }"
    >
      <span class="text-lg">{{ streak >= 10 ? '🔥🔥🔥' : streak >= 5 ? '🔥🔥' : '🔥' }}</span>
      <span class="font-mono font-bold text-sm text-accent">
        x{{ multiplier }}
      </span>
    </div>
  </div>
</template>
