<template>
  <ion-page :style="themeStyle(form.theme)">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="slug ? `/e/${slug}` : '/'" text="" />
        </ion-buttons>
        <ion-title>{{ slug ? 'Modifier l’évènement' : 'Nouvel évènement' }}</ion-title>
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

        <fieldset class="themes">
          <legend class="lbl muted">Couleur du billet</legend>
          <div class="theme-grid">
            <button
              v-for="t in THEMES"
              :key="t.id"
              type="button"
              class="theme"
              :class="{ selected: form.theme === t.id }"
              :aria-pressed="form.theme === t.id"
              :style="{ background: t.bg }"
              @click="form.theme = t.id"
            >
              <span class="theme-band" :style="{ background: t.band, borderColor: t.stamp }">
                <span class="theme-dot" :style="{ borderColor: t.stamp }" />
              </span>
              <span class="theme-name">{{ t.label }}</span>
            </button>
          </div>
        </fieldset>

        <ion-accordion-group class="ion-margin-horizontal">
          <ion-accordion value="advanced">
            <ion-item slot="header">
              <ion-label>Options de confidentialité</ion-label>
            </ion-item>
            <div slot="content">
              <ion-list>
                <ion-item>
                  <ion-select v-model="form.visibility" label="Qui peut voir l’évènement" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
                    <ion-select-option value="link">Ceux qui ont le lien</ion-select-option>
                    <ion-select-option value="public" disabled>Tout le monde (bientôt)</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select v-model="responsesVisibility" class="responses-select" label="Qui voit les réponses" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
                    <ion-select-option value="all">Tous : nombre et prénoms</ion-select-option>
                    <ion-select-option value="count">Tous : le nombre seulement</ion-select-option>
                    <ion-select-option value="me">Toi seul</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item lines="none">
                  <ion-toggle v-model="form.allow_plus_ones">Autoriser les +1</ion-toggle>
                </ion-item>
              </ion-list>
            </div>
          </ion-accordion>
        </ion-accordion-group>

        <ion-list v-if="fromSlug && sourceInvitees > 0" inset>
          <ion-item lines="none">
            <ion-toggle v-model="copyGuests">Reprendre les invités ({{ sourceInvitees }})</ion-toggle>
          </ion-item>
        </ion-list>

        <div class="ion-padding">
          <ion-button type="submit" expand="block" :disabled="saving || !canSubmit">
            <ion-spinner v-if="saving" slot="start" name="crescent" />
            {{ slug ? 'Enregistrer' : 'Publier l’évènement' }}
          </ion-button>
          <ion-button
            v-if="slug && original"
            expand="block"
            fill="outline"
            color="dark"
            class="duplicate"
            :router-link="`/new?from=${slug}`"
          >
            Dupliquer
          </ion-button>
          <ion-button
            v-if="slug && original && !original.cancelled_at"
            expand="block"
            fill="clear"
            color="danger"
            @click="cancelEvent"
          >
            Annuler l’évènement
          </ion-button>
        </div>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton,
  IonList, IonItem, IonInput, IonTextarea, IonLabel, IonIcon, IonToggle, IonSelect, IonSelectOption,
  IonAccordion, IonAccordionGroup, IonSpinner, alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { currentUser, isRegistered, initAuth } from '@/lib/auth'
import {
  copyInvitees, createEvent, getEventForEdit, getInvitees, postAnnouncement, updateEvent, type EventInput, type EventRow,
} from '@/lib/events'
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft'
import { changeSummary, isOver, shiftWeeks, toLocalInput, weeksUntilFuture } from '@/lib/format'
import { setPendingShare } from '@/lib/pendingShare'
import { DEFAULT_THEME, THEMES, getTheme, themeStyle } from '@/lib/themes'

const props = defineProps<{ slug?: string }>()
const router = useRouter()
const route = useRoute()

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
  show_counts: true,
  allow_plus_ones: true,
  theme: DEFAULT_THEME,
})

// Trois niveaux pour l'organisateur, stockés dans deux colonnes (la liste implique le nombre)
type ResponsesVisibility = 'all' | 'count' | 'me'
const responsesVisibility = computed<ResponsesVisibility>({
  get: () => (form.show_guest_list ? 'all' : form.show_counts ? 'count' : 'me'),
  set: (v) => {
    form.show_guest_list = v === 'all'
    form.show_counts = v !== 'me'
  },
})
const startsAt = ref(defaultStart())
const endsAt = ref('')
const showEnd = ref(false)
const saving = ref(false)
const original = ref<EventRow | null>(null)
// Identifiant de ce brouillon, envoyé à chaque publication : une nouvelle tentative après une erreur
// réseau (alors que l'évènement est déjà enregistré) renvoie le même évènement au lieu d'un doublon
const draftId = ref<string>(crypto.randomUUID())
// Dupliquer (/new?from=<slug>) : évènement source, nombre d'invités à reprendre
const fromSlug = ref<string | null>(null)
const sourceInvitees = ref(0)
const copyGuests = ref(true)
// Le formulaire a été rempli depuis un évènement source : à vider pour une création ordinaire
let filledFromSource = false
// Chaque entrée sur la page invalide les chargements précédents (réponse tardive d'une duplication)
let enterSeq = 0

const canSubmit = computed(() => form.title.trim().length > 0 && !!startsAt.value)

function resetForm() {
  form.title = ''
  form.description = ''
  form.location = ''
  form.visibility = 'link'
  form.show_guest_list = true
  form.show_counts = true
  form.allow_plus_ones = true
  form.theme = DEFAULT_THEME
  startsAt.value = defaultStart()
  endsAt.value = ''
  showEnd.value = false
}

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

function fill(e: Omit<EventInput, 'theme' | 'show_counts'> & { theme?: string | null; show_counts?: boolean }) {
  form.title = e.title
  form.description = e.description ?? ''
  form.location = e.location ?? ''
  form.visibility = e.visibility
  form.show_guest_list = e.show_guest_list
  // Les brouillons enregistrés avant l'ajout du réglage n'ont pas show_counts
  form.show_counts = (e.show_counts ?? true) || e.show_guest_list
  form.allow_plus_ones = e.allow_plus_ones
  form.theme = getTheme(e.theme).id
  startsAt.value = toLocalInput(e.starts_at)
  endsAt.value = e.ends_at ? toLocalInput(e.ends_at) : ''
  showEnd.value = !!e.ends_at
}

async function toast(message: string, color = 'dark') {
  const t = await toastController.create({ message, duration: 2500, color, position: 'top' })
  await t.present()
}

async function publish(input: EventInput) {
  const created = await createEvent(input, draftId.value)
  if (fromSlug.value && copyGuests.value && sourceInvitees.value > 0) {
    try {
      await copyInvitees(fromSlug.value, created.slug)
    } catch (e) {
      await toast(`Les invités n’ont pas pu être repris : ${(e as Error).message}`, 'danger')
    }
  }
  // Une duplication ne touche pas au brouillon en cours
  if (!fromSlug.value) clearDraft()
  // Ionic garde la page en cache : le prochain évènement aura son propre identifiant
  draftId.value = crypto.randomUUID()
  await router.replace({ path: `/e/${created.slug}`, query: { created: '1' } })
}

async function submit() {
  if (!canSubmit.value || saving.value) return
  if (endsAt.value && new Date(endsAt.value) < new Date(startsAt.value)) {
    await toast('La fin doit être après le début', 'danger')
    return
  }
  saving.value = true
  try {
    const input = toInput()
    if (props.slug && original.value) {
      const before = original.value
      await updateEvent(before.id, input)
      await announceChange(before, input)
      await toast('Évènement mis à jour')
      await backToEvent()
    } else if (!isRegistered.value) {
      saveDraft({ ...input, publishAfterLogin: true, draftId: draftId.value })
      // Le retour de connexion passe par /new?publish=1 : seul ce retour publie le brouillon
      await router.push({ path: '/login', query: { redirect: '/new?publish=1', reason: 'publish' } })
    } else {
      await publish(input)
    }
  } catch (e) {
    await toast((e as Error).message, 'danger')
  } finally {
    saving.value = false
  }
}

/** Retour à la page de l'évènement : par l'historique si on en vient, sinon en la remplaçant. */
async function backToEvent() {
  if (router.options.history.state.back === `/e/${props.slug}`) router.back()
  else await router.replace(`/e/${props.slug}`)
}

/**
 * Heure, date ou lieu changés : publie une info et la fait partager en arrivant sur la page.
 * Rien pour un évènement terminé (avant comme après) ou annulé ; un évènement en cours compte.
 */
async function announceChange(before: EventRow, after: EventInput) {
  const summary = changeSummary(before, after)
  if (!summary || (isOver(before) && isOver(after)) || before.cancelled_at || !props.slug) return
  try {
    await postAnnouncement(before.id, summary, 'change')
    setPendingShare(props.slug, summary)
  } catch (e) {
    await toast(`L’info n’a pas pu être publiée : ${(e as Error).message}`, 'danger')
  }
}

async function cancelEvent() {
  if (!original.value) return
  const alert = await alertController.create({
    header: 'Annuler l’évènement ?',
    buttons: [
      { text: 'Non', role: 'cancel' },
      {
        text: 'Oui, annuler',
        role: 'destructive',
        handler: async () => {
          try {
            const e = original.value!
            await updateEvent(e.id, { cancelled_at: new Date().toISOString() })
            // Évènement terminé : personne à prévenir
            if (!isOver(e)) {
              try {
                await postAnnouncement(e.id, 'Évènement annulé', 'cancel')
                setPendingShare(props.slug!, 'Évènement annulé')
              } catch {
                // L'annulation est faite : l'info manquante ne doit pas la masquer
              }
            }
            await router.replace(`/e/${props.slug}`)
          } catch (e) {
            await toast(`L’évènement n’a pas pu être annulé : ${(e as Error).message}`, 'danger')
          }
        },
      },
    ],
  })
  await alert.present()
}

/** Dupliquer : copie de l'évènement source, une semaine plus tard (ou la prochaine semaine à venir). */
async function fillFromSource(from: string, seq: number) {
  resetForm()
  fromSlug.value = null
  sourceInvitees.value = 0
  copyGuests.value = true
  draftId.value = crypto.randomUUID()
  filledFromSource = true
  const user = currentUser.value
  const src = user && isRegistered.value ? await getEventForEdit(from, user.id).catch(() => null) : null
  // Source introuvable ou pas organisateur : formulaire vide, sans message
  if (!src || seq !== enterSeq) return
  const weeks = weeksUntilFuture(src.starts_at)
  fill({
    ...src,
    starts_at: shiftWeeks(src.starts_at, weeks),
    ends_at: src.ends_at ? shiftWeeks(src.ends_at, weeks) : null,
  })
  const count = (await getInvitees(from).catch(() => [])).length
  if (seq !== enterSeq) return
  fromSlug.value = from
  sourceInvitees.value = count
}

onIonViewWillEnter(async () => {
  const seq = ++enterSeq
  await initAuth()
  if (seq !== enterSeq) return
  if (props.slug) {
    const e = currentUser.value && isRegistered.value
      ? await getEventForEdit(props.slug, currentUser.value.id).catch(() => null)
      : null
    if (seq !== enterSeq) return
    if (!e) {
      await toast('Évènement introuvable ou tu n’en es pas l’organisateur', 'danger')
      await router.replace('/')
      return
    }
    original.value = e
    fill(e)
    return
  }
  const from = typeof route.query.from === 'string' ? route.query.from : null
  if (from) {
    await fillFromSource(from, seq)
    return
  }
  if (filledFromSource) {
    // Retour sur une création ordinaire après une duplication
    resetForm()
    fromSlug.value = null
    filledFromSource = false
  }
  const draft = loadDraft()
  if (!draft) return
  fill(draft)
  if (draft.draftId) draftId.value = draft.draftId
  const returningFromLogin = route.query.publish === '1'
  if (!returningFromLogin || !draft.publishAfterLogin || !isRegistered.value) {
    // Brouillon abandonné : on pré-remplit seulement, sans publier
    if (draft.publishAfterLogin) saveDraft({ ...draft, publishAfterLogin: false })
    return
  }
  // De retour de la connexion juste après « Publier » : on publie le brouillon (une seule tentative ;
  // en cas d'échec le formulaire reste rempli et l'utilisateur peut republier)
  saveDraft({ ...draft, publishAfterLogin: false })
  saving.value = true
  try {
    await publish(toInput())
  } catch (e) {
    await toast((e as Error).message, 'danger')
  } finally {
    saving.value = false
  }
})
</script>

<style scoped>
.duplicate {
  margin-top: 8px;
}
.themes {
  border: 0;
  margin: 8px 16px 16px;
  padding: 0;
  min-width: 0;
}
.themes legend {
  padding: 0;
  margin-bottom: 10px;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.theme {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-height: 64px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--tfek-line);
  color: var(--tfek-text);
  font: 500 12px/1.2 var(--ion-font-family);
  text-align: left;
  cursor: pointer;
}
.theme.selected {
  border-color: var(--t-accent);
  box-shadow: inset 0 0 0 1px var(--t-accent);
}
.theme:focus-visible {
  outline: 2px solid var(--tfek-text);
  outline-offset: 2px;
}
.theme-band {
  position: relative;
  height: 30px;
  border-radius: 6px;
  border: 1px solid;
  background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 7px) !important;
}
/* Rappel du tampon */
.theme-dot {
  position: absolute;
  right: 6px;
  top: 5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid;
}
.toggle-help {
  font-size: 0.8rem;
  margin: 2px 0 0;
}
</style>
