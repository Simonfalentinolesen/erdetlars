import { desc, sql, gte } from 'drizzle-orm'
import { games } from '../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const period = (query.period as string) || 'alltime'

  try {
    const db = useDb()

    let whereClause
    const now = new Date()

    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      whereClause = gte(games.playedAt, startOfDay)
    } else if (period === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      whereClause = gte(games.playedAt, startOfWeek)
    }

    const results = await db
      .select({
        nickname: games.playerNickname,
        score: games.score,
        correct: games.correct,
        bestStreak: games.bestStreak,
        playedAt: games.playedAt,
      })
      .from(games)
      .where(whereClause)
      .orderBy(desc(games.score))
      .limit(20)

    return results
  } catch (error) {
    // If DB is not connected, return empty array (graceful fallback)
    console.warn('Leaderboard DB not available:', error)
    return []
  }
})
