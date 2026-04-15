import { sql } from 'drizzle-orm'
import { playerAchievements, playerCollection } from '../../db/schema'

/**
 * POST /api/progress/sync
 *
 * Bulk-upsert af achievements + collection for et nickname.
 * Idempotent — kan kaldes flere gange med samme payload uden duplikater
 * (pga. unique-indeks på (player_nickname, achievement) og (player_nickname, image_id)).
 *
 * Body:
 *   {
 *     nickname: string,
 *     achievements: string[],   // fx ['first_correct', 'streak_5', ...]
 *     collection: number[],     // fx [1, 2, 5, 12, ...]
 *   }
 *
 * Returnerer hvor mange NYE der blev gemt (ikke eksisterende).
 *
 * Design: client-siden er source-of-truth under spillet — denne endpoint
 * er backup. Vi merger IKKE — vi tilføjer kun hvad klienten sender.
 * Hvis server har MERE end klient (andre devices), skal klienten selv
 * kalde GET /api/progress/[nickname] og merge lokalt.
 */
const MAX_BATCH = 500

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim().substring(0, 20) : ''
  if (nickname.length < 2) {
    throw createError({ statusCode: 400, message: 'nickname kræves (min 2 tegn).' })
  }

  const achievements = Array.isArray(body?.achievements)
    ? body.achievements
        .filter((a: unknown): a is string => typeof a === 'string' && a.length > 0 && a.length <= 50)
        .slice(0, MAX_BATCH)
    : []

  const collection = Array.isArray(body?.collection)
    ? body.collection
        .filter((n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0)
        .slice(0, MAX_BATCH)
    : []

  if (achievements.length === 0 && collection.length === 0) {
    return { success: true, achievementsAdded: 0, collectionAdded: 0 }
  }

  try {
    const db = useDb()

    // Upsert achievements — ON CONFLICT DO NOTHING via unique-indeks
    let achievementsAdded = 0
    if (achievements.length > 0) {
      const rows = achievements.map((a: string) => ({
        playerNickname: nickname,
        achievement: a,
      }))
      const result = await db
        .insert(playerAchievements)
        .values(rows)
        .onConflictDoNothing({ target: [playerAchievements.playerNickname, playerAchievements.achievement] })
        .returning({ id: playerAchievements.id })
      achievementsAdded = result.length
    }

    // Upsert collection
    let collectionAdded = 0
    if (collection.length > 0) {
      const rows = collection.map((id: number) => ({
        playerNickname: nickname,
        imageId: id,
      }))
      const result = await db
        .insert(playerCollection)
        .values(rows)
        .onConflictDoNothing({ target: [playerCollection.playerNickname, playerCollection.imageId] })
        .returning({ id: playerCollection.id })
      collectionAdded = result.length
    }

    return { success: true, achievementsAdded, collectionAdded }
  } catch (error) {
    console.warn('Progress sync failed:', error)
    return { success: false, error: 'Database unavailable' }
  }
})
