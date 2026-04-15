import { desc, sql, gte, eq, and, type SQL } from 'drizzle-orm'
import { games } from '../db/schema'

const ALLOWED_DIFFICULTIES = new Set(['rookie', 'viking', 'impossible', 'legendary'])
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * GET /api/leaderboard
 *   ?period=alltime|today|week            default alltime
 *   ?difficulty=rookie|viking|impossible|legendary   default alle
 *   ?limit=N                              default 20, max 100
 *   ?offset=N                             default 0
 *
 * Returnerer { entries, total } så UI kan lave pagination.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const period = typeof query.period === 'string' ? query.period : 'alltime'
  const difficulty = typeof query.difficulty === 'string' && ALLOWED_DIFFICULTIES.has(query.difficulty)
    ? query.difficulty
    : null
  const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const offset = Math.max(0, parseInt(String(query.offset ?? 0), 10) || 0)

  try {
    const db = useDb()

    // Byg WHERE ud fra period + difficulty. Bruger bruger-lokal UTC — kendt
    // edge: "i dag" er server-tid, ikke klient-tid. Acceptabelt for nu;
    // bedre løsning ville være at klienten sender offset.
    const filters: SQL[] = []
    const now = new Date()

    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      filters.push(gte(games.playedAt, startOfDay))
    } else if (period === 'week') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      filters.push(gte(games.playedAt, startOfWeek))
    }

    if (difficulty) {
      filters.push(eq(games.difficulty, difficulty))
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    // Kør query + count parallelt
    const [entries, countRows] = await Promise.all([
      db
        .select({
          nickname: games.playerNickname,
          score: games.score,
          correct: games.correct,
          wrong: games.wrong,
          bestStreak: games.bestStreak,
          difficulty: games.difficulty,
          durationMs: games.durationMs,
          playedAt: games.playedAt,
        })
        .from(games)
        .where(whereClause)
        .orderBy(desc(games.score), desc(games.playedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(games)
        .where(whereClause),
    ])

    return {
      entries,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    }
  } catch (error) {
    console.warn('Leaderboard DB not available:', error)
    return { entries: [], total: 0, limit, offset }
  }
})
