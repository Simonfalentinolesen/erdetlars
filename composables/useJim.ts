import jimData from '~/data/jim-quotes.json'

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const useJim = () => {
  function getGameplayQuote(): string {
    return pickRandom(jimData.gameplay)
  }

  function getCorrectQuote(): string {
    return pickRandom(jimData.correct)
  }

  function getWrongQuote(): string {
    return pickRandom(jimData.wrong)
  }

  function getResultQuote(score: number, isPerfect: boolean): string {
    if (isPerfect) return pickRandom(jimData.results.perfect)
    if (score >= 800) return pickRandom(jimData.results.high)
    if (score >= 400) return pickRandom(jimData.results.medium)
    return pickRandom(jimData.results.low)
  }

  function getIdleQuote(): string {
    return pickRandom(jimData.idle)
  }

  function getMinigameQuote(game: 'porsche_dash' | 'fuld_lars' | 'viking_lars'): string {
    return pickRandom(jimData.minigame[game])
  }

  // Should Jim appear? (probability-based)
  function shouldJimAppear(chance: number = 0.3): boolean {
    return Math.random() < chance
  }

  return {
    getGameplayQuote,
    getCorrectQuote,
    getWrongQuote,
    getResultQuote,
    getIdleQuote,
    getMinigameQuote,
    shouldJimAppear,
  }
}
