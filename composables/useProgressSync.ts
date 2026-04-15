/**
 * DB-sync af achievements + collection.
 *
 * Strategi: klienten er source-of-truth under spillet. Ved hver unlock
 * flusher vi debouncet den fulde snapshot til serveren. Det er idempotent
 * (upserts med unique-indeks), så selv hvis et kald fejler rammer næste
 * succes alt det tidligere også.
 *
 * Ved login henter vi server-state og merger ind i lokal state —
 * så brugeren genvinder progression på nye browsere/devices.
 */

const DEBOUNCE_MS = 2000

export const useProgressSync = () => {
  const { state: gameState } = useGame()

  let pushTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Flush lokal state til server. Debounced — flere unlocks tæt på hinanden
   * triggerer kun én request.
   */
  function schedulePush() {
    if (!import.meta.client) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(pushNow, DEBOUNCE_MS)
  }

  async function pushNow() {
    if (!import.meta.client) return
    const nickname = gameState.value.nickname
    if (!nickname || nickname.length < 2) return

    // Læs direkte fra localStorage så vi altid sender den nyeste state,
    // selv hvis composables ikke er mounted lige nu.
    let achievements: string[] = []
    let collection: number[] = []

    try {
      const rawAch = localStorage.getItem('erdetlars_achievements_v2')
      if (rawAch) {
        const parsed = JSON.parse(rawAch)
        if (Array.isArray(parsed?.unlocked)) achievements = parsed.unlocked
      }
    } catch {}

    try {
      const rawCol = localStorage.getItem('erdetlars_collection')
      if (rawCol) {
        const parsed = JSON.parse(rawCol)
        if (parsed && typeof parsed === 'object') {
          collection = Object.keys(parsed).map(k => Number(k)).filter(n => Number.isInteger(n) && n > 0)
        }
      }
    } catch {}

    if (achievements.length === 0 && collection.length === 0) return

    try {
      await $fetch('/api/progress/sync', {
        method: 'POST',
        body: { nickname, achievements, collection },
      })
    } catch (err) {
      // Fail-silent — klienten er kilden, DB er bare backup
      console.warn('Progress sync failed (vil retry ved næste unlock):', err)
    }
  }

  /**
   * Hent server-state og returner den — caller skal merge ind i
   * egne lokale stores. Bruges typisk ved første nickname-setup
   * eller når brugeren eksplicit trykker "gendan".
   */
  async function pullFromServer(nickname: string): Promise<{ achievements: string[]; collection: number[] }> {
    if (!import.meta.client || !nickname || nickname.length < 2) {
      return { achievements: [], collection: [] }
    }
    try {
      const data = await $fetch<{ achievements: string[]; collection: { id: number; at: string | null }[] }>(
        `/api/progress/${encodeURIComponent(nickname)}`,
      )
      return {
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        collection: Array.isArray(data.collection) ? data.collection.map(c => c.id) : [],
      }
    } catch (err) {
      console.warn('Progress pull failed:', err)
      return { achievements: [], collection: [] }
    }
  }

  return {
    schedulePush,
    pushNow,
    pullFromServer,
  }
}
