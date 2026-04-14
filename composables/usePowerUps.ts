import type { PowerUpType } from '~/composables/useAchievements'

export interface PowerUpDef {
  type: PowerUpType
  name: string
  description: string
  icon: string
  color: string  // tailwind class color
  glowColor: string  // rgba for glow
}

export const POWERUP_DEFS: Record<PowerUpType, PowerUpDef> = {
  hint: {
    type: 'hint',
    name: "Jim's Hint",
    description: 'Zoomer ind på kortet i 2 sek',
    icon: 'mdi:magnify-plus',
    color: 'text-[#6AACDB]',
    glowColor: 'rgba(106, 172, 219, 0.4)',
  },
  shield: {
    type: 'shield',
    name: 'Streak Shield',
    description: 'Næste fejl brækker ikke din streak',
    icon: 'mdi:shield-plus',
    color: 'text-success',
    glowColor: 'rgba(0, 214, 143, 0.4)',
  },
  double: {
    type: 'double',
    name: 'Double Down',
    description: '2x point på næste kort',
    icon: 'mdi:star-shooting',
    color: 'text-accent',
    glowColor: 'rgba(245, 166, 35, 0.4)',
  },
  skip: {
    type: 'skip',
    name: 'Skip',
    description: 'Spring kortet over',
    icon: 'mdi:skip-next',
    color: 'text-muted',
    glowColor: 'rgba(136, 146, 160, 0.4)',
  },
}

const STORAGE_KEY = 'erdetlars_powerups_bank'

export const usePowerUps = () => {
  // Persistent bank — accumulated from achievement rewards
  const bank = useState<Record<PowerUpType, number>>('powerup_bank', () => ({
    hint: 0, shield: 0, double: 0, skip: 0,
  }))

  // Per-session inventory: starts = bank, grows with in-game streaks
  const inventory = useState<Record<PowerUpType, number>>('powerup_inventory', () => ({
    hint: 0, shield: 0, double: 0, skip: 0,
  }))

  // Active effects during next answer
  const activeEffects = useState<Record<'shield' | 'double', boolean>>('powerup_active', () => ({
    shield: false,
    double: false,
  }))

  // Ephemeral UI state
  const hintActive = useState<boolean>('powerup_hint_active', () => false)
  const recentlyEarned = useState<PowerUpType | null>('powerup_earned', () => null)

  function loadBank() {
    if (!import.meta.client) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) bank.value = { ...bank.value, ...JSON.parse(saved) }
    } catch {}
  }
  function saveBank() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bank.value))
    } catch {}
  }

  /** Start a new session: inventory = bank + session rewards. */
  function startSession() {
    inventory.value = { ...bank.value }
    activeEffects.value = { shield: false, double: false }
    hintActive.value = false
  }

  /** Award power-up (from achievements, streak rewards). Stored in bank, appears immediately in session. */
  function award(type: PowerUpType | 'all', animate = true) {
    if (type === 'all') {
      (['hint', 'shield', 'double', 'skip'] as PowerUpType[]).forEach(t => {
        bank.value[t]++
        inventory.value[t]++
      })
      saveBank()
      return
    }
    bank.value[type]++
    inventory.value[type]++
    saveBank()
    if (animate) {
      recentlyEarned.value = type
      setTimeout(() => {
        if (recentlyEarned.value === type) recentlyEarned.value = null
      }, 1800)
    }
  }

  /** Award random power-up (used for streak rewards every 5 correct). */
  function awardRandom() {
    const pool: PowerUpType[] = ['hint', 'shield', 'double', 'skip']
    const pick = pool[Math.floor(Math.random() * pool.length)]
    award(pick)
    return pick
  }

  /** Use a power-up. Returns true if successful. */
  function use(type: PowerUpType): boolean {
    if (inventory.value[type] <= 0) return false
    inventory.value[type]--
    // Also deplete from bank (canonical source)
    if (bank.value[type] > 0) bank.value[type]--
    saveBank()

    // Apply effect
    if (type === 'hint') {
      hintActive.value = true
      setTimeout(() => { hintActive.value = false }, 2000)
    } else if (type === 'shield') {
      activeEffects.value.shield = true
    } else if (type === 'double') {
      activeEffects.value.double = true
    }
    // skip = no internal effect; caller handles it
    return true
  }

  /** Consume "shield" flag when a wrong answer happens. Returns true if consumed. */
  function consumeShield(): boolean {
    if (!activeEffects.value.shield) return false
    activeEffects.value.shield = false
    return true
  }

  /** Consume "double" flag when an answer happens. Returns 2 if active, else 1. */
  function consumeDouble(): number {
    if (!activeEffects.value.double) return 1
    activeEffects.value.double = false
    return 2
  }

  const total = computed(() =>
    inventory.value.hint + inventory.value.shield + inventory.value.double + inventory.value.skip,
  )

  if (import.meta.client) loadBank()

  return {
    bank,
    inventory,
    activeEffects,
    hintActive,
    recentlyEarned,
    total,
    startSession,
    award,
    awardRandom,
    use,
    consumeShield,
    consumeDouble,
  }
}
