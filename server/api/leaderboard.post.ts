import { games } from '../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate
  if (!body.nickname || typeof body.score !== 'number') {
    throw createError({ statusCode: 400, message: 'nickname and score are required' })
  }

  try {
    const db = useDb()

    const [result] = await db.insert(games).values({
      playerNickname: String(body.nickname).substring(0, 20),
      score: Math.max(0, body.score),
      correct: body.correct ?? 0,
      wrong: body.wrong ?? 0,
      bestStreak: body.bestStreak ?? 0,
      difficulty: body.difficulty ?? 'rookie',
      durationMs: body.durationMs ?? null,
    }).returning()

    return { success: true, id: result.id }
  } catch (error) {
    console.warn('Failed to save score:', error)
    return { success: false, error: 'Database unavailable' }
  }
})
