/**
 * Sound — stub-module for fremtidig lyd-implementation.
 *
 * Vi holder en ren API så vi kan tilføje rigtige lydfiler senere uden at
 * refaktorere alle scener. Alle kald er no-op indtil vi lægger assets ind.
 *
 * Forventet brug:
 *   import { Sound } from '../audio/Sound'
 *   Sound.sfx('jump')
 *   Sound.music('level1')
 */

type SfxKey =
  | 'jump'
  | 'double-jump'
  | 'hit'
  | 'pickup'
  | 'stomp'
  | 'boss-hit'
  | 'boss-death'
  | 'level-complete'
  | 'menu-click'

type MusicKey = 'menu' | 'level1' | 'level1-boss'

class SoundManager {
  private enabled = true
  private musicVolume = 0.5
  private sfxVolume = 0.7

  sfx(_key: SfxKey) {
    if (!this.enabled) return
    // TODO: spil Phaser sound når filer er loadet
    // Når filer er der: this.scene.sound.play(key, { volume: this.sfxVolume })
  }

  music(_key: MusicKey) {
    if (!this.enabled) return
    // TODO: switch music tracks
  }

  setEnabled(on: boolean) {
    this.enabled = on
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music
    this.sfxVolume = sfx
  }
}

export const Sound = new SoundManager()
