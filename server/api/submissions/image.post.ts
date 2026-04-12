import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const imageField = formData.find(f => f.name === 'image')
  const isLarsField = formData.find(f => f.name === 'isLars')
  const submittedByField = formData.find(f => f.name === 'submittedBy')

  if (!imageField?.data || !isLarsField || !submittedByField) {
    throw createError({ statusCode: 400, message: 'Missing fields' })
  }

  const isLars = isLarsField.data.toString() === 'true'
  const submittedBy = submittedByField.data.toString().substring(0, 30)
  const timestamp = Date.now()
  const ext = imageField.filename?.split('.').pop() || 'jpg'
  const filename = `submission-${timestamp}.${ext}`

  // Save to a submissions directory
  const submissionsDir = join(process.cwd(), 'submissions', 'images')
  await mkdir(submissionsDir, { recursive: true })
  await writeFile(join(submissionsDir, filename), imageField.data)

  // Save metadata
  const metaDir = join(process.cwd(), 'submissions', 'meta')
  await mkdir(metaDir, { recursive: true })
  await writeFile(
    join(metaDir, `${timestamp}.json`),
    JSON.stringify({
      filename,
      isLars,
      submittedBy,
      submittedAt: new Date().toISOString(),
      approved: false,
    }, null, 2),
  )

  return { success: true, message: 'Image submitted for review' }
})
