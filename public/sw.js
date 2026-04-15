/**
 * ErDetLars service worker — minimal version.
 *
 * Strategi:
 * - Static assets (icons, fonts, billeder): cache-first så de loades hurtigt offline
 * - HTML + API: network-first med cache fallback (vis sidste kendte indhold offline)
 * - Cache version-key så vi kan bumpe med ny deploy → gamle caches ryddes
 *
 * VIGTIGT: Nuxt SSR:false betyder at JS-bundle navne ændres pr. build.
 * Vi cacher derfor IKKE selve _nuxt/*.js — vi cacher kun statiske assets
 * (det shell der altid er på siden) og lader Nuxt's egen runtime håndtere bundles.
 */
const CACHE_VERSION = 'v1'
const STATIC_CACHE = `erdetlars-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `erdetlars-runtime-${CACHE_VERSION}`

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Skip cross-origin
  if (url.origin !== self.location.origin) return

  // API calls: network-first, fallback til cache hvis offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE))
    return
  }

  // Billeder: cache-first (de skifter sjældent)
  if (url.pathname.startsWith('/images/') || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/i)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // HTML/dokumenter: network-first med shell-fallback offline
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE).catch(() => caches.match('/') || new Response('Offline', { status: 503 })))
    return
  }

  // Default: forsøg cache, ellers netværk
  event.respondWith(cacheFirst(req, RUNTIME_CACHE))
})

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req)
  if (cached) return cached
  try {
    const fresh = await fetch(req)
    if (fresh.ok) {
      const cache = await caches.open(cacheName)
      cache.put(req, fresh.clone())
    }
    return fresh
  } catch {
    return cached || new Response('Offline', { status: 503 })
  }
}

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req)
    if (fresh.ok) {
      const cache = await caches.open(cacheName)
      cache.put(req, fresh.clone())
    }
    return fresh
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    throw new Error('No network and no cache')
  }
}
