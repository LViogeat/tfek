<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" text="" />
        </ion-buttons>
        <ion-title>{{ event?.title ?? '' }}</ion-title>
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
        <h2>Event introuvable</h2>
        <p class="muted">Le lien est peut-être incorrect, ou l’event a été supprimé.</p>
        <ion-button router-link="/" fill="outline">Retour à l’accueil</ion-button>
      </div>

      <div v-else class="page-narrow">
        <!-- Juste après la création : on pousse l'organisateur à partager -->
        <ion-card v-if="justCreated && event.is_organizer" class="created-card">
          <ion-card-content>
            <p class="created-title">🎉 Ton event est en ligne !</p>
            <p>Partage le lien dans ta conversation WhatsApp ou Messenger pour que tes invités répondent.</p>
            <ion-button expand="block" @click="shareInvitation">
              <ion-icon slot="start" :icon="logoWhatsapp" />
              Inviter mes amis
            </ion-button>
          </ion-card-content>
        </ion-card>

        <div class="ion-padding-horizontal header-block">
          <ion-badge v-if="event.cancelled_at" color="danger">Annulé</ion-badge>
          <h1 :class="{ cancelled: event.cancelled_at }">{{ event.title }}</h1>
          <p class="muted">Organisé par {{ event.organizer_name }}</p>
        </div>

        <ion-list inset class="info-list">
          <ion-item lines="full" button :detail="false" @click="addToCalendar">
            <ion-icon slot="start" :icon="calendarOutline" color="primary" />
            <ion-label class="ion-text-wrap">
              {{ formatEventDate(event.starts_at, event.ends_at) }}
              <p>Ajouter à mon agenda</p>
            </ion-label>
          </ion-item>
          <ion-item v-if="event.location" :href="mapsUrl(event.location)" target="_blank" :detail="false" lines="none">
            <ion-icon slot="start" :icon="locationOutline" color="primary" />
            <ion-label class="ion-text-wrap">
              {{ event.location }}
              <p>Voir sur la carte</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <!-- Dernière annonce mise en avant -->
        <div v-if="announcements.length" class="announce-highlight ion-margin-horizontal">
          <div class="announce-head">
            <ion-icon :icon="megaphoneOutline" />
            <strong>Dernière info de l’organisateur</strong>
            <span class="muted">· {{ formatRelative(announcements[0]!.created_at) }}</span>
          </div>
          <p>{{ announcements[0]!.body }}</p>
        </div>

        <RsvpCard
          v-if="!event.cancelled_at && !event.is_organizer"
          :slug="slug"
          :my-rsvp="event.my_rsvp"
          :allow-plus-ones="event.allow_plus_ones"
          @answered="onAnswered"
        />

        <ion-card v-if="showAccountNudge" class="nudge-card">
          <ion-card-content>
            <p><strong>C’est noté !</strong> Ta réponse est enregistrée sur cet appareil.</p>
            <p class="muted">Crée un compte (optionnel) pour retrouver tes events partout et être prévenu des nouvelles infos.</p>
            <div class="nudge-actions">
              <ion-button size="small" :router-link="`/login?redirect=/e/${slug}`">Créer mon compte</ion-button>
              <ion-button size="small" fill="clear" color="medium" @click="nudgeDismissed = true">Plus tard</ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <template v-if="event.description">
          <h2 class="section-title">Description</h2>
          <p class="description ion-padding-horizontal">{{ event.description }}</p>
        </template>

        <!-- Organisateur : outils -->
        <template v-if="event.is_organizer">
          <h2 class="section-title">Publier une info</h2>
          <ion-card class="compose-card">
            <ion-card-content>
              <ion-textarea
                v-model="newAnnouncement"
                placeholder="Changement d’heure, code de la porte, quoi ramener…"
                :auto-grow="true"
                :rows="2"
                :maxlength="2000"
              />
              <ion-button
                expand="block"
                size="small"
                :disabled="!newAnnouncement.trim() || posting"
                @click="publishAnnouncement"
              >
                <ion-icon slot="start" :icon="megaphoneOutline" />
                Publier et partager
              </ion-button>
            </ion-card-content>
          </ion-card>
        </template>

        <template v-if="announcements.length > 1 || (event.is_organizer && announcements.length)">
          <h2 class="section-title">Toutes les infos</h2>
          <ion-list inset>
            <ion-item v-for="a in announcements" :key="a.id">
              <ion-label class="ion-text-wrap">
                <p class="muted small">{{ formatRelative(a.created_at) }}</p>
                <div class="announce-body">{{ a.body }}</div>
              </ion-label>
              <template v-if="event.is_organizer">
                <ion-button slot="end" fill="clear" aria-label="Partager l’info" @click="shareAnnouncement(a.body)">
                  <ion-icon slot="icon-only" :icon="shareOutline" />
                </ion-button>
                <ion-button slot="end" fill="clear" color="medium" aria-label="Supprimer" @click="removeAnnouncement(a.id)">
                  <ion-icon slot="icon-only" :icon="trashOutline" />
                </ion-button>
              </template>
            </ion-item>
          </ion-list>
        </template>

        <h2 class="section-title">
          Réponses · {{ event.counts.going }} {{ event.counts.going > 1 ? 'viennent' : 'vient' }}
          <template v-if="event.counts.maybe"> · {{ event.counts.maybe }} peut-être</template>
        </h2>
        <template v-if="event.show_guest_list || event.is_organizer">
          <p v-if="event.is_organizer && !event.show_guest_list" class="muted small ion-padding-horizontal">
            Liste visible par toi uniquement.
          </p>
          <GuestList :guests="guests" />
        </template>
        <p v-else class="muted ion-padding-horizontal">L’organisateur a choisi de garder la liste des invités privée.</p>

        <div v-if="event.is_organizer && !event.cancelled_at" class="ion-padding">
          <ion-button expand="block" fill="outline" @click="shareReminder">
            <ion-icon slot="start" :icon="notificationsOutline" />
            Relancer ceux qui n’ont pas répondu
          </ion-button>
        </div>

        <div class="footer muted">
          <router-link to="/new">Organise ton propre event avec tfek</router-link>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonCard, IonCardContent, IonTextarea, IonBadge, IonSpinner,
  IonRefresher, IonRefresherContent, alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import {
  calendarOutline, locationOutline, megaphoneOutline, shareOutline, createOutline, trashOutline,
  notificationsOutline, logoWhatsapp,
} from 'ionicons/icons'
import RsvpCard from '@/components/RsvpCard.vue'
import GuestList from '@/components/GuestList.vue'
import { currentUser, isRegistered, mergedVersion } from '@/lib/auth'
import {
  deleteAnnouncement, getAnnouncements, getEvent, getGuests, postAnnouncement,
  type Announcement, type EventDetails, type Guest, type RsvpStatus,
} from '@/lib/events'
import { formatEventDate, formatRelative, mapsUrl } from '@/lib/format'
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

async function load() {
  loading.value = true
  try {
    const e = await getEvent(props.slug)
    event.value = e
    if (!e) return
    const [g, a] = await Promise.all([
      e.show_guest_list || e.is_organizer ? getGuests(props.slug) : Promise.resolve([]),
      getAnnouncements(props.slug),
    ])
    guests.value = g
    announcements.value = a
  } catch (err) {
    await toast((err as Error).message, 'danger')
  } finally {
    loading.value = false
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
  await toast(status === 'declined' ? 'Réponse envoyée, merci !' : 'Super, c’est noté ! 🎉', 'success')
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
          await deleteAnnouncement(id)
          announcements.value = announcements.value.filter((a) => a.id !== id)
        },
      },
    ],
  })
  await alert.present()
}

function addToCalendar() {
  if (!event.value) return
  downloadIcs({ ...event.value, url: url.value })
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
.header-block h1 {
  font-size: 1.7rem;
  font-weight: 700;
  margin: 16px 0 4px;
}
.header-block p {
  margin: 0;
}
.cancelled {
  text-decoration: line-through;
}
.info-list {
  margin-top: 16px;
}
.announce-highlight {
  background: var(--tfek-announce-bg);
  border-left: 4px solid var(--tfek-announce-border);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.announce-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}
.announce-highlight p {
  margin: 6px 0 0;
  white-space: pre-wrap;
  line-height: 1.45;
}
.announce-body {
  white-space: pre-wrap;
  color: var(--ion-text-color);
}
.description {
  white-space: pre-wrap;
  line-height: 1.5;
  margin-top: 0;
}
.created-card {
  background: var(--tfek-surface);
  box-shadow: none;
}
.created-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ion-text-color);
}
.created-card p {
  margin-bottom: 12px;
}
.nudge-card {
  box-shadow: none;
  background: var(--tfek-surface);
}
.nudge-card p {
  margin-bottom: 6px;
}
.nudge-actions {
  display: flex;
  gap: 4px;
}
.compose-card {
  box-shadow: none;
  border: 1px solid var(--ion-color-step-150, #ddd);
}
.small {
  font-size: 0.8rem;
}
.footer {
  text-align: center;
  font-size: 0.85rem;
  padding: 24px 16px 48px;
}
</style>
