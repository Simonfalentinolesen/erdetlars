import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.fact || !body.submittedBy) {
    throw createError({ statusCode: 400, message: 'fact and submittedBy are required' })
  }

  const fact = String(body.fact).substring(0, 200)
  const submittedBy = String(body.submittedBy).substring(0, 30)
  const timestamp = Date.now()

  // Save to submissions file
  const submissionsDir = join(process.cwd(), 'submissions')
  await mkdir(submissionsDir, { recursive: true })

  const factsFile = join(submissionsDir, 'submitted-facts.json')

  let existingFacts: any[] = []
  try {
    const data = await readFile(factsFile, 'utf-8')
    existingFacts = JSON.parse(data)
  } catch {
    // File doesn't exist yet
  }

  existingFacts.push({
    fact,
    submittedBy,
    submittedAt: new Date().toISOString(),
    approved: false,
  })

  await writeFile(factsFile, JSON.stringify(existingFacts, null, 2))

  return { success: true, message: 'Fact submitted for review' }
})
