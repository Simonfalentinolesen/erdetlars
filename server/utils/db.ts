import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDb() {
  if (_db) return _db

  // Læs både fra Nuxt runtimeConfig OG process.env direkte.
  // På Railway er DATABASE_URL injiceret som env-var ved container-start, men
  // Nuxt's runtimeConfig kan i nogle tilfælde indeholde tom default fra build-tid.
  // Direkte process.env-fallback sikrer at vi rammer den friske runtime-værdi.
  const config = useRuntimeConfig()
  const url = config.databaseUrl || process.env.DATABASE_URL || ''

  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  const client = postgres(url)
  _db = drizzle(client, { schema })

  return _db
}
