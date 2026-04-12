import postgres from 'postgres'

// One-time DB initialization endpoint
// Call this once after deploying to create the tables
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  if (!config.databaseUrl) {
    return { error: 'DATABASE_URL not set' }
  }

  const sql = postgres(config.databaseUrl)

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        player_nickname VARCHAR(20) NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        correct INTEGER NOT NULL DEFAULT 0,
        wrong INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        difficulty VARCHAR(20) DEFAULT 'rookie',
        duration_ms INTEGER,
        played_at TIMESTAMP DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS player_achievements (
        id SERIAL PRIMARY KEY,
        player_nickname VARCHAR(20) NOT NULL,
        achievement VARCHAR(50) NOT NULL,
        unlocked_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(player_nickname, achievement)
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_games_score ON games(score DESC)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_games_played_at ON games(played_at DESC)
    `

    await sql.end()

    return { success: true, message: 'Database tables created successfully!' }
  } catch (error) {
    await sql.end()
    return { error: String(error) }
  }
})
