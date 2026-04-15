import imageData from '~/data/images.json'
import messagesData from '~/data/messages.json'
import factsData from '~/data/facts.json'

export interface GameImage {
  id: number
  file: string
  isLars: boolean
  difficulty: string
  type?: 'image' | 'video'
}

export interface GameResult {
  score: number
  correct: number
  wrong: number
  bestStreak: number
  durationMs: number
  totalSwiped: number
  difficulty: DifficultyId
  answers: { imageId: number; guessedLars: boolean; correct: boolean; timeMs: number }[]
}

export type DifficultyId = 'rookie' | 'viking' | 'impossible' | 'legendary'

export interface DifficultyConfig {
  id: DifficultyId
  label: string
  description: string
  icon: string
  color: string
  // Gameplay modifiers
  timerPerSwipeMs: number | null  // null = no timer
  pointsCorrect: number           // base points for correct answer
  pointsWrong: number             // penalty for wrong answer (negative)
  speedBonusMs: number            // answer faster than this → bonus
  speedBonusPts: number           // speed bonus amount
  scoreMultiplier: number         // applied on top of streak-multiplier
  powerUpsEnabled: boolean        // Legendary disables power-ups
}

/**
 * Sværhedsgrader tuner gameplay uden at filtrere billeder (alle 47 er "rookie"-tagget).
 * Hver sværhedsgrad kombinerer timer-pres + pointregulering + straf → giver reel difference.
 * `scoreMultiplier` ligger OVEN PÅ streak-multiplier så hardcore-spillere bliver belønnet.
 */
export const DIFFICULTY_CONFIG: Record<DifficultyId, DifficultyConfig> = {
  rookie: {
    id: 'rookie',
    label: 'Rookie',
    description: 'Ingen timer · lær spillet',
    icon: 'mdi:account-outline',
    color: '#00D68F',
    timerPerSwipeMs: null,
    pointsCorrect: 100,
    pointsWrong: -50,
    speedBonusMs: 2000,
    speedBonusPts: 50,
    scoreMultiplier: 1.0,
    powerUpsEnabled: true,
  },
  viking: {
    id: 'viking',
    label: 'Viking',
    description: '8 sek · +25% point',
    icon: 'mdi:shield-sword',
    color: '#F5A623',
    timerPerSwipeMs: 8000,
    pointsCorrect: 100,
    pointsWrong: -75,
    speedBonusMs: 1500,
    speedBonusPts: 75,
    scoreMultiplier: 1.25,
    powerUpsEnabled: true,
  },
  impossible: {
    id: 'impossible',
    label: 'Umulig',
    description: '5 sek · dobbelt straf · 1.5×',
    icon: 'mdi:skull',
    color: '#E84393',
    timerPerSwipeMs: 5000,
    pointsCorrect: 100,
    pointsWrong: -150,
    speedBonusMs: 1000,
    speedBonusPts: 100,
    scoreMultiplier: 1.5,
    powerUpsEnabled: true,
  },
  legendary: {
    id: 'legendary',
    label: 'Legendarisk',
    description: '3 sek · ingen power-ups · 2×',
    icon: 'mdi:crown',
    color: '#DAA520',
    timerPerSwipeMs: 3000,
    pointsCorrect: 100,
    pointsWrong: -200,
    speedBonusMs: 800,
    speedBonusPts: 200,
    scoreMultiplier: 2.0,
    powerUpsEnabled: false,
  },
}

export interface GameState {
  screen: 'start' | 'playing' | 'result'
  // Infinite queue of images - reshuffled when exhausted
  queue: GameImage[]
  queueIndex: number
  answers: { imageId: number; guessedLars: boolean; correct: boolean; timeMs: number }[]
  lastResult: GameResult | null
  score: number
  streak: number
  bestStreak: number
  totalCorrect: number
  totalWrong: number
  totalSwiped: number
  totalRounds: number
  startTime: number
  lastAnswerTime: number
  nickname: string
  difficulty: DifficultyId
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const useGame = () => {
  const state = useState<GameState>('game', () => ({
    screen: 'start',
    queue: [],
    queueIndex: 0,
    answers: [],
    lastResult: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    totalCorrect: 0,
    totalWrong: 0,
    totalSwiped: 0,
    totalRounds: 0,
    startTime: 0,
    lastAnswerTime: 0,
    nickname: '',
    difficulty: 'rookie',
  }))

  if (import.meta.client) {
    const saved = localStorage.getItem('erdetlars_nickname')
    if (saved) state.value.nickname = saved
    const savedDiff = localStorage.getItem('erdetlars_difficulty')
    if (savedDiff && savedDiff in DIFFICULTY_CONFIG) {
      state.value.difficulty = savedDiff as DifficultyId
    }
  }

  function setNickname(name: string) {
    state.value.nickname = name.trim().substring(0, 20)
    if (import.meta.client) {
      localStorage.setItem('erdetlars_nickname', state.value.nickname)
    }
  }

  function setDifficulty(id: DifficultyId) {
    state.value.difficulty = id
    if (import.meta.client) {
      localStorage.setItem('erdetlars_difficulty', id)
    }
  }

  function getDifficultyConfig(): DifficultyConfig {
    return DIFFICULTY_CONFIG[state.value.difficulty]
  }

  function buildQueue(): GameImage[] {
    // Use ALL images from the data file, shuffled randomly
    const allImages = imageData.images as GameImage[]
    return shuffle(allImages)
  }

  function startGame() {
    state.value.queue = buildQueue()
    state.value.queueIndex = 0
    state.value.answers = []
    state.value.score = 0
    state.value.streak = 0
    state.value.bestStreak = 0
    state.value.startTime = Date.now()
    state.value.lastAnswerTime = Date.now()
    state.value.screen = 'playing'
  }

  function getMultiplier(): number {
    if (state.value.streak >= 10) return 3.0
    if (state.value.streak >= 5) return 2.0
    if (state.value.streak >= 3) return 1.5
    return 1.0
  }

  function answer(guessedLars: boolean, opts: { timedOut?: boolean } = {}): { correct: boolean; points: number; multiplier: number; speedBonus: boolean; message: string; timedOut: boolean } {
    const image = getCurrentImage()
    if (!image) {
      return { correct: false, points: 0, multiplier: 1, speedBonus: false, message: '', timedOut: false }
    }

    const diff = getDifficultyConfig()
    const now = Date.now()
    const answerTime = now - state.value.lastAnswerTime
    state.value.lastAnswerTime = now

    // Timer-udløb (kun muligt på Viking+) behandles altid som forkert svar.
    const timedOut = opts.timedOut === true
    const correct = !timedOut && image.isLars === guessedLars

    // Point beregnes fra difficulty-config frem for hårdkodede tal.
    let points = correct ? diff.pointsCorrect : diff.pointsWrong
    const speedBonus = correct && answerTime < diff.speedBonusMs
    if (speedBonus) points += diff.speedBonusPts

    // Update streak
    if (correct) {
      state.value.streak++
      if (state.value.streak > state.value.bestStreak) {
        state.value.bestStreak = state.value.streak
      }
      state.value.totalCorrect++
    } else {
      state.value.streak = 0
      state.value.totalWrong++
    }

    // Final multiplier = streak × difficulty (difficulty giver ekstra gulrod for hardcore-spillere).
    const streakMult = getMultiplier()
    const totalMult = streakMult * diff.scoreMultiplier
    const finalPoints = Math.round(points * totalMult)
    state.value.score = Math.max(0, state.value.score + finalPoints)
    state.value.totalSwiped++

    // Record answer
    state.value.answers.push({
      imageId: image.id,
      guessedLars,
      correct,
      timeMs: answerTime,
    })

    // Advance queue - reshuffle when exhausted (infinite loop)
    state.value.queueIndex++
    if (state.value.queueIndex >= state.value.queue.length) {
      state.value.queue = buildQueue()
      state.value.queueIndex = 0
    }

    // Get message
    const msgPool = correct ? messagesData.correct : messagesData.wrong
    const message = msgPool[Math.floor(Math.random() * msgPool.length)]

    return { correct, points: finalPoints, multiplier: totalMult, speedBonus, message, timedOut }
  }

  function stopGame() {
    state.value.totalRounds++

    const totalMs = Date.now() - state.value.startTime
    state.value.lastResult = {
      score: state.value.score,
      correct: state.value.answers.filter(a => a.correct).length,
      wrong: state.value.answers.filter(a => !a.correct).length,
      bestStreak: state.value.bestStreak,
      durationMs: totalMs,
      totalSwiped: state.value.totalSwiped,
      difficulty: state.value.difficulty,
      answers: [...state.value.answers],
    }

    state.value.screen = 'result'
  }

  function getCurrentImage(): GameImage | null {
    if (state.value.queueIndex >= state.value.queue.length) return null
    return state.value.queue[state.value.queueIndex]
  }

  function getNextImage(): GameImage | null {
    const nextIdx = state.value.queueIndex + 1
    if (nextIdx >= state.value.queue.length) return state.value.queue[0] || null
    return state.value.queue[nextIdx]
  }

  function getScoreComment(): string {
    const score = state.value.lastResult?.score ?? state.value.score
    const comments = messagesData.scoreComments as Record<string, string>
    const thresholds = Object.keys(comments).map(Number).sort((a, b) => b - a)
    for (const threshold of thresholds) {
      if (score >= threshold) return comments[String(threshold)]
    }
    return comments['0']
  }

  function getRandomFact(): string {
    return factsData.facts[Math.floor(Math.random() * factsData.facts.length)]
  }

  function getStreakMessage(): string | null {
    const msgs = messagesData.streakMessages as Record<string, string>
    return msgs[String(state.value.streak)] || null
  }

  return {
    state,
    setNickname,
    setDifficulty,
    getDifficultyConfig,
    startGame,
    answer,
    stopGame,
    getCurrentImage,
    getNextImage,
    getScoreComment,
    getRandomFact,
    getStreakMessage,
    getMultiplier,
  }
}
