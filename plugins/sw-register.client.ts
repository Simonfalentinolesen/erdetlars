/**
 * Service worker registration — kun client-side.
 *
 * Strategi:
 * - Registrer /sw.js efter window load så det ikke blokerer first paint
 * - Hvis en ny version findes, prompter vi IKKE brugeren — vi lader den nye
 *   SW aktivere ved næste navigation (skipWaiting + clients.claim er sat i sw.js)
 * - I dev (Vite HMR) springer vi over for at undgå cache-helvede
 *
 * Fejlhåndtering: fail-silent. SW er progressive enhancement, ikke kritisk.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  if (!('serviceWorker' in navigator)) return

  // Skip i dev for at undgå konflikt med Vite HMR / hot reload
  if (import.meta.dev) return

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

      // Lyt efter ny SW der venter — bare log, ingen UI-prompt
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            // Ny version klar — vil tage over ved næste page load
            console.info('[sw] ny version installeret, aktiveres ved næste navigation')
          }
        })
      })
    } catch (err) {
      console.warn('[sw] registration failed:', err)
    }
  }

  // Vent til efter window load så vi ikke blokerer LCP
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
})
