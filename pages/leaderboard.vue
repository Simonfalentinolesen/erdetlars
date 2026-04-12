<script setup lang="ts">
const router = useRouter()

const activeTab = ref<'alltime' | 'today' | 'week'>('alltime')

// Fetch leaderboard data from API
const { data: leaderboard, refresh } = await useFetch('/api/leaderboard', {
  query: computed(() => ({ period: activeTab.value })),
  default: () => [],
})

watch(activeTab, () => refresh())
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <button
        class="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
        @click="router.back()"
      >
        <Icon name="mdi:arrow-left" size="20" />
      </button>
      <h1 class="font-heading font-bold text-xl text-white">Leaderboard</h1>
      <div class="w-10" />
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 px-4 py-3">
      <button
        v-for="tab in [
          { key: 'alltime', label: 'All-time' },
          { key: 'today', label: 'I dag' },
          { key: 'week', label: 'Denne uge' },
        ] as const"
        :key="tab.key"
        class="flex-1 py-2.5 rounded-xl font-heading font-semibold text-sm text-center transition-all"
        :class="activeTab === tab.key ? 'bg-accent text-primary' : 'glass text-muted hover:text-white'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Leaderboard list -->
    <div class="flex-1 overflow-y-auto px-4 pb-6">
      <div v-if="!leaderboard || leaderboard.length === 0" class="text-center py-20">
        <Icon name="mdi:trophy-outline" size="48" class="text-muted/30 mb-4" />
        <p class="text-muted font-body">Ingen scores endnu.</p>
        <NuxtLink
          to="/"
          class="inline-block mt-4 px-6 py-2.5 rounded-xl bg-accent text-primary font-heading font-semibold text-sm"
        >
          Vær den første!
        </NuxtLink>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="(entry, index) in leaderboard"
          :key="index"
          class="glass rounded-xl p-4 flex items-center gap-4 transition-all hover:bg-white/5"
          :class="{ 'border border-accent/30 shadow-glow': index < 3 }"
        >
          <!-- Rank -->
          <div class="w-10 text-center">
            <span
              v-if="index === 0"
              class="text-2xl"
            >🥇</span>
            <span
              v-else-if="index === 1"
              class="text-2xl"
            >🥈</span>
            <span
              v-else-if="index === 2"
              class="text-2xl"
            >🥉</span>
            <span
              v-else
              class="font-mono font-bold text-lg text-muted"
            >#{{ index + 1 }}</span>
          </div>

          <!-- Player info -->
          <div class="flex-1 min-w-0">
            <p class="font-heading font-semibold text-white truncate">{{ entry.nickname }}</p>
            <p class="text-muted text-xs font-mono">{{ entry.correct }}/10 korrekte</p>
          </div>

          <!-- Score -->
          <div class="text-right">
            <p class="font-mono font-bold text-lg text-accent">{{ entry.score.toLocaleString() }}</p>
            <p v-if="entry.bestStreak >= 3" class="text-xs text-muted">
              🔥 {{ entry.bestStreak }} streak
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
