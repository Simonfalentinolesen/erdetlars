/**
 * Minigame cross-promotion system.
 * Picks rotating minigames to "advertise" during gameplay,
 * with Jim-style ad copy. Tracks dismissals so we don't spam.
 */

export type MinigameId = 'porsche-dash' | 'fuld-lars' | 'viking-lars'

export interface MinigamePromo {
  id: MinigameId
  title: string
  tagline: string         // one-liner teaser
  adCopy: string          // Jim-style pitch
  bulletPoints: string[]  // for interstitial/result cards
  icon: string            // mdi icon
  emoji: string           // emoji fallback / accent
  accentColor: string     // hex
  glowColor: string       // rgba
  gradientFrom: string
  gradientTo: string
  path: string
}

const MINIGAMES: MinigamePromo[] = [
  {
    id: 'porsche-dash',
    title: "Lars' Porsche Dash",
    tagline: 'Ræs som en pensioneret rockstjerne.',
    adCopy: 'Lars sidder bag rattet i sin mest patetiske Porsche. Det er dit job at undgå vikinger og samle øl. Han klarer det ikke alene. Du skal hjælpe.',
    bulletPoints: [
      'Saml øl uden at miste respekten',
      'Undvig vikingerne i rundkørslen',
      'Jim råber fra passagersædet',
    ],
    icon: 'mdi:car-sports',
    emoji: '🏎️',
    accentColor: '#F5A623',
    glowColor: 'rgba(245, 166, 35, 0.45)',
    gradientFrom: '#F5A62322',
    gradientTo: '#F5A62308',
    path: '/minigames/porsche-dash',
  },
  {
    id: 'fuld-lars',
    title: 'Fuld Lars',
    tagline: 'Flap mellem ølkasserne. Det er kunst.',
    adCopy: 'Lars er stiv som et bræt og prøver at komme forbi et uendeligt felt af ølkasser. Han kan ikke flyve alene. Du holder ham oppe.',
    bulletPoints: [
      'Tap for at flappe — ikke holde',
      'Stiv Lars flyver sjældent pænt',
      'Highscore tæller for LIVE STÆR',
    ],
    icon: 'mdi:beer',
    emoji: '🍺',
    accentColor: '#00D68F',
    glowColor: 'rgba(0, 214, 143, 0.45)',
    gradientFrom: '#00D68F22',
    gradientTo: '#00D68F08',
    path: '/minigames/fuld-lars',
  },
  {
    id: 'viking-lars',
    title: 'Viking Lars',
    tagline: 'Platformer med power-ups og Valhalla.',
    adCopy: 'Lars er endelig blevet til den viking han altid har drømt om at være. Nu skal han gennem 6 levels, slå Jim-Loke og komme til Valhalla. Uden dig dør han på side 1.',
    bulletPoints: [
      '6 levels med hver sin chef',
      'Power-ups: Øl-Lars, Viking-Lars, Regnbue-Lars',
      'Jim Lyngvild er skurken',
    ],
    icon: 'mdi:shield-sword',
    emoji: '⚔️',
    accentColor: '#E84393',
    glowColor: 'rgba(232, 67, 147, 0.45)',
    gradientFrom: '#E8439322',
    gradientTo: '#E8439308',
    path: '/minigames/viking-lars',
  },
]

/** Jim-style ad break headlines, rotating. */
const AD_BREAK_HEADLINES = [
  'Reklame-pause, Lars.',
  'Jim afbryder — det er vigtigt.',
  'Stop. Se her. Respekt.',
  'Én ting. Så lover jeg at stoppe.',
  'Lars. Du fortjener en pause.',
]

const AD_BREAK_SUBS = [
  'Spil det. Eller lad være. Jeg bestemmer ikke.',
  'Det tager 2 minutter. Maks 3.',
  'Ingen Lars-ånd i reklamer, det ved jeg godt.',
  'Det er faktisk ret sjovt. Ikke så sjovt som mig.',
]

/** LocalStorage keys */
const LS_LAST_SHOWN = 'erdetlars_minigame_promo_last'
const LS_DISMISSED = 'erdetlars_minigame_promo_dismiss_count'

interface PromoState {
  rotation: number
  totalShown: number
  dismissedInRow: number
}

const PROMO_STATE_KEY = 'minigamePromoState'

export function useMinigamePromo() {
  const state = useState<PromoState>(PROMO_STATE_KEY, () => ({
    rotation: 0,
    totalShown: 0,
    dismissedInRow: 0,
  }))

  // Hydrate from localStorage on client
  if (import.meta.client && state.value.totalShown === 0) {
    try {
      const stored = localStorage.getItem(LS_LAST_SHOWN)
      if (stored) {
        state.value.rotation = Number(stored) || 0
      }
      const dismissed = localStorage.getItem(LS_DISMISSED)
      if (dismissed) {
        state.value.dismissedInRow = Number(dismissed) || 0
      }
    } catch {}
  }

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(LS_LAST_SHOWN, String(state.value.rotation))
      localStorage.setItem(LS_DISMISSED, String(state.value.dismissedInRow))
    } catch {}
  }

  /** Pick a rotating minigame, avoiding the last one shown. */
  function pickNext(): MinigamePromo {
    const idx = state.value.rotation % MINIGAMES.length
    state.value.rotation++
    state.value.totalShown++
    persist()
    return MINIGAMES[idx]!
  }

  /** Pick a specific minigame, e.g. for result-page tailoring. */
  function pickById(id: MinigameId): MinigamePromo | null {
    return MINIGAMES.find(m => m.id === id) ?? null
  }

  /** Pick a random minigame — useful for result page. */
  function pickRandom(): MinigamePromo {
    const idx = Math.floor(Math.random() * MINIGAMES.length)
    return MINIGAMES[idx]!
  }

  /** Get all minigames (for grid displays). */
  function getAll(): MinigamePromo[] {
    return MINIGAMES
  }

  /** Get an ad-break headline+sub (random). */
  function getAdBreakCopy() {
    return {
      headline: AD_BREAK_HEADLINES[Math.floor(Math.random() * AD_BREAK_HEADLINES.length)]!,
      sub: AD_BREAK_SUBS[Math.floor(Math.random() * AD_BREAK_SUBS.length)]!,
    }
  }

  /**
   * Should we show a teaser right now?
   * Called after each answer. Returns the promo or null.
   *
   * Rules:
   * - Never in the first 8 answers (let them settle in)
   * - Every 12 answers: light teaser
   * - If dismissed 2+ in a row, back off (double interval to 24)
   */
  function shouldShowTeaser(answerCount: number): MinigamePromo | null {
    if (answerCount < 8) return null
    const interval = state.value.dismissedInRow >= 2 ? 24 : 12
    if (answerCount % interval !== 0) return null
    return pickNext()
  }

  /**
   * Should we show a full interstitial ad-break?
   * Called after each answer. Less frequent than teaser.
   *
   * Rules:
   * - Never in first 20 answers
   * - Every 30 answers OR at streak milestone (10, 20)
   */
  function shouldShowInterstitial(answerCount: number, streak: number): MinigamePromo | null {
    if (answerCount < 20) return null
    const onInterval = answerCount % 30 === 0
    const onStreak = streak > 0 && streak % 10 === 0
    if (!onInterval && !onStreak) return null
    return pickNext()
  }

  function markTeaserDismissed() {
    state.value.dismissedInRow++
    persist()
  }

  function markTeaserClicked() {
    state.value.dismissedInRow = 0
    persist()
  }

  return {
    pickNext,
    pickById,
    pickRandom,
    getAll,
    getAdBreakCopy,
    shouldShowTeaser,
    shouldShowInterstitial,
    markTeaserDismissed,
    markTeaserClicked,
  }
}
