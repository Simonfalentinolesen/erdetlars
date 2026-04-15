/**
 * Client-only plugin: ved appens start henter vi server-progression
 * for det gemte nickname og merger det ind i lokal state.
 *
 * Formål:
 * 1. Cross-device restore — brugeren åbner sitet på mobil efter at have spillet på desktop
 * 2. Restore efter localStorage-clear — browser cache tømt, men nickname kendt via URL/input
 *
 * Merge er additivt — lokale unlocks bevares og suppleres med server-side dem.
 * Hvis serverens DB er nede eller nickname ikke har data, fail-silent.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const { state } = useGame()
  const { mergeFromServer: mergeCollection } = useCollection()
  const { mergeFromServer: mergeAchievements } = useAchievements()
  const { pullFromServer } = useProgressSync()

  // Kør efter hydration så localStorage er læst først
  onNuxtReady(async () => {
    const nickname = state.value.nickname
    if (!nickname || nickname.length < 2) return

    const remote = await pullFromServer(nickname)
    if (remote.achievements.length > 0) mergeAchievements(remote.achievements)
    if (remote.collection.length > 0) mergeCollection(remote.collection)
  })
})
