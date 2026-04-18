import { HIGHWAY, LEVEL } from './constants'

/**
 * Techno Viking — note chart generator.
 *
 * En note har:
 *  - lane (0..3)
 *  - hitTimeMs: tidspunkt målt fra musik-start hvor spilleren skal ramme
 *  - type: 'arrow' (almindelig) eller 'beer' (power-up, tæller dobbelt)
 *
 * Vi genererer charts PROCEDURELT ud fra BPM + varighed, ikke handwritten.
 * Pattern-blocks giver mønstre der føles "komponeret" frem for random.
 */

export type NoteType = 'arrow' | 'beer'

export interface Note {
  id: number
  lane: 0 | 1 | 2 | 3
  hitTimeMs: number
  type: NoteType
  hit?: boolean // sat af GameScene når ramt/missed
  judgement?: 'perfect' | 'great' | 'good' | 'miss'
}

/**
 * Generer en komplet chart for levelets varighed.
 * Første note kommer ~2 sekunder inde (giver spiller tid til at se receptor).
 */
export function buildChart(): Note[] {
  const bpm = LEVEL.BPM
  const msPerBeat = 60_000 / bpm
  const duration = LEVEL.DURATION_MS
  const notes: Note[] = []
  let id = 0

  // Første note efter 2 sek, lidt buffer
  let t = 2000
  // Rhythm-fase: beat-index siden vi startede
  let beat = 0

  // Enkelt PRNG så charts er reproducerbare hvis vi vil replay
  let seed = 1337
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  // Pattern-bank: hver pattern er 4 beats (1 measure). Hvert heltal = lane.
  // null = rest. -1 = beer (samme lane som seneste)
  // Vi bygger dem stigende i sværhedsgrad.
  type Cell = number | null | 'beer'
  const easyPatterns: Cell[][] = [
    [0, null, 2, null],
    [1, null, 3, null],
    [0, 2, 1, 3],
    [3, null, 2, null],
    [0, 1, 2, 3],
  ]
  const midPatterns: Cell[][] = [
    [0, 0, 2, 3],
    [3, 1, 2, 0],
    [0, 2, 0, 2],
    [1, 3, 1, 3],
    [0, 2, 3, 1],
    [0, null, 0, 2],
  ]
  const hardPatterns: Cell[][] = [
    [0, 1, 2, 3, 2, 1, 0, null],
    [0, 2, 1, 3, 0, 2, 1, 3],
    [3, 2, 'beer', null, 0, 1, 2, 3],
    [0, 0, 1, 1, 2, 2, 3, 3],
  ]

  // Sub-beat step (8th notes for mid/hard). Vi bruger 8-cell patterns for hard.
  while (t < duration - 2000) {
    const progress = t / duration

    let bank: Cell[][]
    let subdiv: number
    if (progress < 0.25) {
      bank = easyPatterns
      subdiv = msPerBeat // 1 cell = 1 beat (kvartnoder)
    } else if (progress < 0.6) {
      bank = midPatterns
      subdiv = msPerBeat
    } else {
      bank = hardPatterns
      subdiv = msPerBeat / 2 // 8th notes
    }

    const pattern = bank[Math.floor(rnd() * bank.length)]
    let lastLane: number | null = null
    for (const cell of pattern) {
      if (cell === null) {
        t += subdiv
        continue
      }
      if (cell === 'beer') {
        if (lastLane != null) {
          notes.push({
            id: id++,
            lane: lastLane as 0 | 1 | 2 | 3,
            hitTimeMs: t,
            type: 'beer',
          })
        }
      } else {
        const lane = cell as 0 | 1 | 2 | 3
        notes.push({ id: id++, lane, hitTimeMs: t, type: 'arrow' })
        lastLane = lane
      }
      t += subdiv
    }

    // Sporadisk beer-reward hvert ~12 beats hvis vi ikke lige har droppet en
    if (rnd() < 0.12 && notes.length > 0) {
      const last = notes[notes.length - 1]
      notes.push({
        id: id++,
        lane: last.lane,
        hitTimeMs: t + msPerBeat / 2,
        type: 'beer',
      })
    }

    beat += pattern.length
  }

  return notes.sort((a, b) => a.hitTimeMs - b.hitTimeMs)
}

/**
 * Beregn y-position for en note givet nuværende musik-tid.
 *  - Hvis (hitTime - now) > TRAVEL_MS → noten er endnu ikke spawnet.
 *  - Hvis (hitTime - now) < 0 → noten er over hit-zone og på vej ud.
 *  - Lineær interpolation: SPAWN_Y ved hitTime - TRAVEL_MS, HIT_ZONE_Y ved hitTime.
 */
export function noteY(nowMs: number, hitTimeMs: number): number {
  const dt = hitTimeMs - nowMs
  const t = 1 - dt / HIGHWAY.TRAVEL_MS // 0 = spawn, 1 = hit zone
  return HIGHWAY.SPAWN_Y + (HIGHWAY.HIT_ZONE_Y - HIGHWAY.SPAWN_Y) * t
}
