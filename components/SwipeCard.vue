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
const imgRef = ref<HTMLImageElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const imageLoaded = ref(false)
const imageError = ref(false)

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

// Bulletproof image-load detection. På et cache-hit fires @load ikke
// pålideligt på tværs af browsere. Vi kombinerer 3 strategier:
// 1) @load handler (almindelig vej)
// 2) img.complete check (synkron cache hit)
// 3) img.decode() promise (venter på at billedet er render-klar)
// Skeletten må aldrig hænge fast — det var det der gav "blurry billeder efter 30 swipes".
async function ensureImageLoaded() {
  if (isVideo.value) return
  const img = imgRef.value
  if (!img) return
  if (img.complete && img.naturalWidth > 0) {
    imageLoaded.value = true
    return
  }
  try {
    await img.decode()
    imageLoaded.value = true
  } catch {
    // decode() kan fejle for SVG eller på cross-origin — fald tilbage til @load
  }
}

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
  ensureImageLoaded()
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
    <div class="w-full h-full bg-surface overflow-hidden flex items-center justify-center relative">
      <!-- Loading state — solid bg + lille spinner, ikke en gradient
           der kan forveksles med et blurry billede. -->
      <div
        v-if="!imageLoaded && !imageError && !isVideo"
        class="absolute inset-0 flex items-center justify-center bg-surface"
      >
        <div class="w-8 h-8 rounded-full border-2 border-white/15 border-t-white/50 animate-spin" />
      </div>

      <!-- Error fallback -->
      <div
        v-if="imageError"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted p-6 text-center"
      >
        <Icon name="mdi:image-broken-variant" size="40" class="text-muted/50" />
        <p class="text-xs font-mono opacity-60">Billede kunne ikke indlæses</p>
      </div>

      <!-- Video -->
      <video
        v-if="isVideo"
        ref="videoRef"
        :src="image.file"
        :poster="image.file.replace(/\.[^.]+$/, '.jpg')"
        class="w-full h-full object-contain"
        muted
        loop
        playsinline
        autoplay
        preload="auto"
        draggable="false"
        @loadeddata="imageLoaded = true"
        @error="imageError = true"
      />

      <!-- Video indicator badge -->
      <div
        v-if="isVideo"
        class="absolute top-3 left-3 glass rounded-full px-2 py-1 flex items-center gap-1 pointer-events-none z-10"
      >
        <Icon name="mdi:play-circle" size="14" class="text-white/80" />
        <span class="text-white/80 text-[10px] font-mono">VIDEO</span>
      </div>
      <!-- Image -->
      <img
        v-else
        ref="imgRef"
        :src="image.file"
        :alt="image.isLars ? 'Lars?' : 'Person'"
        class="w-full h-full object-contain"
        :class="{ 'opacity-0': !imageLoaded }"
        draggable="false"
        @load="imageLoaded = true"
        @error="imageError = true"
      >
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
