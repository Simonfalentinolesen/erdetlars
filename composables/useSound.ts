/**
 * Lyd via Web Audio API — ingen filer, ingen hosting.
 * Syntheticed tones med envelope for "arcade-feel": bright bells for korrekte svar,
 * low sawtooth buzz for forkerte, ascending arpeggio for streaks.
 *
 * Vi bruger ikke Howler (selvom den er installeret) — synth er mindre, offline,
 * og tillader variation i tonen pr. call (ikke bare afspilning af samme sample).
 */

const SOUND_KEY = 'erdetlars_sound_enabled'

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null

function getCtx(): AudioContext | null {
  if (!import.meta.client) return null
  if (!audioCtx) {
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
      if (!Ctor) return null
      audioCtx = new Ctor()
      masterGain = audioCtx.createGain()
      masterGain.gain.value = 0.35  // overall lydloft — ikke øredøvende
      masterGain.connect(audioCtx.destination)
    } catch {
      return null
    }
  }
  // Autoplay-policy: resume hvis suspenderet
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

/** En enkelt tone med linear attack + exponential decay */
function tone(freq: number, opts: { duration?: number; type?: OscillatorType; volume?: number; delay?: number } = {}) {
  const ctx = getCtx()
  if (!ctx || !masterGain) return
  const { duration = 0.14, type = 'sine', volume = 0.28, delay = 0 } = opts
  const startAt = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.01)       // hurtig attack
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration) // decay
  osc.connect(gain).connect(masterGain)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/** Pitch-bend-tone — frekvensen glider fra→til over durationen (til zaps/swooshes) */
function bend(fromFreq: number, toFreq: number, duration = 0.25, type: OscillatorType = 'sawtooth', volume = 0.22) {
  const ctx = getCtx()
  if (!ctx || !masterGain) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  const t0 = ctx.currentTime
  osc.frequency.setValueAtTime(fromFreq, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 20), t0 + duration)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(masterGain)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export const useSound = () => {
  // Default ON — lyd er en hovedfeedback-kanal, ikke opt-in feature
  const enabled = useState('soundEnabled', () => true)

  // Hydrate from localStorage
  if (import.meta.client) {
    const saved = localStorage.getItem(SOUND_KEY)
    if (saved !== null) enabled.value = saved === 'true'
  }

  function toggle() {
    enabled.value = !enabled.value
    if (import.meta.client) {
      localStorage.setItem(SOUND_KEY, String(enabled.value))
    }
    // Ping så brugeren hører at lyden nu er ON
    if (enabled.value) tone(880, { duration: 0.08, type: 'triangle', volume: 0.2 })
  }

  // ---- Sounds ----

  /** Korrekt svar: lys bell-agtig arpeggio (C5 → E5) */
  function playCorrect() {
    if (!enabled.value) return
    tone(523.25, { duration: 0.1, type: 'triangle', volume: 0.25 })            // C5
    tone(659.25, { duration: 0.18, type: 'triangle', volume: 0.22, delay: 0.06 }) // E5
  }

  /** Forkert svar: low buzz bend nedad (E3 → A2) */
  function playWrong() {
    if (!enabled.value) return
    bend(164.81, 110, 0.28, 'sawtooth', 0.2)
  }

  /** Streak-milepæl: C-major ascending arpeggio (C5 → E5 → G5 → C6) */
  function playStreak() {
    if (!enabled.value) return
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      tone(f, { duration: 0.15, type: 'triangle', volume: 0.24, delay: i * 0.07 })
    })
  }

  /** Perfekt runde: fuldt C-dur akkord + sparkle (dual-tone) */
  function playPerfect() {
    if (!enabled.value) return
    // Akkord samtidig
    tone(523.25, { duration: 0.5, type: 'triangle', volume: 0.2 })
    tone(659.25, { duration: 0.5, type: 'triangle', volume: 0.18, delay: 0.02 })
    tone(783.99, { duration: 0.5, type: 'triangle', volume: 0.18, delay: 0.04 })
    // Sparkle efter
    setTimeout(() => {
      tone(1567.98, { duration: 0.12, type: 'sine', volume: 0.18 }) // G6
      tone(2093, { duration: 0.15, type: 'sine', volume: 0.16, delay: 0.08 }) // C7
    }, 400)
  }

  /** Generisk pop for små interaktioner (knap-tryk, power-up pickup) */
  function playTap() {
    if (!enabled.value) return
    tone(660, { duration: 0.05, type: 'square', volume: 0.12 })
  }

  /** Kvit-eller-dobbelt build-up: tense ascending sawtooth */
  function playTension() {
    if (!enabled.value) return
    bend(220, 880, 0.9, 'sawtooth', 0.15)
  }

  return {
    enabled,
    toggle,
    playCorrect,
    playWrong,
    playStreak,
    playPerfect,
    playTap,
    playTension,
  }
}
