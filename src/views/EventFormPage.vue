<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="slug ? `/e/${slug}` : '/'" text="" />
        </ion-buttons>
        <ion-title>{{ slug ? 'Modifier l’event' : 'Nouvel event' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <form class="page-narrow" @submit.prevent="submit">
        <ion-list inset>
          <ion-item>
            <ion-input
              v-model="form.title"
              label="Titre"
              label-placement="stacked"
              placeholder="Anniversaire, soirée, rando…"
              :maxlength="120"
              required
              autofocus
            />
          </ion-item>
          <ion-item>
            <ion-input v-model="startsAt" type="datetime-local" label="Début" label-placement="stacked" required />
          </ion-item>
          <ion-item v-if="showEnd">
            <ion-input v-model="endsAt" type="datetime-local" label="Fin" label-placement="stacked" :min="startsAt" />
            <ion-button slot="end" fill="clear" color="medium" aria-label="Retirer la fin" @click="removeEnd">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-item>
          <ion-item v-else button :detail="false" @click="showEnd = true">
            <ion-label color="primary">+ Ajouter une heure de fin</ion-label>
          </ion-item>
          <ion-item>
            <ion-input
              v-model="form.location"
              label="Lieu"
              label-placement="stacked"
              placeholder="Adresse ou nom du lieu"
              :maxlength="300"
            />
          </ion-item>
          <ion-item>
            <ion-textarea
              v-model="form.description"
              label="Description"
              label-placement="stacked"
              placeholder="Programme, quoi ramener, infos pratiques…"
              :auto-grow="true"
              :rows="3"
              :maxlength="5000"
            />
          </ion-item>
        </ion-list>

        <ion-accordion-group class="ion-margin-horizontal">
          <ion-accordion value="advanced">
            <ion-item slot="header">
              <ion-label>Options de confidentialité</ion-label>
            </ion-item>
            <div slot="content">
              <ion-list>
                <ion-item>
                  <ion-select v-model="form.visibility" label="Qui peut voir l’event" interface="action-sheet">
                    <ion-select-option value="link">Les personnes qui ont le lien</ion-select-option>
                    <ion-select-option value="public" disabled>Tout le monde (bientôt)</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-toggle v-model="form.show_guest_list">
                    Liste des invités visible par tous
                    <p class="muted toggle-help">Sinon, toi seul vois qui a répondu</p>
                  </ion-toggle>
                </ion-item>
                <ion-item lines="none">
                  <ion-toggle v-model="form.allow_plus_ones">Autoriser les accompagnants (+1)</ion-toggle>
                </ion-item>
              </ion-list>
            </div>
          </ion-accordion>
        </ion-accordion-group>

        <div class="ion-padding">
          <ion-button type="submit" expand="block" :disabled="saving || !canSubmit">
            <ion-spinner v-if="saving" slot="start" name="crescent" />
            {{ slug ? 'Enregistrer' : 'Publier l’event' }}
          </ion-button>
          <p v-if="!slug && !isRegistered" class="muted hint">
            On te demandera juste ton e-mail pour publier : c’est ce qui te permet de gérer l’event et voir les réponses.
          </p>
          <ion-button
            v-if="slug && original && !original.cancelled_at"
            expand="block"
            fill="clear"
            color="danger"
            @click="cancelEvent"
          >
            Annuler l’event
          </ion-button>
        </div>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton,
  IonList, IonItem, IonInput, IonTextarea, IonLabel, IonIcon, IonToggle, IonSelect, IonSelectOption,
  IonAccordion, IonAccordionGroup, IonSpinner, alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { isRegistered, initAuth } from '@/lib/auth'
import { createEvent, getEventForEdit, updateEvent, type EventInput, type EventRow } from '@/lib/events'
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft'
import { toLocalInput } from '@/lib/format'

const props = defineProps<{ slug?: string }>()
const router = useRouter()

function defaultStart(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(20, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

const form = reactive<Omit<EventInput, 'starts_at' | 'ends_at'>>({
  title: '',
  description: '',
  location: '',
  visibility: 'link',
  show_guest_list: true,
  allow_plus_ones: true,
})
const startsAt = ref(defaultStart())
const endsAt = ref('')
const showEnd = ref(false)
const saving = ref(false)
const original = ref<EventRow | null>(null)

const canSubmit = computed(() => form.title.trim().length > 0 && !!startsAt.value)

function removeEnd() {
  endsAt.value = ''
  showEnd.value = false
}

function toInput(): EventInput {
  return {
    ...form,
    title: form.title.trim(),
    description: form.description?.trim() || null,
    location: form.location?.trim() || null,
    starts_at: new Date(startsAt.value).toISOString(),
    ends_at: endsAt.value ? new Date(endsAt.value).toISOString() : null,
  }
}

function fill(e: EventInput) {
  form.title = e.title
  form.description = e.description ?? ''
  form.location = e.location ?? ''
  form.visibility = e.visibility
  form.show_guest_list = e.show_guest_list
  form.allow_plus_ones = e.allow_plus_ones
  startsAt.value = toLocalInput(e.starts_at)
  endsAt.value = e.ends_at ? toLocalInput(e.ends_at) : ''
  showEnd.value = !!e.ends_at
}

async function toast(message: string, color = 'dark') {
  const t = await toastController.create({ message, duration: 2500, color, position: 'top' })
  await t.present()
}

async function publish(input: EventInput) {
  const created = await createEvent(input)
  clearDraft()
  await router.replace({ path: `/e/${created.slug}`, query: { created: '1' } })
}

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  try {
    const input = toInput()
    if (props.slug && original.value) {
      await updateEvent(original.value.id, input)
      await toast('Event mis à jour')
      router.back()
    } else if (!isRegistered.value) {
      saveDraft({ ...input, publishAfterLogin: true })
      await router.push({ path: '/login', query: { redirect: '/new', reason: 'publish' } })
    } else {
      await publish(input)
    }
  } catch (e) {
    await toast((e as Error).message, 'danger')
  } finally {
    saving.value = false
  }
}

async function cancelEvent() {
  if (!original.value) return
  const alert = await alertController.create({
    header: 'Annuler l’event ?',
    message: 'Les invités verront que l’event est annulé. Pense à les prévenir dans la conversation.',
    buttons: [
      { text: 'Non', role: 'cancel' },
      {
        text: 'Oui, annuler',
        role: 'destructive',
        handler: async () => {
          await updateEvent(original.value!.id, { cancelled_at: new Date().toISOString() })
          await router.replace(`/e/${props.slug}`)
        },
      },
    ],
  })
  await alert.present()
}

onIonViewWillEnter(async () => {
  await initAuth()
  if (props.slug) {
    const e = await getEventForEdit(props.slug)
    if (!e) {
      await toast('Event introuvable ou tu n’en es pas l’organisateur', 'danger')
      await router.replace('/')
      return
    }
    original.value = e
    fill(e)
    return
  }
  const draft = loadDraft()
  if (!draft) return
  fill(draft)
  // De retour de la connexion : on publie directement le brouillon
  if (draft.publishAfterLogin && isRegistered.value) {
    saving.value = true
    try {
      await publish(toInput())
    } catch (e) {
      await toast((e as Error).message, 'danger')
    } finally {
      saving.value = false
    }
  }
})
</script>

<style scoped>
.hint {
  font-size: 0.85rem;
  text-align: center;
  margin-top: 12px;
}
.toggle-help {
  font-size: 0.8rem;
  margin: 2px 0 0;
}
</style>
