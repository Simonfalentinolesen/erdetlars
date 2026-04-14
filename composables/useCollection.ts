import imageData from '~/data/images.json'
import type { GameImage } from '~/composables/useGame'

export type Rarity = 'common' | 'rare' | 'mythical'

export interface CollectionCard extends GameImage {
  rarity: Rarity
  unlocked: boolean
  firstUnlockedAt?: number
}

const STORAGE_KEY = 'erdetlars_collection'

function getRarity(img: GameImage): Rarity {
  if (img.type === 'video') return 'mythical'
  if (!img.isLars) return 'rare' // lookalikes are rarer (tricky to spot)
  return 'common'
}

export const useCollection = () => {
  // Unlocked image IDs + timestamps
  const unlockedMap = useState<Record<number, number>>('collection_unlocked', () => ({}))
  const recentUnlocks = useState<number[]>('collection_recent', () => [])

  function load() {
    if (!import.meta.client) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        unlockedMap.value = JSON.parse(saved)
      }
    } catch {}
  }

  function save() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedMap.value))
    } catch {}
  }

  /** Unlock a card by imageId. Returns true if newly unlocked. */
  function unlock(imageId: number): boolean {
    if (unlockedMap.value[imageId]) return false
    unlockedMap.value = { ...unlockedMap.value, [imageId]: Date.now() }
    recentUnlocks.value = [imageId, ...recentUnlocks.value].slice(0, 10)
    save()
    return true
  }

  function isUnlocked(imageId: number): boolean {
    return !!unlockedMap.value[imageId]
  }

  /** Get all cards with unlock status + rarity */
  const allCards = computed<CollectionCard[]>(() => {
    return (imageData.images as GameImage[]).map(img => ({
      ...img,
      rarity: getRarity(img),
      unlocked: isUnlocked(img.id),
      firstUnlockedAt: unlockedMap.value[img.id],
    }))
  })

  const unlockedCount = computed(() => allCards.value.filter(c => c.unlocked).length)
  const totalCount = computed(() => allCards.value.length)

  const mythicalUnlocked = computed(() =>
    allCards.value.filter(c => c.rarity === 'mythical' && c.unlocked).length,
  )

  const completionPct = computed(() =>
    totalCount.value === 0 ? 0 : Math.round((unlockedCount.value / totalCount.value) * 100),
  )

  function consumeRecentUnlocks(): number[] {
    const list = [...recentUnlocks.value]
    recentUnlocks.value = []
    return list
  }

  function reset() {
    unlockedMap.value = {}
    recentUnlocks.value = []
    save()
  }

  if (import.meta.client) load()

  return {
    allCards,
    unlockedCount,
    totalCount,
    mythicalUnlocked,
    completionPct,
    unlock,
    isUnlocked,
    consumeRecentUnlocks,
    reset,
  }
}
