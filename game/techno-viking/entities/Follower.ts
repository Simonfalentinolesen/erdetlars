import Phaser from 'phaser'
import { DEPTH } from '../constants'
import { TEX } from '../textures'

/**
 * Follower — en person der danser bag Lars i paraden.
 *
 * Paraden er et "flock" uden fysik: hver follower har et fixed offset bagfra,
 * og bopper i takt med musikken. Jo længere tilbage, jo mindre (fake perspektiv).
 *
 * Når follower-count vokser meget, kan vi kalde compactLayout() så de ikke
 * stacker oven på hinanden.
 */

const VARIANTS = [TEX.FOLLOWER_1, TEX.FOLLOWER_2, TEX.FOLLOWER_3, TEX.FOLLOWER_ARMS_UP]

export class Follower {
  scene: Phaser.Scene
  sprite: Phaser.GameObjects.Image
  offsetX: number
  offsetY: number
  depthIndex: number

  constructor(scene: Phaser.Scene, leaderX: number, leaderY: number, index: number) {
    this.scene = scene
    this.depthIndex = index
    // Fan ud bag Lars
    const row = Math.floor(index / 5)
    const col = (index % 5) - 2 // -2..+2
    this.offsetX = col * 64 + (Math.random() - 0.5) * 12
    this.offsetY = 70 + row * 48 + (Math.random() - 0.5) * 8

    const texture = VARIANTS[index % VARIANTS.length]
    const scale = Math.max(0.5, 1.05 - row * 0.12 - Math.random() * 0.05)

    this.sprite = scene.add
      .image(leaderX + this.offsetX, leaderY + this.offsetY, texture)
      .setOrigin(0.5, 1)
      .setScale(scale)
      // Længere tilbage → lavere depth så de tegnes bag dem foran
      .setDepth(DEPTH.FOLLOWERS - row)
      // Lidt mørkere jo længere tilbage
      .setTint(Phaser.Display.Color.GetColor(
        255 - row * 18,
        255 - row * 18,
        255 - row * 14,
      ))

    // Pop-in animation
    this.sprite.setScale(0.1)
    scene.tweens.add({
      targets: this.sprite,
      scale,
      duration: 260,
      ease: 'Back.out',
    })
  }

  onBeat(leaderX: number, leaderY: number, isDownbeat: boolean) {
    const tx = leaderX + this.offsetX
    const ty = leaderY + this.offsetY
    this.sprite.x = tx
    this.sprite.y = ty
    const dy = isDownbeat ? 10 : 6
    // Små random offsets så de ikke alle hopper identisk
    this.scene.tweens.add({
      targets: this.sprite,
      y: ty - dy - Math.random() * 4,
      duration: 90 + Math.random() * 40,
      yoyo: true,
      ease: 'Sine.inOut',
    })
  }

  destroy() {
    this.sprite.destroy()
  }
}
