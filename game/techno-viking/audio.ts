/**
 * Techno Viking — procedural audio.
 *
 * Vi vil IKKE shippe lydfiler i repo'et → hele beatet genereres runtime via
 * Web Audio API. Det lyder ikke som en rigtig DJ-track, men det giver os en
 * konsistent clock og en tight loop der matcher BPM præcist.
 *
 * Design:
 *  - 1 AudioContext shared mellem game og rhythm-clock
 *  - 4/4 kick på beat 1/2/3/4, hihat på off-beats, snare på beat 2+4
 *  - Bass hum (sawtooth) bundet til 120 BPM — pumper i takt
 *  - Alt genereres via oscillators + envelopes, ingen samples
 *  - audioCtx.currentTime er "truth" for rhythm timing; scene-ur alignes til den
 */

import { LEVEL } from './constants'

export type HitSoundType = 'perfect' | 'great' | 'good' | 'miss' | 'beer' | 'crowd'

export class TechnoAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private scheduled: Array<{ time: number; type: string }> = []
  private nextBeatTime = 0
  private beatIndex = 0
  private lookaheadMs = 25
  private scheduleAheadSec = 0.2
  private bpm = LEVEL.BPM
  private startAt = 0
  private running = false
  private tickHandle: number | null = null

  async start(): Promise<number> {
    // Laves lazy så browsers ikke klager over "user gesture required"
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.55
    this.master.connect(this.ctx.destination)

    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.7
    this.musicGain.connect(this.master)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = 0.85
    this.sfxGain.connect(this.master)

    // Resume hvis suspended (Safari / Chrome autoplay policy)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    this.startAt = this.ctx.currentTime + 0.1
    this.nextBeatTime = this.startAt
    this.beatIndex = 0
    this.running = true
    this.scheduler()

    return this.startAt
  }

  /**
   * Rhythm clock — returnerer ms siden musikken startede.
   * Bruges af GameScene til at vide "hvornår er det beat N nu?".
   */
  now(): number {
    if (!this.ctx || !this.running) return 0
    return Math.max(0, (this.ctx.currentTime - this.startAt) * 1000)
  }

  isRunning(): boolean {
    return this.running
  }

  stop() {
    this.running = false
    if (this.tickHandle != null) {
      window.clearTimeout(this.tickHandle)
      this.tickHandle = null
    }
    if (this.ctx) {
      try {
        void this.ctx.close()
      } catch {
        // ignore
      }
      this.ctx = null
    }
  }

  setMusicVolume(v: number) {
    if (this.musicGain) this.musicGain.gain.value = Math.max(0, Math.min(1, v))
  }

  // ---------- SFX ----------

  playHitSfx(type: HitSoundType) {
    if (!this.ctx || !this.sfxGain) return
    const t = this.ctx.currentTime
    switch (type) {
      case 'perfect':
        this.tone(1600, t, 0.06, 0.18, 'triangle')
        this.tone(2400, t + 0.01, 0.04, 0.12, 'sine')
        break
      case 'great':
        this.tone(1100, t, 0.08, 0.18, 'triangle')
        break
      case 'good':
        this.tone(700, t, 0.08, 0.15, 'sine')
        break
      case 'miss':
        this.noise(t, 0.18, 0.22, 'lowpass', 400)
        break
      case 'beer':
        this.tone(520, t, 0.05, 0.2, 'square')
        this.tone(780, t + 0.06, 0.06, 0.18, 'square')
        this.tone(1040, t + 0.12, 0.1, 0.22, 'square')
        break
      case 'crowd':
        this.noise(t, 0.4, 0.2, 'highpass', 1200)
        break
    }
  }

  // ---------- Scheduler ----------

  private scheduler = () => {
    if (!this.running || !this.ctx) return
    const secondsPerBeat = 60 / this.bpm
    while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleBeat(this.beatIndex, this.nextBeatTime, secondsPerBeat)
      this.nextBeatTime += secondsPerBeat
      this.beatIndex++
    }
    this.tickHandle = window.setTimeout(this.scheduler, this.lookaheadMs)
  }

  private scheduleBeat(beat: number, time: number, secondsPerBeat: number) {
    // Kick på hver beat (4-on-floor)
    this.kick(time)
    // Hihat på off-beats
    this.hihat(time + secondsPerBeat / 2)
    // Snare på beat 2 og 4 (i hvert 4/4 measure)
    const measureBeat = beat % 4
    if (measureBeat === 1 || measureBeat === 3) {
      this.snare(time + secondsPerBeat * 0.01)
    }
    // Bass-pumper: lav sawtooth der dukker op hver 2. beat
    if (measureBeat === 0) {
      this.bassHum(time, secondsPerBeat * 2)
    }
    // Synth stab hver 8. beat for lidt variation
    if (beat % 8 === 0) {
      this.synthStab(time + secondsPerBeat * 0.25, secondsPerBeat * 0.5)
    }
  }

  // ---------- Instruments ----------

  private kick(time: number) {
    if (!this.ctx || !this.musicGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(130, time)
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12)
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.9, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
    osc.connect(gain).connect(this.musicGain)
    osc.start(time)
    osc.stop(time + 0.2)
  }

  private hihat(time: number) {
    if (!this.ctx || !this.musicGain) return
    const buffer = this.noiseBuffer(0.06)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 7000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.18, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
    src.connect(filter).connect(gain).connect(this.musicGain)
    src.start(time)
    src.stop(time + 0.06)
  }

  private snare(time: number) {
    if (!this.ctx || !this.musicGain) return
    const buffer = this.noiseBuffer(0.18)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
    src.connect(filter).connect(gain).connect(this.musicGain)
    src.start(time)
    src.stop(time + 0.18)
  }

  private bassHum(time: number, duration: number) {
    if (!this.ctx || !this.musicGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    osc.type = 'sawtooth'
    // E1 rodtone ~ 41 Hz → vi bouncer mellem 55 og 73 Hz for lidt bevægelse
    osc.frequency.setValueAtTime(55, time)
    osc.frequency.linearRampToValueAtTime(73, time + duration * 0.5)
    osc.frequency.linearRampToValueAtTime(55, time + duration)
    filter.type = 'lowpass'
    filter.frequency.value = 500
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.35, time + 0.02)
    gain.gain.linearRampToValueAtTime(0.2, time + duration * 0.8)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    osc.connect(filter).connect(gain).connect(this.musicGain)
    osc.start(time)
    osc.stop(time + duration + 0.05)
  }

  private synthStab(time: number, duration: number) {
    if (!this.ctx || !this.musicGain) return
    const freqs = [392, 466, 587] // G4 Bb4 D5 (minor feel)
    for (const f of freqs) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.001, time)
      gain.gain.exponentialRampToValueAtTime(0.08, time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
      osc.connect(gain).connect(this.musicGain)
      osc.start(time)
      osc.stop(time + duration + 0.05)
    }
  }

  private tone(
    freq: number,
    time: number,
    duration: number,
    peak: number,
    type: OscillatorType,
  ) {
    if (!this.ctx || !this.sfxGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, time)
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    osc.connect(gain).connect(this.sfxGain)
    osc.start(time)
    osc.stop(time + duration + 0.02)
  }

  private noise(
    time: number,
    duration: number,
    peak: number,
    filterType: BiquadFilterType,
    cutoff: number,
  ) {
    if (!this.ctx || !this.sfxGain) return
    const buffer = this.noiseBuffer(duration)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = cutoff
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    src.connect(filter).connect(gain).connect(this.sfxGain)
    src.start(time)
    src.stop(time + duration + 0.02)
  }

  private noiseBuffer(durationSec: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * durationSec)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buf
  }
}
