import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './constants'
import { BootScene } from './scenes/BootScene'
import { GameOverScene } from './scenes/GameOverScene'
import { HUDScene } from './scenes/HUDScene'
import { Level1Scene } from './scenes/Level1Scene'
import { MenuScene } from './scenes/MenuScene'
import { PreloadScene } from './scenes/PreloadScene'

/**
 * Phaser game configuration for Viking Lars V2.
 *
 * - Arcade physics: simpel AABB-collision, hurtigere end Matter.js og rigeligt
 *   til en 2D-platformer
 * - Scale.FIT: skalerer canvas til container, bevarer aspect ratio
 * - autoCenter: centrerer canvas horizontalt + vertikalt
 * - parent: id på div hvor canvas mountes (sættes når vi instantierer)
 */
export function buildGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0F1923',
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // Sættes pr. scene
        debug: false,
      },
    },
    scene: [
      BootScene,
      PreloadScene,
      MenuScene,
      Level1Scene,
      HUDScene,
      GameOverScene,
    ],
    // Disable right-click menu på canvas
    disableContextMenu: true,
    // Render-konfiguration
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
  }
}
