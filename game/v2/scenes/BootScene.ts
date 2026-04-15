import Phaser from 'phaser'
import { SCENE } from '../constants'

/**
 * BootScene: kører først, skifter umiddelbart til PreloadScene.
 *
 * Formål: et minimalt sted at sætte global game state, læse query params,
 * og starte den ægte indlæsning. Holder Preload ren til at vise progress-bar.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.BOOT })
  }

  create() {
    this.scene.start(SCENE.PRELOAD)
  }
}
