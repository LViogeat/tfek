<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" text="" />
        </ion-buttons>
        <ion-title>Mon compte</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page-narrow">
        <ion-list inset>
          <ion-item>
            <ion-input
              v-model="name"
              label="Prénom affiché"
              label-placement="stacked"
              placeholder="Ton prénom"
              :maxlength="60"
              @ionBlur="saveName"
            />
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <p>E-mail</p>
              <h3>{{ currentUser?.email }}</h3>
            </ion-label>
          </ion-item>
        </ion-list>

        <div class="ion-padding">
          <ion-button expand="block" fill="outline" color="medium" @click="logout">Se déconnecter</ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton,
  IonList, IonItem, IonInput, IonLabel, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { currentUser, isRegistered, signOut } from '@/lib/auth'
import { getMyDisplayName, setMyDisplayName } from '@/lib/events'

const router = useRouter()
const name = ref('')
let savedName = ''

onIonViewWillEnter(async () => {
  if (!isRegistered.value || !currentUser.value) {
    await router.replace('/login?redirect=/account')
    return
  }
  savedName = (await getMyDisplayName(currentUser.value.id)) ?? ''
  name.value = savedName
})

async function saveName() {
  const n = name.value.trim()
  if (!currentUser.value || !n || n === savedName) return
  let message = 'Prénom enregistré'
  try {
    await setMyDisplayName(currentUser.value.id, n)
    savedName = n
  } catch {
    message = 'Le prénom n’a pas pu être enregistré'
  }
  const t = await toastController.create({ message, duration: 2000, position: 'top' })
  await t.present()
}

async function logout() {
  await signOut()
  await router.replace('/')
}
</script>
