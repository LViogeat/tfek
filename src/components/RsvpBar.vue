<template>
  <!-- Barre de réponse fixée en bas de la page : l'invité lit l'event d'abord, répond quand il veut -->
  <section class="bar" aria-label="Ta réponse">
    <Confetti v-if="burst" />
    <div class="inner">
      <slot />

      <div v-if="!editing && myRsvp" class="current">
        <div class="current-text">
          <span class="lbl muted">Ta réponse</span>
          <span class="answer disp">{{ LABELS[myRsvp.status] }}<span v-if="myRsvp.plus_ones"> +{{ myRsvp.plus_ones }}</span></span>
          <span class="muted small">en tant que {{ myRsvp.display_name }}</span>
        </div>
        <ion-button fill="outline" size="small" @click="editing = true">Modifier</ion-button>
      </div>

      <template v-else>
        <div class="head">
          <span id="rsvp-question" class="lbl muted">Tu viens ?</span>
          <button v-if="myRsvp" type="button" class="link" @click="cancelEdit">Annuler</button>
        </div>
        <div class="choices" role="group" aria-labelledby="rsvp-question">
          <button
            v-for="c in CHOICES"
            :key="c.status"
            type="button"
            class="pill"
            :class="{ selected: status === c.status }"
            :aria-pressed="status === c.status"
            @click="choose(c.status)"
          >
            {{ c.label }}
          </button>
        </div>

        <div v-if="status" class="details">
          <ion-item lines="full" class="field">
            <ion-input
              v-model="name"
              label="Ton prénom"
              label-placement="stacked"
              :maxlength="60"
              autocomplete="given-name"
              @keyup.enter="submit"
            />
          </ion-item>

          <ion-item v-if="status !== 'declined' && allowPlusOnes" lines="none" class="field">
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

          <ion-button expand="block" class="send" :disabled="!name.trim() || saving" @click="submit">
            <ion-spinner v-if="saving" slot="start" name="crescent" />
            Envoyer ma réponse
          </ion-button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { IonButton, IonItem, IonInput, IonLabel, IonIcon, IonSpinner, toastController } from '@ionic/vue'
import { addOutline, removeOutline } from 'ionicons/icons'
import Confetti from './Confetti.vue'
import { currentUser, ensureGuestSession } from '@/lib/auth'
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

function choose(s: RsvpStatus) {
  // Un second appui sur le choix en cours referme le formulaire (première réponse uniquement)
  status.value = status.value === s && !props.myRsvp ? null : s
}

function cancelEdit() {
  editing.value = false
  status.value = props.myRsvp?.status ?? null
  plusOnes.value = props.myRsvp?.plus_ones ?? 0
}

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
.bar {
  position: relative;
  background: var(--t-bg);
  border-top: 1px solid var(--tfek-line);
  padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px));
}
.inner {
  max-width: 608px;
  margin: 0 auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.link {
  border: 0;
  background: none;
  color: var(--tfek-muted);
  font: 600 13px/1 var(--ion-font-family);
  padding: 8px 0;
  cursor: pointer;
}
.choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.pill {
  min-height: 48px;
  border-radius: 10px;
  border: 1px solid rgba(244, 239, 230, 0.32);
  background: transparent;
  color: var(--tfek-text);
  font: 500 15px/1.1 var(--ion-font-family);
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
  color: var(--t-on-accent);
  font-weight: 700;
}
.pill:focus-visible {
  outline: 2px solid var(--tfek-text);
  outline-offset: 2px;
}
.details {
  margin-top: 4px;
}
.field {
  --padding-start: 0;
  --inner-padding-end: 0;
}
.send {
  margin-top: 12px;
  min-height: 48px;
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
}
.current-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.answer {
  font-size: 1.25rem;
}
.small {
  font-size: 0.8rem;
  margin: 0;
}
.center {
  text-align: center;
  margin-top: 8px;
}
</style>
