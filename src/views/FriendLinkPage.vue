<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" text="" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="page-narrow">
        <div v-if="loading && !link" class="center">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="!link" class="center">
          <h1 class="disp">Lien introuvable</h1>
          <ion-button router-link="/" fill="outline">Retour à l’accueil</ion-button>
        </div>

        <div v-else class="card">
          <TfekStamp class="stamp" />
          <div class="lbl muted">Ami sur tfek</div>
          <h1 class="disp name">{{ link.display_name }}</h1>

          <template v-if="link.is_me">
            <p class="muted">Ton lien d’ami</p>
            <ion-button expand="block" router-link="/amis">Voir mes amis</ion-button>
          </template>

          <template v-else-if="link.state === 'friends'">
            <p class="muted">Vous êtes amis</p>
            <ion-button expand="block" fill="outline" router-link="/amis">Voir mes amis</ion-button>
          </template>

          <ion-button v-else expand="block" :disabled="adding" @click="add">
            <ion-spinner v-if="adding" slot="start" name="crescent" />
            <ion-icon v-else slot="start" :icon="personAddOutline" />
            Ajouter en ami
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner,
  toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { personAddOutline } from 'ionicons/icons'
import TfekStamp from '@/components/TfekStamp.vue'
import { currentUser, isRegistered } from '@/lib/auth'
import { addFriendByCode, getFriendLink, type FriendLink } from '@/lib/friends'

const props = defineProps<{ code: string }>()
const route = useRoute()
const router = useRouter()

const link = ref<FriendLink | null>(null)
const loading = ref(true)
const adding = ref(false)

let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  loading.value = true
  try {
    const l = await getFriendLink(props.code)
    if (seq !== loadSeq) return
    link.value = l
    // Retour de connexion après « Ajouter en ami » : on termine l'ajout
    if (l && route.query.add === '1' && isRegistered.value && !l.is_me && l.state !== 'friends') {
      await router.replace(`/ami/${props.code}`)
      await add()
    }
  } catch (e) {
    if (seq === loadSeq) await toast((e as Error).message, 'danger')
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

async function toast(message: string, color = 'dark') {
  const t = await toastController.create({ message, duration: 2500, color, position: 'top' })
  await t.present()
}

async function add() {
  if (!link.value || adding.value) return
  if (!isRegistered.value) {
    await router.push(`/login?redirect=${encodeURIComponent(`/ami/${props.code}?add=1`)}`)
    return
  }
  adding.value = true
  try {
    const name = await addFriendByCode(props.code)
    link.value = { ...link.value, state: 'friends' }
    await toast(`${name} et toi êtes amis`)
  } catch (e) {
    await toast((e as Error).message, 'danger')
  } finally {
    adding.value = false
  }
}

onIonViewWillEnter(load)
watch(() => currentUser.value?.id, () => void load())
</script>

<style scoped>
.center {
  text-align: center;
  margin-top: 48px;
}
.card {
  margin-top: 24px;
  padding: 28px 20px 20px;
  border-radius: 16px;
  background: var(--tfek-surface);
  border: 1px solid var(--tfek-line);
  text-align: center;
}
.stamp {
  width: 96px;
  height: 96px;
  color: var(--t-accent);
  margin-bottom: 16px;
}
.name {
  font-size: 2rem;
  margin: 6px 0 20px;
  overflow-wrap: anywhere;
}
.card p {
  margin: -8px 0 20px;
}
</style>
