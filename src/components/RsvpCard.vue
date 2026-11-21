<template>
  <ion-card class="rsvp-card">
    <ion-card-content>
      <template v-if="!editing && myRsvp">
        <div class="current">
          <div>
            <p class="muted small">Ta réponse</p>
            <p class="answer">{{ LABELS[myRsvp.status] }}<span v-if="myRsvp.plus_ones"> (+{{ myRsvp.plus_ones }})</span></p>
            <p class="muted small">en tant que {{ myRsvp.display_name }}</p>
          </div>
          <ion-button fill="outline" size="small" @click="editing = true">Modifier</ion-button>
        </div>
      </template>

      <template v-else>
        <p class="question">Tu viens ?</p>
        <div class="choices">
          <ion-button
            v-for="c in CHOICES"
            :key="c.status"
            :fill="status === c.status ? 'solid' : 'outline'"
            :color="c.color"
            @click="status = c.status"
          >
            {{ c.emoji }} {{ c.label }}
          </ion-button>
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

        <ion-item v-if="status && status !== 'declined' && allowPlusOnes" lines="none">
          <ion-label>Accompagnants</ion-label>
          <div slot="end" class="stepper">
            <ion-button fill="clear" size="small" :disabled="plusOnes <= 0" aria-label="Moins" @click="plusOnes--">
              <ion-icon slot="icon-only" :icon="removeCircleOutline" />
            </ion-button>
            <span>{{ plusOnes }}</span>
            <ion-button fill="clear" size="small" :disabled="plusOnes >= 20" aria-label="Plus" @click="plusOnes++">
              <ion-icon slot="icon-only" :icon="addCircleOutline" />
            </ion-button>
          </div>
        </ion-item>

        <ion-button
          v-if="status"
          expand="block"
          class="ion-margin-top"
          :disabled="!name.trim() || saving"
          @click="submit"
        >
          <ion-spinner v-if="saving" slot="start" name="crescent" />
          Envoyer ma réponse
        </ion-button>
        <p v-if="status && !isRegistered" class="muted small center">Pas besoin de compte 👌</p>
      </template>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  IonCard, IonCardContent, IonButton, IonItem, IonInput, IonLabel, IonIcon, IonSpinner, toastController,
} from '@ionic/vue'
import { addCircleOutline, removeCircleOutline } from 'ionicons/icons'
import { currentUser, ensureGuestSession, isRegistered } from '@/lib/auth'
import { getMyDisplayName, respond, type EventDetails, type RsvpStatus } from '@/lib/events'

const props = defineProps<{
  slug: string
  myRsvp: EventDetails['my_rsvp']
  allowPlusOnes: boolean
}>()
const emit = defineEmits<{ answered: [status: RsvpStatus] }>()

const LABELS: Record<RsvpStatus, string> = { going: '✅ Je viens', maybe: '🤔 Peut-être', declined: '❌ Je ne viens pas' }
const CHOICES: { status: RsvpStatus; label: string; emoji: string; color: string }[] = [
  { status: 'going', label: 'Oui', emoji: '✅', color: 'success' },
  { status: 'maybe', label: 'Peut-être', emoji: '🤔', color: 'warning' },
  { status: 'declined', label: 'Non', emoji: '❌', color: 'medium' },
]

const editing = ref(!props.myRsvp)
const status = ref<RsvpStatus | null>(props.myRsvp?.status ?? null)
const name = ref(props.myRsvp?.display_name ?? '')
const plusOnes = ref(props.myRsvp?.plus_ones ?? 0)
const saving = ref(false)

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
.rsvp-card {
  border: 2px solid rgba(var(--ion-color-primary-rgb), 0.25);
  box-shadow: none;
}
.question {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ion-text-color);
  margin-bottom: 12px;
}
.choices {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.choices ion-button {
  margin: 0;
}
.name-item {
  margin-top: 12px;
  --padding-start: 0;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.answer {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ion-text-color);
  margin: 2px 0;
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
