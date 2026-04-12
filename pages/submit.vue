<script setup lang="ts">
const router = useRouter()

const activeTab = ref<'image' | 'fact'>('image')
const submitName = ref('')
const submitEmail = ref('')
const factText = ref('')
const isLars = ref<boolean | null>(null)
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const isVideoFile = ref(false)
const isSubmitting = ref(false)
const submitted = ref(false)
const submitMessage = ref('')
const errorMessage = ref('')

// Honeypot field - bots will fill this, humans won't see it
const honeypot = ref('')

// Simple math challenge anti-bot
const mathA = ref(Math.floor(Math.random() * 9) + 1)
const mathB = ref(Math.floor(Math.random() * 9) + 1)
const mathAnswer = ref('')
const correctMathAnswer = computed(() => mathA.value + mathB.value)

function refreshMath() {
  mathA.value = Math.floor(Math.random() * 9) + 1
  mathB.value = Math.floor(Math.random() * 9) + 1
  mathAnswer.value = ''
}

function validateForm(): boolean {
  errorMessage.value = ''

  if (!submitName.value.trim()) {
    errorMessage.value = 'Skriv dit navn!'
    return false
  }

  if (!submitEmail.value.trim() || !submitEmail.value.includes('@')) {
    errorMessage.value = 'Skriv en gyldig email!'
    return false
  }

  if (Number(mathAnswer.value) !== correctMathAnswer.value) {
    errorMessage.value = 'Forkert regnestykke - prøv igen!'
    refreshMath()
    return false
  }

  // Honeypot check
  if (honeypot.value) {
    // Silently reject bots
    submitted.value = true
    submitMessage.value = 'Tak! Dit bidrag er modtaget.'
    return false
  }

  return true
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const isImage = file.type.startsWith('image/')
  const isVid = file.type.startsWith('video/')
  if (!isImage && !isVid) {
    errorMessage.value = 'Kun billeder (JPG, PNG) eller video (MP4, MOV) er tilladt!'
    return
  }

  const maxSize = isVid ? 50 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    errorMessage.value = isVid ? 'Video må maks. være 50MB!' : 'Billede må maks. være 5MB!'
    return
  }

  imageFile.value = file
  isVideoFile.value = isVid
  errorMessage.value = ''

  if (isImage) {
    const reader = new FileReader()
    reader.onload = (e) => { imagePreview.value = e.target?.result as string }
    reader.readAsDataURL(file)
  } else {
    // Video preview via object URL
    imagePreview.value = URL.createObjectURL(file)
  }
}

function removeImage() {
  imageFile.value = null
  imagePreview.value = null
}

async function submitImage() {
  if (!imageFile.value || isLars.value === null) {
    errorMessage.value = 'Upload et billede og vælg om det er Lars!'
    return
  }
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    const formData = new FormData()
    formData.append('image', imageFile.value)
    formData.append('isLars', String(isLars.value))
    formData.append('submittedBy', submitName.value.trim())
    formData.append('email', submitEmail.value.trim())

    await $fetch('/api/submissions/image', {
      method: 'POST',
      body: formData,
    })

    submitted.value = true
    submitMessage.value = 'Dit billede er sendt til review!'
  } catch {
    submitted.value = true
    submitMessage.value = 'Billede modtaget! Vi kigger på det.'
  } finally {
    isSubmitting.value = false
  }
}

async function submitFact() {
  if (!factText.value.trim()) {
    errorMessage.value = 'Skriv en Lars Fakta!'
    return
  }
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    await $fetch('/api/submissions/fact', {
      method: 'POST',
      body: {
        fact: factText.value.trim(),
        submittedBy: submitName.value.trim(),
        email: submitEmail.value.trim(),
      },
    })

    submitted.value = true
    submitMessage.value = 'Lars Fakta modtaget!'
  } catch {
    submitted.value = true
    submitMessage.value = 'Lars Fakta modtaget! Vi kigger på den.'
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  submitted.value = false
  submitMessage.value = ''
  errorMessage.value = ''
  factText.value = ''
  imageFile.value = null
  imagePreview.value = null
  isVideoFile.value = false
  isLars.value = null
  refreshMath()
}
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
      <h1 class="font-heading font-bold text-xl text-white">Bidrag til spillet</h1>
      <div class="w-10" />
    </div>

    <!-- Content wrapper - centered on desktop -->
    <div class="flex-1 flex items-start justify-center px-4 py-6">
      <div class="w-full max-w-lg">

        <!-- Intro -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-3">
            <span class="text-xl">📸</span>
            <span class="text-sm text-muted font-body">Hjælp med at gøre spillet bedre!</span>
          </div>
          <p class="text-muted font-body text-sm leading-relaxed">
            Har du et sjovt billede af Lars? Eller kender du en der ligner?
            <br>Send det ind, så tilføjer vi det til spillet!
          </p>
        </div>

        <!-- Success state -->
        <div v-if="submitted" class="text-center py-12 animate-fade-in">
          <div class="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <Icon name="mdi:check-bold" size="40" class="text-success" />
          </div>
          <p class="font-heading font-bold text-xl text-white mb-2">{{ submitMessage }}</p>
          <p class="text-muted font-body text-sm mb-8">Vi gennemgår dit bidrag og tilføjer det til spillet.</p>
          <div class="flex flex-col sm:flex-row gap-3 max-w-xs mx-auto">
            <button
              class="flex-1 py-3 rounded-xl bg-accent text-primary font-heading font-semibold btn-press"
              @click="resetForm"
            >
              Send mere!
            </button>
            <NuxtLink
              to="/"
              class="flex-1 py-3 rounded-xl glass text-center text-white font-heading text-sm hover:bg-white/10"
            >
              Spil videre
            </NuxtLink>
          </div>
        </div>

        <!-- Form -->
        <div v-else>
          <!-- Tabs -->
          <div class="flex gap-2 mb-6">
            <button
              class="flex-1 py-3 rounded-xl font-heading font-semibold text-sm text-center transition-all flex items-center justify-center gap-2"
              :class="activeTab === 'image' ? 'bg-accent text-primary' : 'glass text-muted hover:text-white'"
              @click="activeTab = 'image'"
            >
              <Icon name="mdi:camera" size="18" />
              Send billede
            </button>
            <button
              class="flex-1 py-3 rounded-xl font-heading font-semibold text-sm text-center transition-all flex items-center justify-center gap-2"
              :class="activeTab === 'fact' ? 'bg-accent text-primary' : 'glass text-muted hover:text-white'"
              @click="activeTab = 'fact'"
            >
              <Icon name="mdi:lightbulb" size="18" />
              Lars Fakta
            </button>
          </div>

          <!-- Shared fields: Name + Email -->
          <div class="glass rounded-2xl p-5 mb-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-heading font-semibold text-muted mb-1.5 uppercase tracking-wider">Dit navn *</label>
                <input
                  v-model="submitName"
                  type="text"
                  placeholder="Hvem er du?"
                  maxlength="30"
                  class="w-full px-4 py-3 rounded-xl bg-primary border border-white/10 text-white font-body text-sm placeholder-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
                >
              </div>
              <div>
                <label class="block text-xs font-heading font-semibold text-muted mb-1.5 uppercase tracking-wider">Email *</label>
                <input
                  v-model="submitEmail"
                  type="email"
                  placeholder="din@email.dk"
                  class="w-full px-4 py-3 rounded-xl bg-primary border border-white/10 text-white font-body text-sm placeholder-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
                >
              </div>
            </div>

            <!-- Honeypot - hidden from humans -->
            <input
              v-model="honeypot"
              type="text"
              name="website"
              autocomplete="off"
              tabindex="-1"
              class="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
              aria-hidden="true"
            >
          </div>

          <!-- IMAGE TAB -->
          <div v-if="activeTab === 'image'" class="space-y-4 animate-fade-in">
            <!-- Image upload area -->
            <div class="glass rounded-2xl p-5">
              <label class="block text-xs font-heading font-semibold text-muted mb-3 uppercase tracking-wider">Billede *</label>

              <!-- Upload area / Preview -->
              <div class="relative">
                <div
                  v-if="!imagePreview"
                  class="w-full aspect-[3/2] rounded-xl border-2 border-dashed border-white/15 bg-primary/50 flex flex-col items-center justify-center cursor-pointer hover:border-accent/40 hover:bg-primary/80 transition-all group"
                  @click="($refs.fileInput as HTMLInputElement)?.click()"
                >
                  <div class="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                    <Icon name="mdi:cloud-upload-outline" size="28" class="text-accent" />
                  </div>
                  <p class="text-white/60 text-sm font-body">Tryk for at vælge billede eller video</p>
                  <p class="text-muted/40 text-xs font-body mt-1">JPG, PNG (5MB) eller MP4, MOV (50MB)</p>
                </div>

                <!-- Preview -->
                <div v-else class="relative w-full aspect-[3/2] rounded-xl overflow-hidden">
                  <video
                    v-if="isVideoFile"
                    :src="imagePreview!"
                    class="w-full h-full object-cover"
                    muted loop autoplay playsinline
                  />
                  <img v-else :src="imagePreview!" class="w-full h-full object-cover" />
                  <button
                    class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-error transition-colors"
                    @click="removeImage"
                  >
                    <Icon name="mdi:close" size="18" class="text-white" />
                  </button>
                </div>
              </div>

              <input
                ref="fileInput"
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                class="hidden"
                @change="handleFileSelect"
              >
            </div>

            <!-- Is Lars toggle -->
            <div class="glass rounded-2xl p-5">
              <label class="block text-xs font-heading font-semibold text-muted mb-3 uppercase tracking-wider">Er det Lars på billedet? *</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  class="py-3.5 rounded-xl font-heading font-semibold text-sm transition-all btn-press flex items-center justify-center gap-2"
                  :class="isLars === true ? 'bg-success text-white shadow-glow-green' : 'bg-primary border border-white/10 text-muted hover:text-white hover:border-white/20'"
                  @click="isLars = true"
                >
                  <Icon name="mdi:check" size="18" />
                  Ja, det er Lars!
                </button>
                <button
                  class="py-3.5 rounded-xl font-heading font-semibold text-sm transition-all btn-press flex items-center justify-center gap-2"
                  :class="isLars === false ? 'bg-pink-accent text-white' : 'bg-primary border border-white/10 text-muted hover:text-white hover:border-white/20'"
                  @click="isLars = false"
                >
                  <Icon name="mdi:close" size="18" />
                  Nej, en look-alike
                </button>
              </div>
            </div>
          </div>

          <!-- FACT TAB -->
          <div v-if="activeTab === 'fact'" class="space-y-4 animate-fade-in">
            <div class="glass rounded-2xl p-5">
              <label class="block text-xs font-heading font-semibold text-muted mb-3 uppercase tracking-wider">Din Lars Fakta *</label>
              <textarea
                v-model="factText"
                placeholder="F.eks. 'Lars har danset til techno i 12 timer non-stop'"
                maxlength="200"
                rows="3"
                class="w-full px-4 py-3 rounded-xl bg-primary border border-white/10 text-white font-body text-sm placeholder-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
              />
              <p class="text-right text-muted/30 text-xs font-mono mt-1">{{ factText.length }}/200</p>
            </div>

            <!-- Live preview -->
            <div v-if="factText.trim()" class="glass rounded-2xl p-5 text-center animate-fade-in">
              <p class="text-muted/50 text-[10px] font-heading uppercase tracking-widest mb-3">Sådan vil det se ud i spillet</p>
              <div class="inline-block glass rounded-xl p-5 max-w-xs">
                <div class="text-2xl mb-2">🍺</div>
                <p class="font-heading font-bold text-accent text-xs uppercase tracking-wider mb-2">Lars Fakta</p>
                <p class="text-white font-body text-sm leading-relaxed">{{ factText }}</p>
              </div>
            </div>
          </div>

          <!-- Anti-bot: Math challenge -->
          <div class="glass rounded-2xl p-5 mt-4">
            <label class="block text-xs font-heading font-semibold text-muted mb-2 uppercase tracking-wider">
              Bevis at du ikke er en robot
            </label>
            <div class="flex items-center gap-3">
              <span class="font-mono text-lg text-white">{{ mathA }} + {{ mathB }} =</span>
              <input
                v-model="mathAnswer"
                type="number"
                placeholder="?"
                class="w-20 px-4 py-3 rounded-xl bg-primary border border-white/10 text-white font-mono text-center text-lg placeholder-muted/40 focus:outline-none focus:border-accent/50 transition-colors"
                @keyup.enter="activeTab === 'image' ? submitImage() : submitFact()"
              >
              <button
                class="w-10 h-10 rounded-xl bg-primary border border-white/10 flex items-center justify-center text-muted hover:text-white hover:border-white/20 transition-colors"
                title="Nyt regnestykke"
                @click="refreshMath"
              >
                <Icon name="mdi:refresh" size="18" />
              </button>
            </div>
          </div>

          <!-- Error -->
          <p v-if="errorMessage" class="text-error text-sm text-center font-body mt-3 animate-fade-in">
            {{ errorMessage }}
          </p>

          <!-- Submit button -->
          <button
            class="w-full py-4 rounded-2xl bg-accent text-primary font-heading font-bold text-lg uppercase tracking-wider shadow-glow btn-press hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-5"
            :disabled="isSubmitting"
            @click="activeTab === 'image' ? submitImage() : submitFact()"
          >
            {{ isSubmitting ? 'Sender...' : activeTab === 'image' ? 'Send billede ind' : 'Send Lars Fakta ind' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
