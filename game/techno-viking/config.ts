import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './constants'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { HUDScene } from './scenes/HUDScene'
import { MenuScene } from './scenes/MenuScene'
import { ResultsScene } from './scenes/ResultsScene'

/**
 * Techno Viking — Phaser game config.
 *
 * - Arcade physics bruges kun til Lars' march-wiggle og follower-flock, ikke collision.
 * - Scale.FIT: bevar aspect på mobil, autoCenter holder den i viewet.
 * - Render: antialias ON — vi vil have smooth gradients på Lars' transformation-glow.
 */
export function buildTechnoVikingConfig(parent: HTMLElement | string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#08080f',
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, MenuScene, GameScene, HUDScene, ResultsScene],
    disableContextMenu: true,
    render: { antialias: true, pixelArt: false, roundPixels: false },
    fps: { target: 60, forceSetTimeOut: false },
  }
}
