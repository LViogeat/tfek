<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title class="brand">tfek</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="isRegistered" router-link="/amis" aria-label="Amis" class="friends-btn">
            <ion-icon slot="icon-only" :icon="peopleOutline" />
            <span v-if="requests" class="dot mono">{{ requests }}</span>
          </ion-button>
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
          <div class="lbl hero-tag">Invitations sans compte</div>
          <h1 class="disp">Tes évènements, sans le chaos des conversations de groupe</h1>
          <ion-button expand="block" router-link="/new">
            <ion-icon slot="start" :icon="addOutline" />
            Créer un évènement
          </ion-button>
        </div>

        <template v-if="isRegistered">
          <h1 class="disp home-title">Tes évènements</h1>
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
              <p class="muted">Aucun évènement organisé</p>
              <ion-button fill="outline" router-link="/new">Créer mon premier évènement</ion-button>
            </div>
          </ion-list>

          <ion-list v-else inset>
            <EventListItem v-for="i in invitations" :key="i.event.id" :event="i.event" :status="i.status" />
            <p v-if="!loading && invitations.length === 0" class="empty muted ion-padding">
              Aucune invitation
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
            <router-link to="/login">Créer un compte</router-link>
          </p>
        </template>
      </div>

      <ion-fab v-if="isRegistered" slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button router-link="/new" aria-label="Créer un évènement">
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
import { addOutline, personCircleOutline, informationCircleOutline, peopleOutline } from 'ionicons/icons'
import EventListItem from '@/components/EventListItem.vue'
import { currentUser, isRegistered, mergedVersion } from '@/lib/auth'
import { listInvitations, listOrganized, type EventRow, type Invitation } from '@/lib/events'
import { listFriends } from '@/lib/friends'

const tab = ref<'organized' | 'invited'>('organized')
const organized = ref<EventRow[]>([])
const invitations = ref<Invitation[]>([])
const loading = ref(false)
// Demandes d'ami reçues, signalées sur le bouton Amis
const requests = ref(0)

// Plusieurs déclencheurs (entrée sur la page, changement de session, fusion) :
// seule la réponse de la dernière requête est appliquée.
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  const user = currentUser.value
  if (!user) {
    organized.value = []
    invitations.value = []
    requests.value = 0
    return
  }
  loading.value = true
  try {
    const registered = isRegistered.value
    const [o, i, f] = await Promise.all([
      registered ? listOrganized(user.id) : Promise.resolve([]),
      listInvitations(user.id),
      registered ? listFriends() : Promise.resolve([]),
    ])
    if (seq !== loadSeq) return
    organized.value = o
    invitations.value = i
    requests.value = f.filter((x) => x.state === 'received').length
    if (registered && o.length === 0 && i.length > 0) tab.value = 'invited'
  } catch (e) {
    if (seq !== loadSeq) return
    const t = await toastController.create({
      message: `Impossible de charger tes évènements : ${(e as Error).message}`,
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
.brand {
  font-size: 1.35rem;
  letter-spacing: -0.03em;
}
.hero-tag {
  display: inline-block;
  margin-top: 24px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--t-accent);
  color: var(--t-accent);
}
.hero h1 {
  font-size: 2.3rem;
  line-height: 1.02;
  margin: 16px 0 28px;
}
.home-title {
  font-size: 2rem;
  margin: 20px 16px 0;
}
.empty {
  text-align: center;
}
.friends-btn {
  position: relative;
}
.dot {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--t-accent);
  color: var(--t-on-accent);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
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
