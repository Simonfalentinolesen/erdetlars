import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  nickname: varchar('nickname', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  playerNickname: varchar('player_nickname', { length: 20 }).notNull(),
  score: integer('score').notNull().default(0),
  correct: integer('correct').notNull().default(0),
  wrong: integer('wrong').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  difficulty: varchar('difficulty', { length: 20 }).default('rookie'),
  durationMs: integer('duration_ms'),
  playedAt: timestamp('played_at').defaultNow(),
})

export const playerAchievements = pgTable('player_achievements', {
  id: serial('id').primaryKey(),
  playerNickname: varchar('player_nickname', { length: 20 }).notNull(),
  achievement: varchar('achievement', { length: 50 }).notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow(),
})
