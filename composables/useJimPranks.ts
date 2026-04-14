export type PrankType = 'button-swap' | 'blur' | 'dalmatian' | 'jim-rant' | 'upside-down'

export interface PrankDef {
  type: PrankType
  duration: number  // ms
  preQuote: string
  postQuote: string
}

const PRANK_DEFS: Record<PrankType, PrankDef> = {
  'button-swap': {
    type: 'button-swap',
    duration: 4000,
    preQuote: 'Lars, pas på...',
    postQuote: 'HA! Knapperne var byttet!',
  },
  'blur': {
    type: 'blur',
    duration: 2000,
    preQuote: 'Ups, Lars!',
    postQuote: 'Var det for sløret? HA!',
  },
  'dalmatian': {
    type: 'dalmatian',
    duration: 1800,
    preQuote: 'VENT! Hunden!',
    postQuote: 'Min dalmatiner siger hej!',
  },
  'jim-rant': {
    type: 'jim-rant',
    duration: 3000,
    preQuote: 'LYT!',
    postQuote: 'Tak for din tid, kriger.',
  },
  'upside-down': {
    type: 'upside-down',
    duration: 2500,
    preQuote: 'Lars står på hovedet!',
    postQuote: 'Verden vender tilbage.',
  },
}

const SETTINGS_KEY = 'erdetlars_jim_pranks_enabled'

export const useJimPranks = () => {
  const activePrank = useState<PrankDef | null>('jim_active_prank', () => null)
  const prankQuote = useState<string>('jim_prank_quote', () => '')
  const prankCount = useState<number>('jim_prank_count', () => 0)  // session counter
  const enabled = useState<boolean>('jim_prank_enabled', () => true)

  function loadSettings() {
    if (!import.meta.client) return
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved !== null) enabled.value = saved === 'true'
  }

  function saveSettings() {
    if (!import.meta.client) return
    localStorage.setItem(SETTINGS_KEY, String(enabled.value))
  }

  function toggle() {
    enabled.value = !enabled.value
    saveSettings()
  }

  /** Maybe trigger a prank. Call after each answer (not during).
   * Returns prank definition if triggered, else null.
   */
  function maybeTrigger(answerCount: number, chance = 0.06): PrankDef | null {
    if (!enabled.value) return null
    if (answerCount < 10) return null  // warm up
    if (activePrank.value) return null
    if (Math.random() > chance) return null

    const types = Object.keys(PRANK_DEFS) as PrankType[]
    const pick = types[Math.floor(Math.random() * types.length)]
    const def = PRANK_DEFS[pick]
    activePrank.value = def
    prankQuote.value = def.preQuote
    prankCount.value++

    // Auto-expire
    setTimeout(() => {
      if (activePrank.value === def) {
        prankQuote.value = def.postQuote
        setTimeout(() => {
          activePrank.value = null
          prankQuote.value = ''
        }, 1400)
      }
    }, def.duration)

    return def
  }

  function dismiss() {
    activePrank.value = null
    prankQuote.value = ''
  }

  if (import.meta.client) loadSettings()

  return {
    activePrank,
    prankQuote,
    prankCount,
    enabled,
    toggle,
    maybeTrigger,
    dismiss,
  }
}
