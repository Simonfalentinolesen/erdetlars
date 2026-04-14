<script setup lang="ts">
const props = defineProps<{
  promille: number  // 0 - 3.0
  holding: boolean
  multiplier: number
}>()

const pct = computed(() => Math.min(100, (props.promille / 3) * 100))

const stageColor = computed(() => {
  if (props.promille < 1) return '#00D68F'
  if (props.promille < 2) return '#F5A623'
  return '#E84393'
})

const stageLabel = computed(() => {
  if (props.promille < 0.5) return 'ÆDRU'
  if (props.promille < 1) return 'SVAJENDE'
  if (props.promille < 1.5) return 'PÅ VEJ'
  if (props.promille < 2) return 'FULD'
  if (props.promille < 2.5) return 'MEGET FULD'
  return 'LARS-NIVEAU'
})
</script>

<template>
  <div class="w-full max-w-sm mx-auto">
    <div class="flex items-center justify-between mb-1.5 px-1">
      <div class="flex items-center gap-1.5">
        <Icon name="mdi:glass-mug-variant" size="14" :style="{ color: stageColor }" />
        <span class="text-[10px] font-mono font-bold tabular-nums" :style="{ color: stageColor }">
          {{ promille.toFixed(1) }}‰
        </span>
      </div>
      <span
        class="text-[9px] font-heading font-bold tracking-widest"
        :style="{ color: stageColor }"
      >
        {{ stageLabel }}
      </span>
      <div class="flex items-center gap-1 glass rounded-full px-2 py-0.5 border border-accent/30">
        <Icon name="mdi:lightning-bolt" size="10" class="text-accent" />
        <span class="text-accent text-[10px] font-mono font-bold tabular-nums">
          {{ multiplier.toFixed(1) }}x
        </span>
      </div>
    </div>

    <!-- Promille bar -->
    <div class="h-2.5 bg-surface/80 rounded-full overflow-hidden border border-white/10 relative">
      <div
        class="h-full transition-all duration-200 rounded-full"
        :class="{ 'drinking-pulse': holding }"
        :style="{
          width: `${pct}%`,
          background: `linear-gradient(90deg, #00D68F 0%, ${pct > 33 ? '#F5A623' : '#00D68F'} ${pct > 33 ? '33%' : '100%'}, ${pct > 66 ? '#E84393' : '#F5A623'} ${pct > 66 ? '66%' : '100%'}, #E84393 100%)`,
        }"
      />

      <!-- Milestones -->
      <div class="absolute inset-y-0 left-[33%] w-px bg-white/20" />
      <div class="absolute inset-y-0 left-[66%] w-px bg-white/20" />
    </div>

    <!-- Hint -->
    <p class="text-center text-muted text-[9px] font-mono mt-1.5">
      {{ holding ? '🍺 DRIKKER...' : 'Hold kortet nede for at drikke' }}
    </p>
  </div>
</template>

<style scoped>
.drinking-pulse {
  animation: drink-throb 0.6s ease-in-out infinite;
}

@keyframes drink-throb {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3) saturate(1.3); }
}
</style>
