/**
 * Techno Viking — centrale spil-konstanter.
 *
 * Designprincipper:
 * - Viewport 1080x720, samme som Viking Lars V2 så mobile aspect passer
 * - Note highway er semi-transparent overlay OVER den scrollende gade
 * - Timing i ms (relativt til AudioContext.currentTime som master clock)
 */

export const GAME_WIDTH = 1080
export const GAME_HEIGHT = 720

// Scene keys
export const SCENE = {
  BOOT: 'TV_BootScene',
  MENU: 'TV_MenuScene',
  GAME: 'TV_GameScene',
  HUD: 'TV_HUDScene',
  RESULTS: 'TV_ResultsScene',
} as const

// Note highway layout
export const HIGHWAY = {
  LANE_COUNT: 4,
  LANE_WIDTH: 90,
  HIT_ZONE_Y: 620, // y-position hvor arrows "rammes"
  SPAWN_Y: -40, // hvor arrows starter (over skærmen)
  TRAVEL_MS: 1400, // hvor længe en arrow er om at falde fra spawn til hit
  CENTER_X: 540,
} as const

// Timing windows (ms fra target hit-time)
export const TIMING = {
  PERFECT: 45,
  GREAT: 90,
  GOOD: 140,
  MISS: 180, // alt over dette = miss
} as const

// Scoring
export const SCORE = {
  PERFECT: 300,
  GREAT: 200,
  GOOD: 100,
  MISS: 0,
} as const

// Transformation thresholds (followers)
export const STAGE_THRESHOLDS = [0, 15, 40, 80, 140] as const
export const STAGE_NAMES = [
  'Casual Lars',
  'Warming Up',
  'Getting Loose',
  'The Shift',
  'TECHNO VIKING',
] as const

// Lanes — mapping til keyboard
export const LANE_KEYS = ['LEFT', 'DOWN', 'UP', 'RIGHT'] as const
export type LaneKey = (typeof LANE_KEYS)[number]
export const LANE_WASD = ['A', 'S', 'W', 'D'] as const

// Farver (hex tal til Phaser)
export const COLORS = {
  // Note highway
  LANE_LEFT: 0xff3b6b,
  LANE_DOWN: 0xff9a2c,
  LANE_UP: 0x4de0a1,
  LANE_RIGHT: 0x5ec8ff,
  LANE_BEER: 0xffd447,

  // Judgment
  JUDGE_PERFECT: 0xffd447,
  JUDGE_GREAT: 0x4de0a1,
  JUDGE_GOOD: 0x5ec8ff,
  JUDGE_MISS: 0xff3b6b,

  // Verden
  SKY_TOP: 0x0a0a1a,
  SKY_MID: 0x2a1048,
  STREET: 0x1a1a28,
  STREET_STRIPE: 0xf5d347,
  BUILDING: 0x2a2a3a,

  // Lars palette
  LARS_SKIN: 0xe8b89a,
  LARS_BEARD: 0x2a1f18,
  LARS_HOODIE: 0x0f0f14,
  LARS_SHORTS: 0x4a6b2a,
  LARS_TATTOO: 0x3a2a24,
  LARS_TATTOO_GLOW: 0xff5a88,

  // Jim palette
  JIM_SKIN: 0xf4e2d8,
  JIM_TATTOO: 0xcc1f2b,
  JIM_EYES: 0x4db8ff,
  JIM_ROBE: 0x8b1a2a,
  JIM_FUR: 0xe8d5a8,
} as const

// Depths (z-order)
export const DEPTH = {
  SKY: 0,
  BUILDINGS: 1,
  STREET: 2,
  FOLLOWERS: 5,
  LARS: 10,
  ENV: 12,
  JIM: 15,
  NOTE_LANE_BG: 20,
  NOTE: 22,
  HIT_FX: 24,
  HUD: 30,
  DIALOG: 40,
} as const

// Level tracking
export const LEVEL = {
  BPM: 120,
  DURATION_MS: 75_000, // ~75 sek demo-level
  BEATS_PER_MEASURE: 4,
  // Dynamik: vi scaler scroll-speed med combo
  SCROLL_BASE: 220,
  SCROLL_MAX: 520,
} as const

// LocalStorage
export const STORAGE = {
  HIGHSCORE: 'techno-viking-highscore',
  MAX_COMBO: 'techno-viking-max-combo',
} as const
