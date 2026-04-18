<script setup lang="ts">
/**
 * Techno Viking — Phaser 3 rhythm-parade game.
 *
 * Baseret på TECHNO_VIKING_Game_Design_Document.md. Lars marcherer mod
 * pølsevognen kl. 03:47 mens Jim Lyngvild-trickster kommenterer fra siden.
 * Rammer pile på beat, samler følgere, transformer fra "Casual Lars" til
 * TECHNO VIKING.
 *
 * Page-wrapper mounter Phaser client-side og rydder op ved navigation.
 */
import type { Game } from 'phaser'

const router = useRouter()

const containerEl = ref<HTMLDivElement | null>(null)
const isReady = ref(false)
const errorMsg = ref('')
let gameInstance: Game | null = null

definePageMeta({
  layout: false,
})

useHead({
  title: 'Techno Viking | ErDetLars',
  meta: [{ name: 'theme-color', content: '#08080f' }],
})

onMounted(async () => {
  if (!containerEl.value) return
  try {
    const [{ default: Phaser }, { buildTechnoVikingConfig }] = await Promise.all([
      import('phaser'),
      import('~/game/techno-viking/config'),
    ])
    void Phaser

    // Vent på at Space Grotesk er loadet før Phaser renderer text
    if ('fonts' in document) {
      try {
        await Promise.race([
          Promise.all([
            (document as Document & { fonts: FontFaceSet }).fonts.load('700 48px "Space Grotesk"'),
            (document as Document & { fonts: FontFaceSet }).fonts.load('400 14px "JetBrains Mono"'),
          ]),
          new Promise(resolve => setTimeout(resolve, 2000)),
        ])
      } catch (fontErr) {
        console.warn('[techno-viking] font-load warning:', fontErr)
      }
    }

    const config = buildTechnoVikingConfig(containerEl.value)
    gameInstance = new Phaser.Game(config)
    if (import.meta.dev) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__TV_GAME__ = gameInstance
    }
    isReady.value = true
  } catch (err) {
    console.error('[techno-viking] Phaser failed to start:', err)
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
})

onBeforeUnmount(() => {
  if (gameInstance) {
    gameInstance.destroy(true, false)
    gameInstance = null
  }
})

function backToMinigames() {
  router.push('/minigames')
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col" style="background: #08080f">
    <!-- Top-bar -->
    <div class="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-black/60 z-10">
      <button
        class="text-muted hover:text-white text-sm font-heading flex items-center gap-1"
        @click="backToMinigames"
      >
        <Icon name="mdi:arrow-left" size="18" />
        Tilbage
      </button>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-mono uppercase tracking-widest" style="color: #ffd447">
          TECHNO · 120 BPM
        </span>
      </div>
    </div>

    <!-- Phaser container -->
    <div class="flex-1 relative overflow-hidden">
      <div
        ref="containerEl"
        class="absolute inset-0 w-full h-full"
      />

      <!-- Loading overlay -->
      <div
        v-if="!isReady && !errorMsg"
        class="absolute inset-0 flex items-center justify-center"
        style="background: linear-gradient(180deg, #0a0a1a 0%, #2a1048 100%)"
      >
        <div class="text-center">
          <div
            class="mb-4 mx-auto w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin"
            style="border-color: #ffd447; border-top-color: transparent"
          />
          <p
            class="text-3xl mb-2"
            style="font-family: 'Space Grotesk', system-ui, sans-serif; color: #ffd447; font-weight: 800; letter-spacing: 0.08em"
          >
            TECHNO VIKING
          </p>
          <p
            class="text-xs tracking-widest uppercase mt-2"
            style="font-family: 'JetBrains Mono', monospace; color: #7a8a95"
          >
            Warming up the sound system…
          </p>
        </div>
      </div>

      <!-- Error overlay -->
      <div
        v-if="errorMsg"
        class="absolute inset-0 flex items-center justify-center p-6"
        style="background: #08080f"
      >
        <div class="max-w-md text-center">
          <div class="text-5xl mb-4">💥</div>
          <p class="font-heading font-bold text-error text-lg mb-2">Phaser kunne ikke starte</p>
          <p class="text-muted text-sm font-mono break-words">{{ errorMsg }}</p>
          <button
            class="mt-4 px-4 py-2 rounded-lg bg-accent text-primary font-heading font-bold text-sm"
            @click="backToMinigames"
          >
            Tilbage
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
