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
  PARTICLES_BG: 3,
  BG_NEAR: 5,
  WORLD: 10,
  PICKUPS: 15,
  ENEMIES: 20,
  PLAYER: 25,
  PARTICLES: 28,
  BOSS_FX: 29,
  DIALOG: 50,
  HUD: 100,
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
  // Baggrunde (faktiske billedfiler)
  BG_FAR_L1: 'bg-far-l1',
  BG_MID_L1: 'bg-mid-l1',
  BG_NEAR_L1: 'bg-near-l1',

  // Lars varianter (procedural)
  TEX_LARS: 'tex-lars', // baseline / normal (bruges af sprite create())
  TEX_LARS_WALK_A: 'tex-lars-walk-a',
  TEX_LARS_WALK_B: 'tex-lars-walk-b',
  TEX_LARS_JUMP: 'tex-lars-jump',
  TEX_LARS_HAPPY: 'tex-lars-happy',
  TEX_LARS_SCARED: 'tex-lars-scared',
  TEX_LARS_VICTORY: 'tex-lars-victory',

  // Verden (procedural)
  TEX_GROUND: 'tex-ground',
  TEX_PLATFORM: 'tex-platform',

  // Fjender (procedural)
  TEX_MOSE_DRAUGER: 'tex-mose-drauger',
  TEX_MOSE_DRAUGER_B: 'tex-mose-drauger-b',
  TEX_FENRIS_HVALP: 'tex-fenris-hvalp',
  TEX_HUGINN_KRAGE: 'tex-huginn-krage',

  // Boss Surtr + projektiler
  TEX_SURTR: 'tex-surtr',
  TEX_SURTR_ROCK: 'tex-surtr-rock',

  // Items (procedural)
  TEX_BEER: 'tex-beer',
  TEX_SCROLL: 'tex-scroll',
  TEX_JIM_CROW: 'tex-jim-crow',

  // Partikler (procedural små dots/shapes)
  TEX_P_MIST: 'tex-p-mist',
  TEX_P_LEAF: 'tex-p-leaf',
  TEX_P_RAIN: 'tex-p-rain',
  TEX_P_EMBER: 'tex-p-ember',
  TEX_P_FIREFLY: 'tex-p-firefly',
  TEX_P_STAR: 'tex-p-star',
  TEX_P_DOT: 'tex-p-dot',
  TEX_P_GOLD: 'tex-p-gold',
} as const

// Animation-keys (centraliseret)
export const ANIM = {
  LARS_WALK: 'anim-lars-walk',
  DRAUGER_WALK: 'anim-drauger-walk',
} as const
