<script setup lang="ts">
import { DIFFICULTY_CONFIG, type DifficultyId } from '~/composables/useGame'

const router = useRouter()

type Period = 'alltime' | 'today' | 'week'
type DiffFilter = 'all' | DifficultyId

const activeTab = ref<Period>('alltime')
const activeDiff = ref<DiffFilter>('all')
const limit = ref(20)
const offset = ref(0)

const { data: leaderboard, refresh, pending } = await useFetch('/api/leaderboard', {
  query: computed(() => ({
    period: activeTab.value,
    difficulty: activeDiff.value === 'all' ? undefined : activeDiff.value,
    limit: limit.value,
    offset: offset.value,
  })),
  default: () => ({ entries: [], total: 0, limit: 20, offset: 0 }),
})

// Reset offset når filter/periode skifter — ellers risikerer vi at lande
// på en tom side (fx 40-60 af et filter med kun 25 entries).
watch([activeTab, activeDiff], () => {
  offset.value = 0
  refresh()
})

function loadMore() {
  offset.value += limit.value
  refresh()
}

// Relativ tid — "5m siden", "2t siden", "i går", "3d siden"
function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const then = typeof iso === 'string' ? new Date(iso) : iso
  const mins = Math.floor((Date.now() - then.getTime()) / 60_000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `${mins}m siden`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}t siden`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'i går'
  if (days < 7) return `${days}d siden`
  return then.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

function diffMeta(id: string | null | undefined) {
  if (!id || !(id in DIFFICULTY_CONFIG)) return DIFFICULTY_CONFIG.rookie
  return DIFFICULTY_CONFIG[id as DifficultyId]
}

const hasMore = computed(() => {
  const t = leaderboard.value?.total ?? 0
  return offset.value + (leaderboard.value?.entries.length ?? 0) < t
})

const entries = computed(() => leaderboard.value?.entries ?? [])
const total = computed(() => leaderboard.value?.total ?? 0)

const diffFilters: { key: DiffFilter; label: string; color: string; icon: string }[] = [
  { key: 'all', label: 'Alle', color: '#FFFFFF', icon: 'mdi:view-list' },
  { key: 'rookie', label: 'Rookie', color: DIFFICULTY_CONFIG.rookie.color, icon: DIFFICULTY_CONFIG.rookie.icon },
  { key: 'viking', label: 'Viking', color: DIFFICULTY_CONFIG.viking.color, icon: DIFFICULTY_CONFIG.viking.icon },
  { key: 'impossible', label: 'Umulig', color: DIFFICULTY_CONFIG.impossible.color, icon: DIFFICULTY_CONFIG.impossible.icon },
  { key: 'legendary', label: 'Legend.', color: DIFFICULTY_CONFIG.legendary.color, icon: DIFFICULTY_CONFIG.legendary.icon },
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2 safe-top">
      <button
        class="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
        @click="router.back()"
      >
        <Icon name="mdi:arrow-left" size="20" />
      </button>
      <h1 class="font-heading font-bold text-xl text-white">Leaderboard</h1>
      <div class="w-10" />
    </div>

    <!-- Period tabs -->
    <div class="flex gap-2 px-4 py-2">
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

    <!-- Difficulty filter -->
    <div class="flex gap-1.5 px-4 pb-3 overflow-x-auto">
      <button
        v-for="f in diffFilters"
        :key="f.key"
        class="flex-shrink-0 px-3 py-1.5 rounded-full font-heading font-bold text-[10px] tracking-widest uppercase transition-all flex items-center gap-1 border"
        :class="activeDiff === f.key ? 'shadow-glow' : 'opacity-60 hover:opacity-100'"
        :style="activeDiff === f.key
          ? { color: f.color, borderColor: f.color, backgroundColor: `${f.color}22` }
          : { color: '#8A8F99', borderColor: '#2A2A35', backgroundColor: 'rgba(255,255,255,0.02)' }"
        @click="activeDiff = f.key"
      >
        <Icon :name="f.icon" size="10" />
        {{ f.label }}
      </button>
    </div>

    <!-- Results count -->
    <div v-if="entries.length > 0" class="px-4 pb-1">
      <p class="text-muted text-[11px] font-mono">
        Viser {{ offset + 1 }}–{{ offset + entries.length }} af {{ total.toLocaleString('da-DK') }}
      </p>
    </div>

    <!-- Leaderboard list -->
    <div class="flex-1 overflow-y-auto px-4 pb-6">
      <!-- Loading -->
      <div v-if="pending && entries.length === 0" class="text-center py-20">
        <Icon name="mdi:loading" size="36" class="text-muted/40 animate-spin mb-3" />
        <p class="text-muted font-body text-sm">Henter...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="entries.length === 0" class="text-center py-20">
        <Icon name="mdi:trophy-outline" size="48" class="text-muted/30 mb-4" />
        <p class="text-muted font-body">Ingen scores endnu på dette filter.</p>
        <NuxtLink
          to="/"
          class="inline-block mt-4 px-6 py-2.5 rounded-xl bg-accent text-primary font-heading font-semibold text-sm"
        >
          Vær den første!
        </NuxtLink>
      </div>

      <!-- Entries -->
      <div v-else class="space-y-2">
        <div
          v-for="(entry, index) in entries"
          :key="offset + index"
          class="glass rounded-xl p-3.5 flex items-center gap-3 transition-all hover:bg-white/5"
          :class="{ 'border border-accent/30 shadow-glow': offset + index < 3 }"
        >
          <!-- Rank -->
          <div class="w-10 text-center">
            <span v-if="offset + index === 0" class="text-2xl">🥇</span>
            <span v-else-if="offset + index === 1" class="text-2xl">🥈</span>
            <span v-else-if="offset + index === 2" class="text-2xl">🥉</span>
            <span v-else class="font-mono font-bold text-lg text-muted">#{{ offset + index + 1 }}</span>
          </div>

          <!-- Player info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="font-heading font-semibold text-white truncate">{{ entry.nickname }}</p>
              <span
                class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-heading font-bold tracking-widest uppercase flex-shrink-0"
                :style="{
                  color: diffMeta(entry.difficulty).color,
                  backgroundColor: `${diffMeta(entry.difficulty).color}20`,
                  borderColor: `${diffMeta(entry.difficulty).color}50`,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }"
              >
                <Icon :name="diffMeta(entry.difficulty).icon" size="8" />
                {{ diffMeta(entry.difficulty).label }}
              </span>
            </div>
            <p class="text-muted text-xs font-mono mt-0.5 flex items-center gap-2">
              <span>{{ entry.correct }}✓ · {{ entry.wrong }}✗</span>
              <span v-if="entry.playedAt" class="text-muted/60">· {{ timeAgo(entry.playedAt) }}</span>
            </p>
          </div>

          <!-- Score -->
          <div class="text-right flex-shrink-0">
            <p class="font-mono font-bold text-lg text-accent">{{ entry.score.toLocaleString('da-DK') }}</p>
            <p v-if="entry.bestStreak >= 3" class="text-xs text-muted">
              🔥 {{ entry.bestStreak }}
            </p>
          </div>
        </div>

        <!-- Load more -->
        <button
          v-if="hasMore"
          class="w-full py-3 rounded-xl glass text-muted hover:text-white font-heading text-sm transition-colors btn-press disabled:opacity-50"
          :disabled="pending"
          @click="loadMore"
        >
          <Icon v-if="pending" name="mdi:loading" size="16" class="animate-spin mr-1 inline" />
          Vis flere
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.safe-top {
  padding-top: max(1rem, env(safe-area-inset-top));
}
</style>
