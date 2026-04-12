import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDb() {
  if (_db) return _db

  const config = useRuntimeConfig()

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const client = postgres(config.databaseUrl)
  _db = drizzle(client, { schema })

  return _db
}
