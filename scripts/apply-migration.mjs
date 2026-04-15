/**
 * Engangs-script: kører en SQL-fil mod DATABASE_URL.
 * Brug: DATABASE_URL=postgres://... node scripts/apply-migration.mjs <fil>
 */
import postgres from 'postgres'
import { readFile } from 'node:fs/promises'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/apply-migration.mjs <sql-file>')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL mangler')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' })
const content = await readFile(file, 'utf8')

console.log(`→ Kører ${file}...`)
try {
  await sql.unsafe(content)
  console.log('✓ Migration kørt succesfuldt')
} catch (err) {
  console.error('✗ Migration fejlede:', err.message)
  process.exit(1)
} finally {
  await sql.end()
}
