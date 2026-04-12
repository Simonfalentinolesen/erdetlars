<script setup lang="ts">
import type { GameImage } from '~/composables/useGame'

const props = defineProps<{
  image: GameImage
  isActive: boolean
}>()

const emit = defineEmits<{
  swipeLeft: []
  swipeRight: []
}>()

const cardRef = ref<HTMLElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const { swipeState, getCardStyle, triggerSwipe } = useSwipe(
  cardRef,
  () => emit('swipeLeft'),
  () => emit('swipeRight'),
)

defineExpose({ triggerSwipe })

// Detect if file is video based on extension or type field
const isVideo = computed(() => {
  if (props.image.type === 'video') return true
  const ext = props.image.file.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'mov', 'ogg'].includes(ext || '')
})

// Auto-play video when card becomes active
watch(() => props.isActive, (active) => {
  if (active && videoRef.value) {
    videoRef.value.play().catch(() => {})
  }
})

onMounted(() => {
  if (isVideo.value && videoRef.value) {
    videoRef.value.play().catch(() => {})
  }
})

// Label visibility based on swipe direction
const larsLabelOpacity = computed(() => {
  if (!swipeState.value.isDragging && !swipeState.value.flyingOut) return 0
  if (swipeState.value.direction === 'right') {
    return Math.min(1, Math.abs(swipeState.value.offsetX) / 60)
  }
  return 0
})

const notLarsLabelOpacity = computed(() => {
  if (!swipeState.value.isDragging && !swipeState.value.flyingOut) return 0
  if (swipeState.value.direction === 'left') {
    return Math.min(1, Math.abs(swipeState.value.offsetX) / 60)
  }
  return 0
})

const borderColor = computed(() => {
  if (!swipeState.value.direction) return 'rgba(255,255,255,0.08)'
  if (swipeState.value.direction === 'right') return `rgba(0, 214, 143, ${larsLabelOpacity.value * 0.6})`
  if (swipeState.value.direction === 'left') return `rgba(255, 71, 87, ${notLarsLabelOpacity.value * 0.6})`
  return 'rgba(255,255,255,0.08)'
})
</script>

<template>
  <div
    ref="cardRef"
    class="relative w-full max-w-[340px] max-h-[55vh] rounded-3xl overflow-hidden shadow-card select-none will-change-transform"
    :style="{
      ...getCardStyle(),
      borderColor,
      borderWidth: '3px',
      borderStyle: 'solid',
    }"
    :class="{ 'pointer-events-none': !isActive || swipeState.flyingOut }"
  >
    <!-- Media container - shows full image with padding -->
    <div class="w-full h-full bg-surface overflow-hidden flex items-center justify-center">
      <!-- Video -->
      <video
        v-if="isVideo"
        ref="videoRef"
        :src="image.file"
        class="w-full h-full object-contain"
        muted
        loop
        playsinline
        autoplay
        :poster="image.file.replace(/\.[^.]+$/, '.jpg')"
        draggable="false"
      />
      <!-- Image -->
      <img
        v-else
        :src="image.file"
        :alt="image.isLars ? 'Lars?' : 'Person'"
        class="w-full h-full object-contain"
        draggable="false"
      >
    </div>

    <!-- Video indicator -->
    <div
      v-if="isVideo"
      class="absolute top-3 left-3 glass rounded-full px-2 py-1 flex items-center gap-1 pointer-events-none"
    >
      <Icon name="mdi:play-circle" size="14" class="text-white/70" />
      <span class="text-white/70 text-[10px] font-mono">VIDEO</span>
    </div>

    <!-- Gradient overlay at bottom -->
    <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

    <!-- "DET ER LARS" label (right swipe) -->
    <div
      class="swipe-label swipe-label-lars"
      :style="{ opacity: larsLabelOpacity }"
    >
      LARS!
    </div>

    <!-- "IKKE LARS" label (left swipe) -->
    <div
      class="swipe-label swipe-label-not-lars"
      :style="{ opacity: notLarsLabelOpacity }"
    >
      IKKE LARS
    </div>

    <!-- Swipe hint -->
    <div
      v-if="isActive && !swipeState.isDragging && !swipeState.flyingOut"
      class="absolute bottom-4 inset-x-0 text-center pointer-events-none"
    >
      <p class="text-white/40 text-sm font-body">
        &larr; Swipe eller brug piltaster &rarr;
      </p>
    </div>
  </div>
</template>
