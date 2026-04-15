/**
 * Share-card generator: bygger et 1080x1080 PNG fra en spillers score
 * via canvas, klar til IG Stories, IG Feed, FB, Twitter osv.
 *
 * Hvorfor client-side?
 * - Ingen server-side deps (satori/sharp/playwright) → simpel deploy
 * - Web Share API Level 2 understøtter `files` på iOS Safari + Chrome Android
 * - Fallback: download som .png hvis ingen Web Share
 *
 * Designprincipper:
 * - 1080x1080 (kvadrat → fungerer på alle platforme uden cropping)
 * - Mørk baggrund med accent-glow så det matcher app-styling
 * - Stort tal (score) som hero, derunder stats + difficulty-badge
 * - Branding nederst: "ErDetLars.dk" så folk finder spillet
 */

import { DIFFICULTY_CONFIG, type DifficultyId } from '~/composables/useGame'

interface ShareCardData {
  score: number
  correct: number
  wrong: number
  totalSwiped: number
  bestStreak: number
  isPerfect: boolean
  difficulty: DifficultyId
  nickname?: string
}

const SIZE = 1080

export function useShareCard() {
  /**
   * Tegner share-card til et offscreen canvas og returnerer som Blob.
   * Returnerer null hvis vi er server-side eller canvas fejler.
   */
  async function buildCardBlob(data: ShareCardData): Promise<Blob | null> {
    if (!import.meta.client) return null

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    drawCard(ctx, data)

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95)
    })
  }

  /**
   * Bygger card og deler det via Web Share API Level 2.
   * Falder tilbage til download hvis Web Share ikke understøtter files.
   * Returnerer 'shared' | 'downloaded' | 'failed'.
   */
  async function shareCard(data: ShareCardData): Promise<'shared' | 'downloaded' | 'failed'> {
    const blob = await buildCardBlob(data)
    if (!blob) return 'failed'

    const file = new File([blob], `erdetlars-${data.score}.png`, { type: 'image/png' })
    const shareData: ShareData = {
      title: 'Er Det Lars?',
      text: buildShareText(data),
      url: 'https://erdetlars.dk',
      files: [file],
    }

    // Tjek om browseren kan dele filer (iOS Safari 15+, Chrome Android, ikke desktop Chrome)
    if (typeof navigator !== 'undefined' && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        return 'shared'
      } catch (err: unknown) {
        // AbortError = bruger lukkede share-sheet, ikke en fejl
        if (err instanceof Error && err.name === 'AbortError') return 'shared'
        // Falder igennem til download
      }
    }

    // Fallback: download som fil
    downloadBlob(blob, `erdetlars-${data.score}.png`)
    return 'downloaded'
  }

  function buildShareText(data: ShareCardData): string {
    const diff = DIFFICULTY_CONFIG[data.difficulty]?.label ?? 'Rookie'
    const accuracy = Math.round((data.correct / Math.max(data.totalSwiped, 1)) * 100)
    if (data.isPerfect) {
      return `🏆 PERFEKT RUNDE på ${diff}! ${data.score} point på ErDetLars.dk. Kan DU spotte den rigtige Lars?`
    }
    return `Jeg scorede ${data.score} point på ${diff} (${accuracy}% korrekt) i ErDetLars.dk! Kan du gøre det bedre? 🍺`
  }

  return { buildCardBlob, shareCard, buildShareText }
}

// ---------- Canvas drawing ----------

function drawCard(ctx: CanvasRenderingContext2D, data: ShareCardData) {
  const diff = DIFFICULTY_CONFIG[data.difficulty] ?? DIFFICULTY_CONFIG.rookie

  // 1. Baggrund — mørk gradient
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#0F1923')
  bg.addColorStop(1, '#1A2530')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)

  // 2. Accent glow blob (matcher app's bg-glow-* klasser)
  const glowColor = data.isPerfect ? '#F5A623' : data.score >= 600 ? '#00D68F' : '#E84393'
  const glow = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.4, 0, SIZE * 0.5, SIZE * 0.4, SIZE * 0.55)
  glow.addColorStop(0, hexWithAlpha(glowColor, 0.35))
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, SIZE, SIZE)

  // 3. Top-badge: "ErDetLars.dk" + difficulty
  ctx.font = 'bold 28px "Space Grotesk", system-ui, sans-serif'
  ctx.fillStyle = '#7A8A95'
  ctx.textAlign = 'left'
  ctx.fillText('ErDetLars.dk', 80, 100)

  // Difficulty badge øverst højre
  const badgeText = diff.label
  ctx.font = 'bold 24px "Space Grotesk", system-ui, sans-serif'
  ctx.textAlign = 'right'
  const badgePadX = 28
  const badgeW = ctx.measureText(badgeText).width + badgePadX * 2
  const badgeX = SIZE - 80 - badgeW
  const badgeY = 70
  const badgeH = 52
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 26)
  ctx.fillStyle = hexWithAlpha(diff.color, 0.18)
  ctx.fill()
  ctx.strokeStyle = hexWithAlpha(diff.color, 0.6)
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = diff.color
  ctx.textAlign = 'center'
  ctx.fillText(badgeText.toUpperCase(), badgeX + badgeW / 2, badgeY + 35)

  // 4. Perfect crown hvis isPerfect
  let labelY = 280
  if (data.isPerfect) {
    ctx.font = 'bold 42px "Space Grotesk", system-ui, sans-serif'
    ctx.fillStyle = '#F5A623'
    ctx.textAlign = 'center'
    ctx.fillText('👑 PERFEKT RUNDE 👑', SIZE / 2, labelY)
    labelY += 70
  }

  // 5. "DIN SCORE" label
  ctx.font = 'bold 32px "Space Grotesk", system-ui, sans-serif'
  ctx.fillStyle = '#7A8A95'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '4px'
  ctx.fillText('DIN SCORE', SIZE / 2, labelY)

  // 6. Stort score-tal (hero)
  const scoreText = data.score.toLocaleString('da-DK')
  ctx.font = 'bold 220px "JetBrains Mono", "Space Grotesk", monospace'
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText(scoreText, SIZE / 2, labelY + 200)

  // 7. Stats row (4 metrics)
  const statsY = labelY + 320
  const stats = [
    { label: 'SWIPES', value: String(data.totalSwiped), color: '#FFFFFF' },
    { label: 'KORREKTE', value: String(data.correct), color: '#00D68F' },
    { label: 'FORKERTE', value: String(data.wrong), color: '#FF5470' },
    { label: 'STREAK', value: String(data.bestStreak), color: '#F5A623' },
  ]
  const colW = (SIZE - 160) / 4
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]
    if (!s) continue
    const cx = 80 + colW * (i + 0.5)
    ctx.font = 'bold 72px "JetBrains Mono", monospace'
    ctx.fillStyle = s.color
    ctx.textAlign = 'center'
    ctx.fillText(s.value, cx, statsY)
    ctx.font = 'bold 22px "Space Grotesk", system-ui, sans-serif'
    ctx.fillStyle = '#7A8A95'
    ctx.fillText(s.label, cx, statsY + 38)
  }

  // 8. Nickname hvis sat
  if (data.nickname) {
    ctx.font = 'bold 30px "Space Grotesk", system-ui, sans-serif'
    ctx.fillStyle = '#7A8A95'
    ctx.textAlign = 'center'
    ctx.fillText(`— ${data.nickname} —`, SIZE / 2, statsY + 110)
  }

  // 9. CTA bar nederst
  const ctaY = SIZE - 130
  ctx.fillStyle = hexWithAlpha('#F5A623', 0.12)
  ctx.fillRect(0, ctaY, SIZE, 130)
  ctx.font = 'bold 38px "Space Grotesk", system-ui, sans-serif'
  ctx.fillStyle = '#F5A623'
  ctx.textAlign = 'center'
  ctx.fillText('Kan DU spotte den rigtige Lars?', SIZE / 2, ctaY + 55)
  ctx.font = 'bold 30px "Space Grotesk", system-ui, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('🍺 ErDetLars.dk', SIZE / 2, ctaY + 100)
}

// ---------- Utilities ----------

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  // Strip leading # og handler både 3- og 6-char hex
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h}${a}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
