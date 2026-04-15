import { and, eq, gte } from 'drizzle-orm'
import { games } from '../db/schema'

/**
 * Nickname-sanitization — samler logik ét sted så både nye entries og
 * evt. edits er konsistente. Mål: ingen HTML, ingen ren whitespace,
 * blocklist for impersonation + basal dansk grovhed.
 */
const RESERVED = new Set(['jim', 'lars', 'admin', 'system', 'erdetlars', 'guest', 'anonym'])
// Minimal blocklist — en håndfuld danske/engelske skældsord. Udvides efter behov.
const BLOCKED_SUBSTRINGS = [
  'nigger', 'nigga', 'faggot', 'retard',
  'kraftedeme', 'fisse', 'pikfjæs', 'pikhoved',
]

function sanitizeNickname(raw: unknown): { ok: true; value: string } | { ok: false; reason: string } {
  if (typeof raw !== 'string') return { ok: false, reason: 'Navn skal være tekst.' }

  // Fjern HTML-tags, unicode control characters og ultra-lange whitespace-runs
  const stripped = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 20)

  if (stripped.length < 2) return { ok: false, reason: 'Navn skal være mindst 2 tegn.' }

  const lower = stripped.toLowerCase()
  if (RESERVED.has(lower)) return { ok: false, reason: 'Det navn er reserveret. Prøv et andet.' }
  if (BLOCKED_SUBSTRINGS.some(s => lower.includes(s))) {
    return { ok: false, reason: 'Navnet er blokeret. Prøv et andet.' }
  }

  return { ok: true, value: stripped }
}

/**
 * Rate limit: max 10 submissions pr. IP pr. minut.
 * In-memory Map — OK på Railway single-instance; hvis vi skalerer
 * horisontalt skal dette flyttes til Redis eller DB.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
const rateBuckets = new Map<string, number[]>()

function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const bucket = rateBuckets.get(ip) ?? []
  const recent = bucket.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    const oldest = recent[0]
    return { ok: false, retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000) }
  }
  recent.push(now)
  rateBuckets.set(ip, recent)
  return { ok: true }
}

// Periodisk cleanup så Map ikke vokser uendeligt
setInterval(() => {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    const recent = bucket.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (recent.length === 0) rateBuckets.delete(ip)
    else rateBuckets.set(ip, recent)
  }
}, 5 * 60_000)

const ALLOWED_DIFFICULTIES = new Set(['rookie', 'viking', 'impossible', 'legendary'])
// Cap på score så fejl/cheat ikke laver absurd store tal
const MAX_SCORE = 1_000_000

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // 1) Sanitize nickname
  const nameCheck = sanitizeNickname(body.nickname)
  if (!nameCheck.ok) {
    throw createError({ statusCode: 400, message: nameCheck.reason })
  }

  // 2) Validate score + other numeric fields
  if (typeof body.score !== 'number' || !Number.isFinite(body.score)) {
    throw createError({ statusCode: 400, message: 'score skal være et tal.' })
  }
  const safeScore = Math.max(0, Math.min(MAX_SCORE, Math.round(body.score)))
  const safeCorrect = Math.max(0, Math.round(Number(body.correct) || 0))
  const safeWrong = Math.max(0, Math.round(Number(body.wrong) || 0))
  const safeStreak = Math.max(0, Math.round(Number(body.bestStreak) || 0))
  const safeDuration = body.durationMs != null ? Math.max(0, Math.round(Number(body.durationMs))) : null
  const safeDifficulty = ALLOWED_DIFFICULTIES.has(body.difficulty) ? body.difficulty : 'rookie'

  // 3) Rate limit pr. IP
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const rate = checkRateLimit(ip)
  if (!rate.ok) {
    setResponseHeader(event, 'Retry-After', String(rate.retryAfter ?? 60))
    throw createError({
      statusCode: 429,
      message: `For mange indsendelser. Prøv igen om ${rate.retryAfter}s.`,
    })
  }

  // 4) Dedup: hvis samme nickname+score blev submittet inden for sidste 5s → skip stille
  try {
    const db = useDb()
    const fiveSecAgo = new Date(Date.now() - 5_000)
    const existing = await db
      .select({ id: games.id })
      .from(games)
      .where(and(
        eq(games.playerNickname, nameCheck.value),
        eq(games.score, safeScore),
        gte(games.playedAt, fiveSecAgo),
      ))
      .limit(1)
    if (existing.length > 0) {
      return { success: true, id: existing[0].id, deduped: true }
    }

    // 5) Insert
    const [result] = await db.insert(games).values({
      playerNickname: nameCheck.value,
      score: safeScore,
      correct: safeCorrect,
      wrong: safeWrong,
      bestStreak: safeStreak,
      difficulty: safeDifficulty,
      durationMs: safeDuration,
    }).returning()

    return { success: true, id: result.id }
  } catch (error) {
    console.warn('Failed to save score:', error)
    return { success: false, error: 'Database unavailable' }
  }
})
