<script setup lang="ts">
const emit = defineEmits<{
  notLars: []
  isLars: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-6">
    <!-- NOT LARS -->
    <button
      class="group flex flex-col items-center gap-2 btn-press"
      @click="emit('notLars')"
    >
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-error/15 border-2 border-error/50 flex items-center justify-center transition-all group-hover:bg-error/25 group-hover:border-error group-hover:shadow-glow-red group-active:scale-90">
        <Icon name="mdi:close-thick" size="32" class="text-error" />
      </div>
      <span class="text-xs font-heading font-semibold text-error/70 uppercase tracking-wider">Ikke Lars</span>
    </button>

    <!-- IS LARS -->
    <button
      class="group flex flex-col items-center gap-2 btn-press"
      @click="emit('isLars')"
    >
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-success/15 border-2 border-success/50 flex items-center justify-center transition-all group-hover:bg-success/25 group-hover:border-success group-hover:shadow-glow-green group-active:scale-90">
        <Icon name="mdi:check-bold" size="32" class="text-success" />
      </div>
      <span class="text-xs font-heading font-semibold text-success/70 uppercase tracking-wider">Det er Lars!</span>
    </button>
  </div>
</template>
