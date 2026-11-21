<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="redirect" text="" />
        </ion-buttons>
        <ion-title>Connexion</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="page-narrow">
        <h1 class="disp">{{ headline }}</h1>
        <p class="muted">{{ subline }}</p>

        <template v-if="step === 'email'">
          <form @submit.prevent="sendCode">
            <ion-list inset class="no-margin-x">
              <ion-item>
                <ion-input
                  v-model="email"
                  type="email"
                  label="E-mail"
                  label-placement="stacked"
                  placeholder="toi@exemple.fr"
                  autocomplete="email"
                  inputmode="email"
                  required
                />
              </ion-item>
            </ion-list>
            <ion-button type="submit" expand="block" :disabled="!validEmail || busy">
              <ion-spinner v-if="busy" slot="start" name="crescent" />
              Recevoir un code
            </ion-button>
          </form>
          <p class="muted small center">Pas de mot de passe : on t’envoie un code à 6 chiffres.</p>

          <template v-if="googleEnabled">
            <div class="divider"><span>ou</span></div>
            <ion-button expand="block" fill="outline" :disabled="busy" @click="google">
              <ion-icon slot="start" :icon="logoGoogle" />
              Continuer avec Google
            </ion-button>
          </template>
        </template>

        <template v-else>
          <form @submit.prevent="verify">
            <ion-list inset class="no-margin-x">
              <ion-item>
                <ion-input
                  v-model="code"
                  label="Code reçu par e-mail"
                  label-placement="stacked"
                  placeholder="123456"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  :maxlength="6"
                  required
                />
              </ion-item>
            </ion-list>
            <ion-button type="submit" expand="block" :disabled="code.length < 6 || busy">
              <ion-spinner v-if="busy" slot="start" name="crescent" />
              Valider
            </ion-button>
          </form>
          <p class="muted small center">
            Envoyé à {{ email }}. Tu peux aussi cliquer sur le lien dans l’e-mail.<br />
            <a href="#" @click.prevent="step = 'email'">Changer d’adresse</a>
          </p>
        </template>

        <div v-if="isDev" class="dev-box">
          <p class="small"><strong>Mode dev</strong> — connexion rapide (mot de passe : password)</p>
          <ion-button size="small" fill="outline" @click="devLogin('orga@test.fr')">orga@test.fr</ion-button>
          <ion-button size="small" fill="outline" @click="devLogin('invite@test.fr')">invite@test.fr</ion-button>
          <p class="small muted">E-mails reçus : <a href="http://127.0.0.1:54324" target="_blank">Mailpit</a></p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton,
  IonList, IonItem, IonInput, IonIcon, IonSpinner, toastController,
} from '@ionic/vue'
import { logoGoogle } from 'ionicons/icons'
import { isRegistered, sendEmailCode, signInWithGoogle, signInWithPassword, verifyEmailCode } from '@/lib/auth'

const route = useRoute()
const router = useRouter()

const redirect = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/'
})
const reason = computed(() => route.query.reason)
const headline = computed(() => (reason.value === 'publish' ? 'Dernière étape avant de publier' : 'Connecte-toi à tfek'))
const subline = computed(() =>
  reason.value === 'publish'
    ? 'Ton e-mail te permet de gérer ton event, publier des infos et voir qui vient.'
    : 'Retrouve les events que tu organises et ceux auxquels tu es invité, sur tous tes appareils.',
)

const isDev = import.meta.env.DEV
const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE === 'true'

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const busy = ref(false)
const validEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

async function toast(message: string, color = 'danger') {
  const t = await toastController.create({ message, duration: 3000, color, position: 'top' })
  await t.present()
}

async function run(fn: () => Promise<void>) {
  busy.value = true
  try {
    await fn()
  } catch (e) {
    await toast((e as Error).message)
  } finally {
    busy.value = false
  }
}

const sendCode = () =>
  run(async () => {
    await sendEmailCode(email.value.trim(), redirect.value)
    step.value = 'code'
  })

const verify = () => run(() => verifyEmailCode(email.value.trim(), code.value.trim()))
const google = () => run(() => signInWithGoogle(redirect.value))
const devLogin = (e: string) => run(() => signInWithPassword(e, 'password'))

// Dès que l'utilisateur est connecté (code, lien magique, Google), on repart là où il était
watch(
  isRegistered,
  (ok) => {
    if (ok) void router.replace(redirect.value)
  },
  { immediate: true },
)
</script>

<style scoped>
h1 {
  font-size: 2rem;
  line-height: 1.05;
  margin-top: 16px;
}
.no-margin-x {
  margin-left: 0;
  margin-right: 0;
}
.small {
  font-size: 0.85rem;
}
.center {
  text-align: center;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  color: var(--tfek-muted);
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--ion-color-step-200, #ccc);
}
.dev-box {
  margin-top: 40px;
  padding: 12px;
  border: 1px dashed var(--ion-color-warning);
  border-radius: 8px;
}
.dev-box p {
  margin: 0 0 8px;
}
</style>
