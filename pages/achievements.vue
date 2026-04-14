<script setup lang="ts">
import type { AchievementTier } from '~/composables/useAchievements'

const router = useRouter()
const { allAchievements, unlockedCount, totalCount, progress } = useAchievements()

type FilterMode = 'all' | 'unlocked' | 'locked'
const filter = ref<FilterMode>('all')

const filtered = computed(() => {
  switch (filter.value) {
    case 'unlocked': return allAchievements.value.filter(a => a.unlocked)
    case 'locked': return allAchievements.value.filter(a => !a.unlocked && !a.hidden)
    default: return allAchievements.value.filter(a => a.unlocked || !a.hidden)
  }
})

function tierConfig(tier: AchievementTier) {
  switch (tier) {
    case 'bronze': return { color: '#CD7F32', label: 'BRONZE', glow: 'rgba(205, 127, 50, 0.5)' }
    case 'silver': return { color: '#C0C0C0', label: 'SØLV', glow: 'rgba(192, 192, 192, 0.5)' }
    case 'gold': return { color: '#F5A623', label: 'GULD', glow: 'rgba(245, 166, 35, 0.5)' }
    case 'legendary': return { color: '#E84393', label: 'LEGENDARISK', glow: 'rgba(232, 67, 147, 0.7)' }
  }
}

const hiddenUnlockedCount = computed(() =>
  allAchievements.value.filter(a => a.hidden && a.unlocked).length,
)
const hiddenTotal = computed(() =>
  allAchievements.value.filter(a => a.hidden).length,
)

const completionPct = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((unlockedCount.value / totalCount.value) * 100),
)
</script>

<template>
  <div class="min-h-screen pb-8">
    <!-- Header -->
    <div class="sticky top-0 z-20 bg-primary/95 backdrop-blur-md border-b border-white/5">
      <div class="flex items-center justify-between px-4 pt-4 pb-3 safe-top">
        <button
          class="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
          @click="router.back()"
        >
          <Icon name="mdi:arrow-left" size="20" />
        </button>
        <h1 class="font-heading font-bold text-xl text-white">Trofæer</h1>
        <div class="w-10" />
      </div>

      <!-- Progress -->
      <div class="px-4 pb-3">
        <div class="glass rounded-2xl p-4">
          <div class="flex items-baseline justify-between mb-2">
            <div>
              <p class="text-[10px] font-heading font-bold text-muted tracking-widest uppercase">
                Dine trofæer
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

          <div class="h-2 bg-surface/80 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-[#CD7F32] via-accent to-pink-accent rounded-full transition-all duration-700"
              :style="{ width: `${completionPct}%` }"
            />
          </div>

          <!-- Skjulte trofæer hint -->
          <div v-if="hiddenTotal > 0" class="mt-3 flex items-center gap-2 text-xs">
            <Icon name="mdi:help-circle-outline" size="14" class="text-muted" />
            <span class="text-muted text-[11px] font-mono">
              {{ hiddenUnlockedCount }} skjulte af {{ hiddenTotal }} opdaget
            </span>
          </div>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="px-4 pb-3">
        <div class="flex gap-2">
          <button
            v-for="tab in [
              { id: 'all' as const, label: 'Alle' },
              { id: 'unlocked' as const, label: 'Låst op' },
              { id: 'locked' as const, label: 'Mangler' },
            ]"
            :key="tab.id"
            class="flex-1 px-3.5 py-1.5 rounded-full font-heading text-xs font-bold tracking-wide transition-all btn-press"
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

    <!-- Trophy grid -->
    <div class="px-3 pt-3">
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div
          v-for="achievement in filtered"
          :key="achievement.id"
          class="glass rounded-2xl p-3.5 text-center transition-all relative overflow-hidden"
          :class="{
            'locked-trophy': !achievement.unlocked,
          }"
          :style="{
            borderColor: achievement.unlocked ? tierConfig(achievement.tier).color : 'rgba(255,255,255,0.06)',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            boxShadow: achievement.unlocked ? `0 0 18px ${tierConfig(achievement.tier).glow}` : 'none',
          }"
        >
          <!-- Tier ribbon at top -->
          <div
            v-if="achievement.unlocked"
            class="absolute top-0 inset-x-0 h-5 flex items-center justify-center"
            :style="{ background: `linear-gradient(90deg, ${tierConfig(achievement.tier).glow} 0%, transparent 100%)` }"
          >
            <span
              class="text-[8px] font-heading font-bold tracking-widest"
              :style="{ color: tierConfig(achievement.tier).color }"
            >
              {{ tierConfig(achievement.tier).label }}
            </span>
          </div>

          <!-- Medal -->
          <div class="mt-5 mb-2">
            <div
              class="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
              :style="{
                background: achievement.unlocked
                  ? `linear-gradient(135deg, ${tierConfig(achievement.tier).color}33 0%, ${tierConfig(achievement.tier).color}11 100%)`
                  : 'rgba(255,255,255,0.05)',
                border: achievement.unlocked
                  ? `2px solid ${tierConfig(achievement.tier).color}`
                  : '2px dashed rgba(255,255,255,0.1)',
              }"
            >
              <Icon
                :name="achievement.unlocked ? achievement.icon : 'mdi:lock'"
                size="26"
                :style="{ color: achievement.unlocked ? tierConfig(achievement.tier).color : 'rgba(255,255,255,0.2)' }"
              />
            </div>
          </div>

          <p
            class="font-heading font-bold text-sm mb-1 leading-tight"
            :class="achievement.unlocked ? 'text-white' : 'text-muted/60'"
          >
            {{ achievement.unlocked ? achievement.name : '???' }}
          </p>
          <p
            class="text-[10px] font-body leading-tight"
            :class="achievement.unlocked ? 'text-muted' : 'text-muted/50'"
          >
            {{ achievement.description }}
          </p>

          <!-- Reward hint -->
          <div
            v-if="achievement.unlocked"
            class="mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-1"
          >
            <Icon name="mdi:gift" size="10" class="text-accent/70" />
            <span class="text-[9px] font-mono text-accent/70 uppercase tracking-widest">
              Power-up
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats footer -->
    <div class="px-4 pt-6">
      <div class="glass rounded-2xl p-4">
        <p class="text-[10px] font-heading font-bold text-muted tracking-widest uppercase mb-3 text-center">
          Progress
        </p>
        <div class="grid grid-cols-2 gap-3 text-center">
          <div>
            <p class="font-mono font-bold text-xl text-white tabular-nums">{{ progress.pranksSurvived }}</p>
            <p class="text-[9px] text-muted font-mono uppercase tracking-widest">Pranks overlevet</p>
          </div>
          <div>
            <p class="font-mono font-bold text-xl text-white tabular-nums">{{ progress.factsRead }}</p>
            <p class="text-[9px] text-muted font-mono uppercase tracking-widest">Jim-facts læst</p>
          </div>
          <div>
            <p class="font-mono font-bold text-xl text-white tabular-nums">{{ progress.fooled }}</p>
            <p class="text-[9px] text-muted font-mono uppercase tracking-widest">Gange snydt</p>
          </div>
          <div>
            <p class="font-mono font-bold text-xl text-white tabular-nums">
              {{ Object.values(progress.powerupsUsed).reduce((a, b) => a + b, 0) }}
            </p>
            <p class="text-[9px] text-muted font-mono uppercase tracking-widest">Power-ups brugt</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.safe-top {
  padding-top: max(1rem, env(safe-area-inset-top));
}
.locked-trophy {
  opacity: 0.55;
}
</style>
