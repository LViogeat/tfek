<template>
  <ion-page :style="themeStyle(event?.theme)">
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" text="" />
        </ion-buttons>
        <ion-buttons v-if="event" slot="end">
          <ion-button v-if="event.is_organizer" :router-link="`/e/${slug}/edit`" aria-label="Modifier">
            <ion-icon slot="icon-only" :icon="createOutline" />
          </ion-button>
          <ion-button aria-label="Partager" @click="shareInvitation">
            <ion-icon slot="icon-only" :icon="shareOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div v-if="loading && !event" class="center ion-padding">
        <ion-spinner name="crescent" />
      </div>

      <div v-else-if="!event" class="center ion-padding">
        <h2 class="disp">Event introuvable</h2>
        <p class="muted">Le lien est peut-être incorrect, ou l’event a été supprimé.</p>
        <ion-button router-link="/" fill="outline">Retour à l’accueil</ion-button>
      </div>

      <div v-else class="page-narrow">
        <!-- Juste après la création : on pousse l'organisateur à partager -->
        <div v-if="justCreated && event.is_organizer" class="created">
          <p class="disp created-title">Ton event est en ligne.</p>
          <p class="muted">Partage le lien dans ta conversation de groupe pour que tes invités répondent.</p>
          <ion-button expand="block" @click="shareInvitation">
            <ion-icon slot="start" :icon="shareOutline" />
            Inviter mes amis
          </ion-button>
        </div>

        <div class="ticket-wrap">
          <EventTicket :event="event" @calendar="addToCalendar" />
        </div>

        <!-- Dernière annonce mise en avant -->
        <div v-if="announcements.length" class="announce">
          <div class="lbl announce-head">
            Info de {{ event.organizer_name }} · {{ formatRelative(announcements[0]!.created_at) }}
          </div>
          <p>{{ announcements[0]!.body }}</p>
        </div>

        <template v-if="event.description">
          <h2 class="section-title">Le mot de {{ event.organizer_name }}</h2>
          <p class="description">{{ event.description }}</p>
        </template>

        <!-- Organisateur : outils -->
        <template v-if="event.is_organizer">
          <h2 class="section-title">Publier une info</h2>
          <div class="compose">
            <ion-textarea
              v-model="newAnnouncement"
              placeholder="Changement d’heure, code de la porte, quoi ramener…"
              :auto-grow="true"
              :rows="2"
              :maxlength="2000"
            />
            <ion-button
              expand="block"
              :disabled="!newAnnouncement.trim() || posting"
              @click="publishAnnouncement"
            >
              <ion-icon slot="start" :icon="megaphoneOutline" />
              Publier et partager
            </ion-button>
          </div>
        </template>

        <template v-if="announcements.length > 1 || (event.is_organizer && announcements.length)">
          <h2 class="section-title">Toutes les infos</h2>
          <ul class="all-infos">
            <li v-for="a in announcements" :key="a.id">
              <div class="info-text">
                <div class="lbl muted">{{ formatRelative(a.created_at) }}</div>
                <div class="announce-body">{{ a.body }}</div>
              </div>
              <template v-if="event.is_organizer">
                <ion-button fill="clear" color="dark" aria-label="Partager l’info" @click="shareAnnouncement(a.body)">
                  <ion-icon slot="icon-only" :icon="shareOutline" />
                </ion-button>
                <ion-button fill="clear" color="medium" aria-label="Supprimer" @click="removeAnnouncement(a.id)">
                  <ion-icon slot="icon-only" :icon="trashOutline" />
                </ion-button>
              </template>
            </li>
          </ul>
        </template>

        <h2 class="section-title">Qui vient</h2>
        <p class="counts mono">
          <strong>{{ event.counts.going }} oui</strong>
          <span v-if="event.counts.maybe" class="muted"> · {{ event.counts.maybe }} peut-être</span>
        </p>
        <template v-if="event.show_guest_list || event.is_organizer">
          <p v-if="event.is_organizer && !event.show_guest_list" class="muted small pad">
            Liste visible par toi uniquement.
          </p>
          <GuestList :guests="guests" />
        </template>
        <p v-else class="muted pad">L’organisateur a choisi de garder la liste des invités privée.</p>

        <div v-if="event.is_organizer && !event.cancelled_at" class="ion-padding">
          <ion-button expand="block" fill="outline" color="dark" @click="shareReminder">
            <ion-icon slot="start" :icon="notificationsOutline" />
            Relancer ceux qui n’ont pas répondu
          </ion-button>
        </div>

        <div class="footer muted">
          <router-link to="/new">Organise ton propre event avec tfek</router-link>
        </div>
      </div>
    </ion-content>

    <ion-footer v-if="event && !event.cancelled_at && !event.is_organizer" class="ion-no-border">
      <RsvpBar :slug="slug" :my-rsvp="event.my_rsvp" :allow-plus-ones="event.allow_plus_ones" @answered="onAnswered">
        <div v-if="showAccountNudge" class="nudge">
          <p><strong>C’est noté.</strong> Crée un compte (optionnel) pour retrouver tes events partout.</p>
          <div class="nudge-actions">
            <ion-button size="small" :router-link="`/login?redirect=/e/${slug}`">Créer mon compte</ion-button>
            <ion-button size="small" fill="clear" color="medium" @click="nudgeDismissed = true">Plus tard</ion-button>
          </div>
        </div>
      </RsvpBar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonFooter, IonButtons, IonBackButton, IonButton, IonIcon,
  IonTextarea, IonSpinner,
  IonRefresher, IonRefresherContent, alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import {
  megaphoneOutline, shareOutline, createOutline, trashOutline, notificationsOutline,
} from 'ionicons/icons'
import EventTicket from '@/components/EventTicket.vue'
import RsvpBar from '@/components/RsvpBar.vue'
import GuestList from '@/components/GuestList.vue'
import { currentUser, isRegistered, mergedVersion } from '@/lib/auth'
import {
  deleteAnnouncement, getAnnouncements, getEvent, getGuests, postAnnouncement,
  type Announcement, type EventDetails, type Guest, type RsvpStatus,
} from '@/lib/events'
import { formatRelative } from '@/lib/format'
import { themeStyle } from '@/lib/themes'
import { announcementText, eventUrl, invitationText, reminderText } from '@/lib/share'
import { openShareSheet } from '@/lib/shareSheet'
import { downloadIcs } from '@/lib/ics'

const props = defineProps<{ slug: string }>()
const route = useRoute()

const event = ref<EventDetails | null>(null)
const guests = ref<Guest[]>([])
const announcements = ref<Announcement[]>([])
const loading = ref(true)
const newAnnouncement = ref('')
const posting = ref(false)
const justAnswered = ref(false)
const nudgeDismissed = ref(false)

const justCreated = computed(() => route.query.created === '1')
const url = computed(() => eventUrl(props.slug))
const showAccountNudge = computed(() => justAnswered.value && !isRegistered.value && !nudgeDismissed.value)

// Plusieurs déclencheurs (entrée sur la page, réponse, changement de session, fusion) :
// seule la réponse de la dernière requête est appliquée.
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  loading.value = true
  try {
    const e = await getEvent(props.slug)
    const [g, a] = e
      ? await Promise.all([
          e.show_guest_list || e.is_organizer ? getGuests(props.slug) : Promise.resolve([]),
          getAnnouncements(props.slug),
        ])
      : [[], []]
    if (seq !== loadSeq) return
    event.value = e
    guests.value = g
    announcements.value = a
  } catch (err) {
    if (seq === loadSeq) await toast((err as Error).message, 'danger')
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

async function refresh(ev: CustomEvent) {
  await load()
  ;(ev.target as HTMLIonRefresherElement).complete()
}

async function toast(message: string, color = 'dark') {
  const t = await toastController.create({ message, duration: 2500, color, position: 'top' })
  await t.present()
}

async function onAnswered(status: RsvpStatus) {
  justAnswered.value = true
  await load()
  await toast(status === 'declined' ? 'Réponse envoyée. Merci.' : 'Réponse enregistrée.')
}

function shareInvitation() {
  if (!event.value) return
  void openShareSheet({
    header: 'Inviter des amis',
    title: event.value.title,
    text: invitationText(event.value.title, url.value),
    url: url.value,
  })
}

function shareAnnouncement(body: string) {
  if (!event.value) return
  void openShareSheet({
    header: 'Prévenir les invités',
    title: event.value.title,
    text: announcementText(event.value.title, body, url.value),
    url: url.value,
  })
}

function shareReminder() {
  if (!event.value) return
  void openShareSheet({
    header: 'Relancer les invités',
    title: event.value.title,
    text: reminderText(event.value.title, url.value),
    url: url.value,
  })
}

async function publishAnnouncement() {
  if (!event.value || !newAnnouncement.value.trim()) return
  posting.value = true
  const body = newAnnouncement.value.trim()
  try {
    await postAnnouncement(event.value.id, body)
    newAnnouncement.value = ''
    announcements.value = await getAnnouncements(props.slug)
    shareAnnouncement(body)
  } catch (err) {
    await toast((err as Error).message, 'danger')
  } finally {
    posting.value = false
  }
}

async function removeAnnouncement(id: string) {
  const alert = await alertController.create({
    header: 'Supprimer cette info ?',
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      {
        text: 'Supprimer',
        role: 'destructive',
        handler: async () => {
          try {
            await deleteAnnouncement(id)
            announcements.value = announcements.value.filter((a) => a.id !== id)
          } catch (err) {
            await toast(`L’info n’a pas pu être supprimée : ${(err as Error).message}`, 'danger')
          }
        },
      },
    ],
  })
  await alert.present()
}

async function addToCalendar() {
  if (!event.value) return
  try {
    await downloadIcs({ ...event.value, url: url.value })
  } catch (err) {
    // Partage annulé par l'utilisateur en natif : rien à signaler
    if (!/cancel/i.test((err as Error).message)) await toast((err as Error).message, 'danger')
  }
}

onIonViewWillEnter(load)
// Recharge quand la session change (connexion, fusion de compte…)
watch([() => currentUser.value?.id, mergedVersion], () => void load())
</script>

<style scoped>
.center {
  text-align: center;
  margin-top: 48px;
}
.ticket-wrap {
  padding: 4px 16px 0;
}
.created {
  margin: 4px 16px 16px;
  padding: 16px;
  border-radius: 14px;
  background: var(--tfek-surface);
}
.created-title {
  font-size: 1.35rem;
  margin: 0 0 6px;
}
.created p {
  margin: 0 0 12px;
  line-height: 1.45;
}
.announce {
  margin: 16px 16px 0;
  border: 1px solid color-mix(in srgb, var(--t-accent) 45%, transparent);
  border-radius: 14px;
  padding: 14px 16px;
}
.announce-head {
  color: var(--t-accent);
}
.announce p {
  margin: 6px 0 0;
  white-space: pre-wrap;
  line-height: 1.45;
  font-size: 16px;
}
.nudge {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--tfek-line);
}
.nudge p {
  margin: 0 0 6px;
  line-height: 1.45;
  font-size: 14px;
}
.nudge-actions {
  display: flex;
  gap: 4px;
}
.description {
  white-space: pre-wrap;
  line-height: 1.55;
  margin: 0 16px;
  font-size: 16px;
}
.compose {
  margin: 0 16px;
  padding: 4px 14px 14px;
  border-radius: 14px;
  background: var(--tfek-surface);
}
.all-infos {
  list-style: none;
  margin: 0 16px;
  padding: 0;
}
.all-infos li {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tfek-line);
}
.info-text {
  flex: 1;
  min-width: 0;
}
.announce-body {
  white-space: pre-wrap;
  margin-top: 4px;
  line-height: 1.45;
}
.counts {
  margin: -4px 16px 14px;
  font-size: 15px;
}
.pad {
  margin: 0 16px 12px;
}
.small {
  font-size: 0.85rem;
}
.footer {
  text-align: center;
  font-size: 0.85rem;
  padding: 32px 16px 48px;
}
.footer a {
  color: var(--tfek-muted);
}
</style>
