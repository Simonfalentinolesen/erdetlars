export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/fonts',
    '@nuxt/icon',
  ],

  app: {
    head: {
      title: 'Er Det Lars? | Kan DU spotte den rigtige Lars?',
      htmlAttrs: { lang: 'da' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no' },
        { name: 'description', content: 'Swipe og gæt: Er det Lars eller ej? Det ultimative Lars-gættespil!' },
        { name: 'theme-color', content: '#0F1923' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'ErDetLars' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'application-name', content: 'ErDetLars' },
        { name: 'format-detection', content: 'telephone=no' },
        { property: 'og:title', content: 'Er Det Lars?' },
        { property: 'og:description', content: 'Kan DU spotte den rigtige Lars? Swipe og find ud af det!' },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  fonts: {
    families: [
      { name: 'Space Grotesk', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'DM Sans', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 700] },
    ],
  },

  tailwindcss: {
    configPath: 'tailwind.config.ts',
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
  },

  nitro: {
    preset: 'node-server',
  },

  // Client-side rendering - game state lives in memory, SSR causes hydration issues
  ssr: false,

  devtools: { enabled: false },
})
