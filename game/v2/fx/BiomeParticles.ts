import Phaser from 'phaser'
import { ASSET, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../constants'

/**
 * BiomeParticles — ambient-partikler der giver hver level sin egen stemning.
 *
 * Hver funktion returnerer en klar-til-brug ParticleEmitter der:
 * - Følger kameraet (setScrollFactor så de ikke forsvinder når Lars løber)
 * - Kører i baggrunden (depth mellem BG_NEAR og PLAYER)
 * - Loopede kontinuerligt
 *
 * Moserne (Level 1): dyb mistig tåge over jorden
 * Skoven (Level 2): fallende blade + ildfluer
 * Klipperne (Level 3): diagonal regn
 * Ilden (Level 4): opad-glødende embers
 */
export class BiomeParticles {
  /**
   * Tåge-tæppe der driver hen over skærmen — Moserne-vibe
   */
  static createMist(scene: Phaser.Scene, tint = 0xaad4a8): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = scene.add.particles(0, 0, ASSET.TEX_P_MIST, {
      x: { min: -50, max: GAME_WIDTH + 50 },
      y: { min: GAME_HEIGHT * 0.55, max: GAME_HEIGHT * 0.95 },
      lifespan: { min: 6000, max: 10000 },
      speedX: { min: 15, max: 40 },
      speedY: { min: -5, max: 5 },
      scale: { start: 1.6, end: 2.8 },
      alpha: { start: 0, end: 0.55, ease: 'Sine.easeInOut' },
      tint,
      frequency: 320, // ms mellem partikler
      blendMode: 'NORMAL',
      emitting: true,
    })
    emitter.setScrollFactor(0)
    emitter.setDepth(DEPTH.PARTICLES_BG)

    // Fade ud når lifespan når slut
    emitter.onParticleEmit((p) => {
      scene.tweens.add({
        targets: p,
        alpha: 0,
        duration: p.lifeCurrent * 0.4,
        delay: p.lifeCurrent * 0.6,
      })
    })

    return emitter
  }

  /**
   * Ekstra lavere tåge-bånd tæt på bunden — giver dybde-følelse
   */
  static createLowFog(scene: Phaser.Scene, tint = 0x6a8a6a): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = scene.add.particles(0, 0, ASSET.TEX_P_MIST, {
      x: { min: -30, max: GAME_WIDTH + 30 },
      y: { min: GAME_HEIGHT * 0.78, max: GAME_HEIGHT * 0.95 },
      lifespan: { min: 8000, max: 14000 },
      speedX: { min: 25, max: 50 },
      scale: { start: 2.0, end: 3.5 },
      alpha: { start: 0.3, end: 0.0, ease: 'Quad.easeIn' },
      tint,
      frequency: 450,
    })
    emitter.setScrollFactor(0)
    emitter.setDepth(DEPTH.PARTICLES_BG + 1)
    return emitter
  }

  /**
   * Fallende blade (Skoven)
   */
  static createLeaves(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = scene.add.particles(0, 0, ASSET.TEX_P_LEAF, {
      x: { min: 0, max: GAME_WIDTH },
      y: -20,
      lifespan: 7000,
      speedY: { min: 40, max: 90 },
      speedX: { min: -30, max: 30 },
      rotate: { start: 0, end: 360 },
      scale: { start: 0.8, end: 1.2 },
      alpha: { start: 0.9, end: 0.5 },
      tint: [0xaa5520, 0xcc6622, 0xdd9933],
      frequency: 180,
    })
    emitter.setScrollFactor(0)
    emitter.setDepth(DEPTH.PARTICLES_BG)
    return emitter
  }

  /**
   * Diagonal regn (Klipperne)
   */
  static createRain(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = scene.add.particles(0, 0, ASSET.TEX_P_RAIN, {
      x: { min: -100, max: GAME_WIDTH + 100 },
      y: -20,
      lifespan: 1200,
      speedY: 800,
      speedX: -200,
      scale: { start: 1, end: 1 },
      alpha: 0.5,
      tint: 0xaaccff,
      frequency: 30,
    })
    emitter.setScrollFactor(0)
    emitter.setDepth(DEPTH.PARTICLES)
    return emitter
  }

  /**
   * Opadgående embers (Ilden)
   */
  static createEmbers(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = scene.add.particles(0, 0, ASSET.TEX_P_EMBER, {
      x: { min: 0, max: GAME_WIDTH },
      y: GAME_HEIGHT,
      lifespan: 3000,
      speedY: { min: -80, max: -150 },
      speedX: { min: -20, max: 20 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      frequency: 150,
    })
    emitter.setScrollFactor(0)
    emitter.setDepth(DEPTH.PARTICLES)
    return emitter
  }

  /**
   * Ildfluer (Skoven, aften)
   */
  static createFireflies(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = scene.add.particles(0, 0, ASSET.TEX_P_FIREFLY, {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: GAME_HEIGHT * 0.3, max: GAME_HEIGHT * 0.8 },
      lifespan: 4000,
      speedX: { min: -20, max: 20 },
      speedY: { min: -15, max: 15 },
      scale: { start: 0.5, end: 1.5 },
      alpha: { start: 0.1, end: 0.9, ease: 'Sine.easeInOut' },
      frequency: 500,
    })
    emitter.setScrollFactor(0)
    emitter.setDepth(DEPTH.PARTICLES)
    return emitter
  }
}
