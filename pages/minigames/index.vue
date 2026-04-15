<script setup lang="ts">
const router = useRouter()
const { getIdleQuote } = useJim()
const jimQuote = ref(getIdleQuote())

const games = [
  {
    id: 'porsche-dash',
    title: "Lars' Porsche Dash",
    description: 'Lars kører i den mest patetiske Porsche. Saml øl, undvig vikinger!',
    icon: 'mdi:car-sports',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/30',
    ready: true,
  },
  {
    id: 'fuld-lars',
    title: 'Fuld Lars',
    description: 'Lars er stiv som et bræt. Flap mellem ølkasserne!',
    icon: 'mdi:beer',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    ready: true,
  },
  {
    id: 'viking-lars',
    title: 'Viking Lars',
    description: 'Platformer med power-ups: Øl-Lars, Viking-Lars, Regnbue-Lars!',
    icon: 'mdi:shield-sword',
    color: 'text-pink-accent',
    bgColor: 'bg-pink-accent/10',
    borderColor: 'border-pink-accent/30',
    ready: true,
  },
  {
    id: 'viking-lars-v2',
    title: 'Viking Lars V2 (Phaser)',
    description: 'Eksperiment: samme spil rebuildet på Phaser 3-engine. Lars føles federe.',
    icon: 'mdi:flask-outline',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/40',
    ready: true,
  },
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <button
        class="w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-white transition-colors"
        @click="router.push('/')"
      >
        <Icon name="mdi:arrow-left" size="20" />
      </button>
      <h1 class="font-heading font-bold text-xl text-white">Minispil</h1>
      <div class="w-10" />
    </div>

    <div class="flex-1 flex items-start justify-center px-4 py-6">
      <div class="w-full max-w-lg">
        <!-- Jim intro -->
        <div class="mb-6">
          <JimQuote :quote="jimQuote" mode="inline" />
        </div>

        <!-- Game cards -->
        <div class="space-y-4">
          <NuxtLink
            v-for="game in games"
            :key="game.id"
            :to="`/minigames/${game.id}`"
            class="block glass rounded-2xl p-5 border transition-all hover:scale-[1.02] hover:shadow-lg group"
            :class="game.borderColor"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                :class="game.bgColor"
              >
                <Icon :name="game.icon" size="28" :class="game.color" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-heading font-bold text-white text-lg group-hover:text-accent transition-colors">
                  {{ game.title }}
                </h3>
                <p class="text-muted text-sm font-body mt-0.5">{{ game.description }}</p>
              </div>
              <Icon name="mdi:chevron-right" size="24" class="text-muted group-hover:text-accent transition-colors flex-shrink-0" />
            </div>
          </NuxtLink>
        </div>

        <!-- Back to main game -->
        <div class="mt-8 text-center">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 text-muted hover:text-accent transition-colors font-body text-sm"
          >
            <Icon name="mdi:arrow-left" size="16" />
            Tilbage til Er Det Lars?
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
