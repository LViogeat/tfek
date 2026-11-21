<template>
  <section class="rsvp" aria-labelledby="rsvp-question">
    <Confetti v-if="burst" />

    <template v-if="!editing && myRsvp">
      <div class="current">
        <div>
          <p class="lbl muted">Ta réponse</p>
          <p class="answer disp">{{ LABELS[myRsvp.status] }}<span v-if="myRsvp.plus_ones"> +{{ myRsvp.plus_ones }}</span></p>
          <p class="muted small">en tant que {{ myRsvp.display_name }}</p>
        </div>
        <ion-button fill="outline" size="small" @click="editing = true">Modifier</ion-button>
      </div>
    </template>

    <template v-else>
      <h2 id="rsvp-question" class="question disp">Tu viens ?</h2>
      <div class="choices">
        <button
          v-for="c in CHOICES"
          :key="c.status"
          type="button"
          class="pill"
          :class="{ selected: status === c.status }"
          :aria-pressed="status === c.status"
          @click="status = c.status"
        >
          {{ c.label }}
        </button>
      </div>

      <ion-item v-if="status" lines="full" class="name-item">
        <ion-input
          v-model="name"
          label="Ton prénom"
          label-placement="stacked"
          placeholder="Pour que l’organisateur sache qui tu es"
          :maxlength="60"
          autocomplete="given-name"
          @keyup.enter="submit"
        />
      </ion-item>

      <ion-item v-if="status && status !== 'declined' && allowPlusOnes" lines="none" class="name-item">
        <ion-label>Accompagnants</ion-label>
        <div slot="end" class="stepper">
          <ion-button fill="clear" size="small" :disabled="plusOnes <= 0" aria-label="Moins" @click="plusOnes--">
            <ion-icon slot="icon-only" :icon="removeOutline" />
          </ion-button>
          <span class="mono">{{ plusOnes }}</span>
          <ion-button fill="clear" size="small" :disabled="plusOnes >= 20" aria-label="Plus" @click="plusOnes++">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </div>
      </ion-item>

      <ion-button
        v-if="status"
        expand="block"
        class="send"
        :disabled="!name.trim() || saving"
        @click="submit"
      >
        <ion-spinner v-if="saving" slot="start" name="crescent" />
        Envoyer ma réponse
      </ion-button>
      <p v-if="status && !isRegistered" class="muted small center">Pas besoin de compte.</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { IonButton, IonItem, IonInput, IonLabel, IonIcon, IonSpinner, toastController } from '@ionic/vue'
import { addOutline, removeOutline } from 'ionicons/icons'
import Confetti from './Confetti.vue'
import { currentUser, ensureGuestSession, isRegistered } from '@/lib/auth'
import { getMyDisplayName, respond, type EventDetails, type RsvpStatus } from '@/lib/events'

const props = defineProps<{
  slug: string
  myRsvp: EventDetails['my_rsvp']
  allowPlusOnes: boolean
}>()
const emit = defineEmits<{ answered: [status: RsvpStatus] }>()

const LABELS: Record<RsvpStatus, string> = { going: 'Je viens', maybe: 'Peut-être', declined: 'Je ne viens pas' }
const CHOICES: { status: RsvpStatus; label: string }[] = [
  { status: 'going', label: 'Oui' },
  { status: 'maybe', label: 'Peut-être' },
  { status: 'declined', label: 'Non' },
]

const editing = ref(!props.myRsvp)
const status = ref<RsvpStatus | null>(props.myRsvp?.status ?? null)
const name = ref(props.myRsvp?.display_name ?? '')
const plusOnes = ref(props.myRsvp?.plus_ones ?? 0)
const saving = ref(false)
// Confettis, une seule fois, quand l'invité répond « Oui »
const burst = ref(false)

watch(
  () => props.myRsvp,
  (r) => {
    editing.value = !r
    status.value = r?.status ?? null
    if (r) {
      name.value = r.display_name
      plusOnes.value = r.plus_ones
    }
  },
)

// Pré-remplit le prénom connu (compte ou réponse précédente)
watch(
  () => currentUser.value?.id,
  async (id) => {
    if (!id || name.value) return
    name.value = (await getMyDisplayName(id)) ?? ''
  },
  { immediate: true },
)

async function submit() {
  if (!status.value || !name.value.trim() || saving.value) return
  saving.value = true
  try {
    await ensureGuestSession()
    await respond(props.slug, status.value, name.value.trim(), status.value === 'declined' ? 0 : plusOnes.value)
    editing.value = false
    if (status.value === 'going') {
      burst.value = true
      setTimeout(() => (burst.value = false), 1800)
    }
    emit('answered', status.value)
  } catch (e) {
    const t = await toastController.create({ message: (e as Error).message, color: 'danger', duration: 3000, position: 'top' })
    await t.present()
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.rsvp {
  position: relative;
  margin: 28px 16px 0;
}
.question {
  font-size: 1.6rem;
  margin: 0 0 14px;
}
.choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.pill {
  min-height: 56px;
  border-radius: 12px;
  border: 1.5px solid rgba(241, 237, 228, 0.5);
  background: transparent;
  color: var(--tfek-text);
  font: 600 16px/1.1 var(--ion-font-family);
  padding: 0 6px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, transform 0.1s;
}
.pill:active {
  transform: scale(0.97);
}
.pill.selected {
  background: var(--t-accent);
  border-color: var(--t-accent);
  color: var(--tfek-ink);
}
.pill:focus-visible {
  outline: 2px solid var(--tfek-text);
  outline-offset: 2px;
}
.name-item {
  margin-top: 8px;
  --padding-start: 0;
  --inner-padding-end: 0;
}
.send {
  margin-top: 16px;
  --border-radius: 12px;
  min-height: 52px;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 17px;
  font-weight: 700;
}
.current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1.5px solid var(--t-accent);
  border-radius: 14px;
  padding: 14px 16px;
}
.current p {
  margin: 0;
}
.answer {
  font-size: 1.5rem;
  margin: 4px 0 2px !important;
}
.small {
  font-size: 0.85rem;
  margin: 0;
}
.center {
  text-align: center;
  margin-top: 10px;
}
</style>
