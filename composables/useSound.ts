export const useSound = () => {
  const enabled = useState('soundEnabled', () => false)

  // Sounds will be loaded lazily when first enabled
  // For now, this is a stub that can be connected to Howler.js later
  // when actual sound files are added to /public/sounds/

  function toggle() {
    enabled.value = !enabled.value
  }

  function playCorrect() {
    if (!enabled.value) return
    // Will play correct.mp3 when available
  }

  function playWrong() {
    if (!enabled.value) return
    // Will play wrong.mp3 when available
  }

  function playStreak() {
    if (!enabled.value) return
    // Will play streak.mp3 when available
  }

  function playPerfect() {
    if (!enabled.value) return
    // Will play perfect.mp3 when available
  }

  return {
    enabled,
    toggle,
    playCorrect,
    playWrong,
    playStreak,
    playPerfect,
  }
}
