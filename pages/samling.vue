<script setup lang="ts">
import factsData from '~/data/facts.json'
import type { Rarity } from '~/composables/useCollection'

const { allCards, unlockedCount, totalCount, mythicalUnlocked, completionPct } = useCollection()

type FilterMode = 'all' | 'unlocked' | 'locked' | 'mythical' | 'rare'
const filter = ref<FilterMode>('all')

const filtered = computed(() => {
  switch (filter.value) {
    case 'unlocked':
      return allCards.value.filter(c => c.unlocked)
    case 'locked':
      return allCards.value.filter(c => !c.unlocked)
    case 'mythical':
      return allCards.value.filter(c => c.rarity === 'mythical')
    case 'rare':
      return allCards.value.filter(c => c.rarity === 'rare')
    default:
      return allCards.value
  }
})

const rareTotalCount = computed(() => allCards.value.filter(c => c.rarity === 'rare').length)
const rareUnlocked = computed(() => allCards.value.filter(c => c.rarity === 'rare' && c.unlocked).length)
const mythicalTotal = computed(() => allCards.value.filter(c => c.rarity === 'mythical').length)

// Persistent fact mapping: each card gets a deterministic fact based on id
function factFor(id: number): string {
  const facts = factsData.facts
  return facts[id % facts.length]
}

const filterTabs: { id: FilterMode; label: string; count?: number }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'unlocked', label: 'Fundet' },
  { id: 'locked', label: 'Mangler' },
  { id: 'rare', label: 'Sjældne' },
  { id: 'mythical', label: 'Mytiske' },
]
</script>

<template>
  <div class="min-h-screen pb-8">
    <!-- Header -->
    <div class="sticky top-0 z-20 bg-primary/95 backdrop-blur-md border-b border-white/5">
      <div class="flex items-center justify-between px-4 pt-4 pb-3 safe-top">
        <NuxtLink
          to="/"
          class="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
        >
          <Icon name="mdi:arrow-left" size="20" />
        </NuxtLink>
        <h1 class="font-heading font-bold text-xl text-white">Lars-Pokédex</h1>
        <div class="w-10" />
      </div>

      <!-- Progress -->
      <div class="px-4 pb-3">
        <div class="glass rounded-2xl p-4">
          <div class="flex items-baseline justify-between mb-2">
            <div>
              <p class="text-[10px] font-heading font-bold text-muted tracking-widest uppercase">
                Din samling
              </p>
              <p class="font-mono font-bold text-2xl text-white tabular-nums">
                {{ unlockedCount }}<span class="text-muted text-lg">/{{ totalCount }}</span>
              </p>
            </div>
            <div class="text-right">
              <p class="font-mono font-bold text-3xl text-accent tabular-nums">{{ completionPct }}%</p>
              <p class="text-[10px] text-muted font-mono">fuldført</p>
            </div>
          </div>
          <!-- Progress bar -->
          <div class="h-2 bg-surface/80 rounded-full overflow-hidden relative">
            <div
              class="h-full bg-gradient-to-r from-success via-accent to-pink-accent rounded-full transition-all duration-700"
              :style="{ width: `${completionPct}%` }"
            />
          </div>

          <!-- Rarity breakdown -->
          <div class="mt-3 grid grid-cols-2 gap-2">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6AACDB]/10 border border-[#6AACDB]/30">
              <Icon name="mdi:star-four-points" size="14" class="text-[#6AACDB]" />
              <span class="font-mono text-[10px] font-bold text-[#6AACDB] tabular-nums">
                {{ rareUnlocked }}/{{ rareTotalCount }} Sjældne
              </span>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 mythical-badge">
              <Icon name="mdi:diamond-stone" size="14" class="text-accent" />
              <span class="font-mono text-[10px] font-bold text-accent tabular-nums">
                {{ mythicalUnlocked }}/{{ mythicalTotal }} Mytiske
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="px-4 pb-3 overflow-x-auto">
        <div class="flex gap-2">
          <button
            v-for="tab in filterTabs"
            :key="tab.id"
            class="flex-shrink-0 px-3.5 py-1.5 rounded-full font-heading text-xs font-bold tracking-wide transition-all btn-press"
            :class="filter === tab.id
              ? 'bg-accent text-primary shadow-glow'
              : 'glass text-muted hover:text-white'"
            @click="filter = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div class="px-3 pt-3">
      <div
        v-if="filtered.length === 0"
        class="text-center py-12"
      >
        <Icon name="mdi:cards-outline" size="48" class="text-muted/30 mx-auto mb-3" />
        <p class="text-muted text-sm font-body">
          Ingen kort i denne kategori endnu.
        </p>
      </div>

      <div v-else class="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        <CollectionCard
          v-for="card in filtered"
          :key="card.id"
          :card="card"
          :fact="factFor(card.id)"
        />
      </div>
    </div>

    <!-- Empty-state call to action at bottom -->
    <div v-if="unlockedCount < totalCount" class="px-6 pt-6">
      <NuxtLink
        to="/"
        class="block w-full py-3.5 rounded-2xl bg-accent text-primary font-heading font-bold text-center text-sm uppercase tracking-wider btn-press"
      >
        Spil for at låse flere op
      </NuxtLink>
    </div>

    <div v-else class="px-6 pt-6">
      <div class="glass rounded-2xl p-5 text-center border border-accent/40 shadow-glow">
        <p class="text-2xl mb-2">👑</p>
        <p class="font-heading font-bold text-accent text-sm uppercase tracking-widest mb-1">
          Komplet samling!
        </p>
        <p class="text-white text-xs font-body">
          Du har fundet alle Larser. Jim er imponeret. (Næsten.)
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.safe-top {
  padding-top: max(1rem, env(safe-area-inset-top));
}

.mythical-badge {
  animation: badge-shimmer 3s ease-in-out infinite;
}

@keyframes badge-shimmer {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 166, 35, 0); }
  50% { box-shadow: 0 0 14px rgba(245, 166, 35, 0.4); }
}
</style>
