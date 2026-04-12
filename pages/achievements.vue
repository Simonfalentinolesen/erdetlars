<script setup lang="ts">
import achievementsData from '~/data/achievements.json'

const router = useRouter()
const { state } = useGame()

// For now, achievements are tracked in localStorage
const unlockedAchievements = ref<string[]>([])

onMounted(() => {
  const saved = localStorage.getItem('erdetlars_achievements')
  if (saved) unlockedAchievements.value = JSON.parse(saved)
})

const achievements = computed(() => {
  return achievementsData.achievements.map(a => ({
    ...a,
    unlocked: unlockedAchievements.value.includes(a.id),
  }))
})

const unlockedCount = computed(() => achievements.value.filter(a => a.unlocked).length)
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
      <h1 class="font-heading font-bold text-xl text-white">Achievements</h1>
      <div class="w-10" />
    </div>

    <!-- Progress -->
    <div class="px-4 py-3">
      <div class="glass rounded-xl p-4 text-center">
        <p class="font-mono font-bold text-2xl text-accent">{{ unlockedCount }}/{{ achievements.length }}</p>
        <div class="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
          <div
            class="h-full bg-accent rounded-full transition-all duration-500"
            :style="{ width: `${(unlockedCount / achievements.length) * 100}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Achievement grid -->
    <div class="flex-1 overflow-y-auto px-4 pb-6">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="achievement in achievements"
          :key="achievement.id"
          class="glass rounded-xl p-4 text-center transition-all"
          :class="achievement.unlocked ? 'border border-accent/30' : 'opacity-50 grayscale'"
        >
          <div class="mb-2">
            <Icon
              :name="achievement.icon"
              size="36"
              :class="achievement.unlocked ? 'text-accent' : 'text-muted'"
            />
          </div>
          <p class="font-heading font-bold text-sm text-white mb-1">{{ achievement.name }}</p>
          <p class="text-muted text-xs font-body">{{ achievement.description }}</p>
          <div v-if="!achievement.unlocked" class="mt-2">
            <Icon name="mdi:lock" size="14" class="text-muted/50" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
