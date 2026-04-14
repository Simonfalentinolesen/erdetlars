import achievementsData from '~/data/achievements.json'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legendary'
export type PowerUpType = 'hint' | 'shield' | 'double' | 'skip'

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  tier: AchievementTier
  hidden?: boolean
  reward: { type: 'powerup'; value: PowerUpType | 'all' }
  condition: { type: string; value: number }
}

export interface AchievementState {
  unlocked: string[]
  pranksSurvived: number
  factsRead: number
  fooled: number
  powerupsUsed: Record<PowerUpType, number>
  drunkMaxReached: boolean
  speedCorrectBest: number  // ms for 10 correct in a row
  _speedCorrectStart: number  // internal: session-local timestamp when last streak started
}

const STORAGE_KEY = 'erdetlars_achievements_v2'

const ALL_ACHIEVEMENTS = achievementsData.achievements as AchievementDef[]

export const useAchievements = () => {
  const progress = useState<AchievementState>('achievements_progress', () => ({
    unlocked: [],
    pranksSurvived: 0,
    factsRead: 0,
    fooled: 0,
    powerupsUsed: { hint: 0, shield: 0, double: 0, skip: 0 },
    drunkMaxReached: false,
    speedCorrectBest: 999999,
    _speedCorrectStart: 0,
  }))

  // Queue of recently unlocked achievements — consumed by UI for toasts
  const pendingToasts = useState<AchievementDef[]>('achievement_pending', () => [])

  function load() {
    if (!import.meta.client) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) progress.value = { ...progress.value, ...JSON.parse(saved) }
    } catch {}
  }

  function save() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress.value))
    } catch {}
  }

  function isUnlocked(id: string): boolean {
    return progress.value.unlocked.includes(id)
  }

  function unlock(id: string) {
    if (isUnlocked(id)) return
    const def = ALL_ACHIEVEMENTS.find(a => a.id === id)
    if (!def) return
    progress.value.unlocked.push(id)
    pendingToasts.value.push(def)
    save()
  }

  /** Check all unlock conditions against provided context */
  function checkAll(ctx: {
    totalCorrect: number
    streak: number
    bestStreak: number
    totalRounds: number
    collectionCount: number
    collectionTotal: number
    mythicalCount: number
  }) {
    for (const a of ALL_ACHIEVEMENTS) {
      if (isUnlocked(a.id)) continue
      const c = a.condition
      let met = false
      switch (c.type) {
        case 'total_correct':
          met = ctx.totalCorrect >= c.value
          break
        case 'streak':
          met = ctx.streak >= c.value || ctx.bestStreak >= c.value
          break
        case 'total_rounds':
          met = ctx.totalRounds >= c.value
          break
        case 'pranks_survived':
          met = progress.value.pranksSurvived >= c.value
          break
        case 'facts_read':
          met = progress.value.factsRead >= c.value
          break
        case 'fooled':
          met = progress.value.fooled >= c.value
          break
        case 'collection_count':
          met = ctx.collectionCount >= c.value
          break
        case 'collection_complete':
          met = ctx.collectionCount >= ctx.collectionTotal && ctx.collectionTotal > 0
          break
        case 'mythical_count':
          met = ctx.mythicalCount >= c.value
          break
        case 'powerups_used_all':
          met = Object.values(progress.value.powerupsUsed).every(v => v > 0)
          break
        case 'drunk_max':
          met = progress.value.drunkMaxReached
          break
        case 'night_play': {
          const h = new Date().getHours()
          met = h >= 2 && h < 5
          break
        }
        case 'speed_correct':
          met = progress.value.speedCorrectBest <= c.value
          break
      }
      if (met) unlock(a.id)
    }
  }

  // --- Incremental trackers ---
  function recordPrankSurvived() {
    progress.value.pranksSurvived++
    save()
  }

  function recordFactRead() {
    progress.value.factsRead++
    save()
  }

  function recordFooled() {
    progress.value.fooled++
    save()
  }

  function recordPowerUpUsed(type: PowerUpType) {
    progress.value.powerupsUsed[type]++
    save()
  }

  function recordDrunkMax() {
    progress.value.drunkMaxReached = true
    save()
  }

  /** Call each correct answer. When 10 correct in a row have elapsed quickly, updates best. */
  function recordCorrectAnswer(currentStreak: number) {
    const now = Date.now()
    if (currentStreak === 1) {
      progress.value._speedCorrectStart = now
    } else if (currentStreak === 10 && progress.value._speedCorrectStart > 0) {
      const elapsed = now - progress.value._speedCorrectStart
      if (elapsed < progress.value.speedCorrectBest) {
        progress.value.speedCorrectBest = elapsed
      }
      save()
    }
  }

  function resetStreakTimer() {
    progress.value._speedCorrectStart = 0
  }

  function consumeToast(): AchievementDef | null {
    if (pendingToasts.value.length === 0) return null
    return pendingToasts.value.shift() || null
  }

  const allAchievements = computed(() =>
    ALL_ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: isUnlocked(a.id),
    })),
  )

  const unlockedCount = computed(() => progress.value.unlocked.length)
  const totalCount = computed(() => ALL_ACHIEVEMENTS.length)

  if (import.meta.client) load()

  return {
    progress,
    pendingToasts,
    allAchievements,
    unlockedCount,
    totalCount,
    isUnlocked,
    unlock,
    checkAll,
    recordPrankSurvived,
    recordFactRead,
    recordFooled,
    recordPowerUpUsed,
    recordDrunkMax,
    recordCorrectAnswer,
    resetStreakTimer,
    consumeToast,
  }
}
