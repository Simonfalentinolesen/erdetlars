<script setup lang="ts">
/**
 * Viking Lars V2 — Phaser 3 rebuild.
 *
 * Page-wrapperens ansvar:
 * - Mount Phaser game i en div når komponentet er mounted (kun client-side)
 * - Destroy game instance når brugeren navigerer væk (forhindrer memory leaks)
 * - Vis "loading"-state mens Phaser dynamisk importeres
 *
 * V1 ligger uændret på /minigames/viking-lars — V2 er separat exit.
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
  title: 'Viking Lars V2 (Phaser 3) | ErDetLars',
  meta: [{ name: 'theme-color', content: '#0F1923' }],
})

onMounted(async () => {
  if (!containerEl.value) return
  try {
    // Dynamic import — Phaser er ~1.5 MB, vi vil ikke ship det i hoved-bundle
    const [{ default: Phaser }, { buildGameConfig }] = await Promise.all([
      import('phaser'),
      import('~/game/v2/config'),
    ])
    void Phaser // referer for at undgå tree-shake
    const config = buildGameConfig(containerEl.value)
    gameInstance = new Phaser.Game(config)
    isReady.value = true
  } catch (err) {
    console.error('[viking-lars-v2] Phaser failed to start:', err)
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
})

onBeforeUnmount(() => {
  if (gameInstance) {
    // true = removeCanvas, false = preserveContext
    gameInstance.destroy(true, false)
    gameInstance = null
  }
})

function backToMinigames() {
  router.push('/minigames')
}
</script>

<template>
  <div class="fixed inset-0 bg-primary flex flex-col">
    <!-- Top-bar -->
    <div class="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-black/40 z-10">
      <button
        class="text-muted hover:text-white text-sm font-heading flex items-center gap-1"
        @click="backToMinigames"
      >
        <Icon name="mdi:arrow-left" size="18" />
        Tilbage
      </button>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-mono text-accent uppercase tracking-widest">V2 · Phaser 3</span>
        <span class="text-muted text-xs">·</span>
        <NuxtLink
          to="/minigames/viking-lars"
          class="text-muted hover:text-white text-xs font-body underline-offset-2 hover:underline"
        >
          Spil V1
        </NuxtLink>
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
        class="absolute inset-0 flex items-center justify-center bg-primary"
      >
        <div class="text-center">
          <div class="text-5xl mb-4 animate-pulse">⚔️</div>
          <p class="font-heading font-bold text-accent text-lg">Indlæser Phaser-engine...</p>
          <p class="text-muted text-xs font-mono mt-2">Første gang tager længere — bundle caches</p>
        </div>
      </div>

      <!-- Error overlay -->
      <div
        v-if="errorMsg"
        class="absolute inset-0 flex items-center justify-center bg-primary p-6"
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
