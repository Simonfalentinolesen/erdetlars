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
  answers: { imageId: number; guessedLars: boolean; correct: boolean; timeMs: number }[]
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
  difficulty: 'rookie' | 'viking' | 'impossible' | 'legendary'
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
  }

  function setNickname(name: string) {
    state.value.nickname = name.trim().substring(0, 20)
    if (import.meta.client) {
      localStorage.setItem('erdetlars_nickname', state.value.nickname)
    }
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

  function answer(guessedLars: boolean): { correct: boolean; points: number; multiplier: number; speedBonus: boolean; message: string } {
    const image = getCurrentImage()
    if (!image) {
      return { correct: false, points: 0, multiplier: 1, speedBonus: false, message: '' }
    }

    const now = Date.now()
    const answerTime = now - state.value.lastAnswerTime
    state.value.lastAnswerTime = now

    const correct = image.isLars === guessedLars

    // Calculate points
    let points = correct ? 100 : -50
    const speedBonus = correct && answerTime < 2000
    if (speedBonus) points += 50

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

    const multiplier = getMultiplier()
    const finalPoints = Math.round(points * multiplier)
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

    return { correct, points: finalPoints, multiplier, speedBonus, message }
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
