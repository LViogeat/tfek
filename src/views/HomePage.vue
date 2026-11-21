<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>tfek</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="isRegistered" router-link="/account" aria-label="Mon compte">
            <ion-icon slot="icon-only" :icon="personCircleOutline" />
          </ion-button>
          <ion-button v-else router-link="/login">Se connecter</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-narrow">
        <div v-if="!isRegistered" class="hero ion-padding">
          <h1>Tes events, sans le chaos du groupe WhatsApp</h1>
          <p class="muted">
            Crée un event en 30 secondes, partage le lien dans ta conversation et vois enfin qui vient.
            Tes invités répondent sans créer de compte.
          </p>
          <ion-button expand="block" router-link="/new">
            <ion-icon slot="start" :icon="addOutline" />
            Créer un event
          </ion-button>
        </div>

        <template v-if="isRegistered">
          <div class="segment-wrap">
            <ion-segment v-model="tab">
              <ion-segment-button value="organized">
                <ion-label>Organisés ({{ organized.length }})</ion-label>
              </ion-segment-button>
              <ion-segment-button value="invited">
                <ion-label>Invitations ({{ invitations.length }})</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>

          <ion-list v-if="tab === 'organized'" inset>
            <EventListItem v-for="e in organized" :key="e.id" :event="e" />
            <div v-if="!loading && organized.length === 0" class="empty ion-padding">
              <p class="muted">Tu n’as encore organisé aucun event.</p>
              <ion-button fill="outline" router-link="/new">Créer mon premier event</ion-button>
            </div>
          </ion-list>

          <ion-list v-else inset>
            <EventListItem v-for="i in invitations" :key="i.event.id" :event="i.event" :status="i.status" />
            <p v-if="!loading && invitations.length === 0" class="empty muted ion-padding">
              Les events auxquels tu réponds apparaîtront ici.
            </p>
          </ion-list>
        </template>

        <template v-else-if="invitations.length">
          <h2 class="section-title">Tes réponses sur cet appareil</h2>
          <ion-list inset>
            <EventListItem v-for="i in invitations" :key="i.event.id" :event="i.event" :status="i.status" />
          </ion-list>
          <p class="muted ion-padding-horizontal nudge">
            <ion-icon :icon="informationCircleOutline" />
            <router-link to="/login">Crée ton compte</router-link> pour les retrouver sur tous tes appareils.
          </p>
        </template>
      </div>

      <ion-fab v-if="isRegistered" slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button router-link="/new" aria-label="Créer un event">
          <ion-icon :icon="addOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonList, IonFab, IonFabButton,
  IonRefresher, IonRefresherContent, onIonViewWillEnter, toastController,
} from '@ionic/vue'
import { addOutline, personCircleOutline, informationCircleOutline } from 'ionicons/icons'
import EventListItem from '@/components/EventListItem.vue'
import { currentUser, isRegistered, mergedVersion } from '@/lib/auth'
import { listInvitations, listOrganized, type EventRow, type Invitation } from '@/lib/events'

const tab = ref<'organized' | 'invited'>('organized')
const organized = ref<EventRow[]>([])
const invitations = ref<Invitation[]>([])
const loading = ref(false)

// Plusieurs déclencheurs (entrée sur la page, changement de session, fusion) :
// seule la réponse de la dernière requête est appliquée.
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  const user = currentUser.value
  if (!user) {
    organized.value = []
    invitations.value = []
    return
  }
  loading.value = true
  try {
    const registered = isRegistered.value
    const [o, i] = await Promise.all([
      registered ? listOrganized(user.id) : Promise.resolve([]),
      listInvitations(user.id),
    ])
    if (seq !== loadSeq) return
    organized.value = o
    invitations.value = i
    if (registered && o.length === 0 && i.length > 0) tab.value = 'invited'
  } catch (e) {
    if (seq !== loadSeq) return
    const t = await toastController.create({
      message: `Impossible de charger tes events : ${(e as Error).message}`,
      color: 'danger',
      duration: 3000,
      position: 'top',
    })
    await t.present()
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

async function refresh(ev: CustomEvent) {
  await load()
  ;(ev.target as HTMLIonRefresherElement).complete()
}

onIonViewWillEnter(load)
watch([() => currentUser.value?.id, mergedVersion], load)
</script>

<style scoped>
.hero h1 {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.25;
  margin-top: 24px;
}
.hero p {
  margin-bottom: 24px;
  line-height: 1.5;
}
.empty {
  text-align: center;
}
.segment-wrap {
  padding: 16px 16px 0;
}
.nudge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}
</style>
