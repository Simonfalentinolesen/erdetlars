import { eq } from 'drizzle-orm'
import { playerAchievements, playerCollection } from '../../db/schema'

/**
 * GET /api/progress/[nickname]
 *
 * Henter al gemt progression for et nickname — bruges til at gendanne
 * state på en ny device/browser, eller merge ind i eksisterende localStorage.
 *
 * Returnerer:
 *   { achievements: string[], collection: number[] }
 *
 * Tom liste hvis intet findes (og hvis DB er nede).
 */
export default defineEventHandler(async (event) => {
  const nickname = (getRouterParam(event, 'nickname') ?? '').trim().substring(0, 20)
  if (nickname.length < 2) {
    throw createError({ statusCode: 400, message: 'nickname kræves.' })
  }

  try {
    const db = useDb()

    const [achievements, collection] = await Promise.all([
      db.select({ achievement: playerAchievements.achievement })
        .from(playerAchievements)
        .where(eq(playerAchievements.playerNickname, nickname)),
      db.select({ imageId: playerCollection.imageId, unlockedAt: playerCollection.unlockedAt })
        .from(playerCollection)
        .where(eq(playerCollection.playerNickname, nickname)),
    ])

    return {
      nickname,
      achievements: achievements.map(a => a.achievement),
      collection: collection.map(c => ({ id: c.imageId, at: c.unlockedAt })),
    }
  } catch (error) {
    console.warn('Progress fetch failed:', error)
    return { nickname, achievements: [], collection: [] }
  }
})
