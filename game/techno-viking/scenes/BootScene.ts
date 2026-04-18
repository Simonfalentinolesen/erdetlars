import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../constants'
import { buildAllTextures } from '../textures'

/**
 * BootScene — tegner loading progress og bygger alle procedurale teksturer.
 * Da vi kun bruger procedurale assets har vi intet at loade; "progress" er
 * et kort 300 ms boot-delay så spilleren får et glimt af branding.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.BOOT })
  }

  preload() {
    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2
    this.add
      .text(cx, cy - 20, 'TECHNO VIKING', {
        fontFamily: 'Space Grotesk, system-ui, sans-serif',
        fontSize: '48px',
        color: '#ffd447',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.add
      .text(cx, cy + 30, 'warming up the sound system…', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#7a8a95',
      })
      .setOrigin(0.5)
  }

  create() {
    buildAllTextures(this)
    this.time.delayedCall(300, () => {
      this.scene.start(SCENE.MENU)
    })
  }
}
