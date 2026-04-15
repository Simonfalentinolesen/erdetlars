/**
 * Centrale spil-konstanter til Viking Lars V2.
 *
 * Designprincipper:
 * - Logiske spil-verdens-koordinater i pixels (kameraet zoom-skalerer)
 * - GAME_WIDTH/HEIGHT er VIEW-størrelse, ikke world-størrelse
 * - WORLD_GRAVITY i px/s² (Phaser's Arcade physics)
 */

// Viewport — passer på mobile portrait (9:16 → vi går 9:14 for landscape-feel)
export const GAME_WIDTH = 1080
export const GAME_HEIGHT = 720
export const ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT

// World physics
export const WORLD_GRAVITY = 1400
export const WORLD_ZOOM = 1.6 // Lars føles større end V1's 1.0

// Lars (player)
export const LARS_SPEED = 280 // px/s sideways
export const LARS_JUMP_VELOCITY = -650
export const LARS_DOUBLE_JUMP_VELOCITY = -550 // mindre end første hop
export const LARS_WIDTH = 42
export const LARS_HEIGHT = 56

// Game rules
export const STARTING_LIVES = 3
export const ITEM_POINTS = 100
export const ENEMY_KILL_POINTS = 250
export const BOSS_KILL_POINTS = 1000
export const COIN_POINTS = 50

// Layers (z-order via depth)
export const DEPTH = {
  BG_FAR: 0,
  BG_MID: 1,
  BG_NEAR: 2,
  WORLD: 10,
  PICKUPS: 15,
  ENEMIES: 20,
  PLAYER: 25,
  PARTICLES: 28,
  HUD: 100,
  DIALOG: 200,
} as const

// Scene-keys (centraliseret så vi undgår string-typos)
export const SCENE = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MenuScene',
  LEVEL1: 'Level1Scene',
  HUD: 'HUDScene',
  DIALOG: 'DialogueScene',
  GAMEOVER: 'GameOverScene',
} as const

// Asset-keys (centraliseret)
export const ASSET = {
  BG_FAR_L1: 'bg-far-l1',
  BG_MID_L1: 'bg-mid-l1',
  BG_NEAR_L1: 'bg-near-l1',
  // Procedurelt genererede textures (oprettes i PreloadScene)
  TEX_LARS: 'tex-lars',
  TEX_GROUND: 'tex-ground',
  TEX_PLATFORM: 'tex-platform',
  TEX_BEER: 'tex-beer',
  TEX_MOSE_DRAUGER: 'tex-mose-drauger',
} as const
