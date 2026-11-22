<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" text="" />
        </ion-buttons>
        <ion-title>Amis</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page-narrow">
        <div class="ion-padding">
          <!-- Sans prénom, les amis verraient « Sans prénom » et ne pourraient pas t'inviter -->
          <form v-if="!loading && !myName" class="name-form" @submit.prevent="saveName">
            <ion-input
              v-model="nameInput"
              class="name-input"
              placeholder="Ton prénom"
              :maxlength="60"
              autocomplete="given-name"
            />
            <ion-button type="submit" :disabled="!nameInput.trim()">Enregistrer</ion-button>
          </form>
          <ion-button expand="block" :disabled="!code || !myName" @click="shareLink">
            <ion-icon slot="start" :icon="shareOutline" />
            Partager mon lien d’ami
          </ion-button>
        </div>

        <template v-if="received.length">
          <h2 class="section-title">Demandes reçues</h2>
          <ul class="people">
            <li v-for="f in received" :key="f.user_id">
              <span class="avatar mono">{{ initials(f.display_name) }}</span>
              <span class="name">{{ f.display_name }}</span>
              <ion-button size="small" :disabled="busy === f.user_id" @click="accept(f)">Accepter</ion-button>
              <ion-button size="small" fill="clear" color="medium" :disabled="busy === f.user_id" @click="decline(f)">
                Refuser
              </ion-button>
            </li>
          </ul>
        </template>

        <h2 class="section-title">Tes amis<span v-if="friends.length"> · {{ friends.length }}</span></h2>
        <ul v-if="friends.length" class="people">
          <li v-for="f in friends" :key="f.user_id">
            <span class="avatar mono friend">{{ initials(f.display_name) }}</span>
            <span class="name">{{ f.display_name }}</span>
            <ion-button fill="clear" color="medium" size="small" :aria-label="`Retirer ${f.display_name}`" @click="confirmRemove(f)">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </li>
        </ul>
        <p v-else-if="!loading" class="muted pad">Pas encore d’amis</p>

        <template v-if="suggestions.length">
          <h2 class="section-title">Croisés à tes évènements</h2>
          <ul class="people">
            <li v-for="s in suggestions" :key="s.user_id">
              <span class="avatar mono">{{ initials(s.display_name) }}</span>
              <span class="name">
                {{ s.display_name }}
                <span class="muted small">{{ s.shared_events }} évènement{{ s.shared_events > 1 ? 's' : '' }} en commun</span>
              </span>
              <ion-button size="small" fill="outline" :disabled="busy === s.user_id" @click="request(s)">
                Ajouter
              </ion-button>
            </li>
          </ul>
        </template>

        <template v-if="sent.length">
          <h2 class="section-title">Demandes envoyées</h2>
          <ul class="people">
            <li v-for="f in sent" :key="f.user_id">
              <span class="avatar mono pending">{{ initials(f.display_name) }}</span>
              <span class="name">{{ f.display_name }}</span>
              <ion-button size="small" fill="clear" color="medium" :disabled="busy === f.user_id" @click="cancel(f)">
                Annuler
              </ion-button>
            </li>
          </ul>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton, IonIcon,
  IonRefresher, IonRefresherContent, IonInput, alertController, toastController, onIonViewWillEnter,
} from '@ionic/vue'
import { closeOutline, shareOutline } from 'ionicons/icons'
import { currentUser, isRegistered } from '@/lib/auth'
import {
  acceptFriend, friendLinkText, friendLinkUrl, getMyFriendCode, listFriends, listSuggestions, removeFriend,
  requestFriend, type Friend, type Suggestion,
} from '@/lib/friends'
import { openShareSheet } from '@/lib/shareSheet'
import { getMyDisplayName, setMyDisplayName } from '@/lib/events'

const router = useRouter()
const all = ref<Friend[]>([])
const suggestions = ref<Suggestion[]>([])
const code = ref<string | null>(null)
const myName = ref('')
const nameInput = ref('')
const loading = ref(true)
// Personne en cours de traitement (évite le double appui)
const busy = ref<string | null>(null)

const friends = computed(() => all.value.filter((f) => f.state === 'friends'))
const received = computed(() => all.value.filter((f) => f.state === 'received'))
const sent = computed(() => all.value.filter((f) => f.state === 'sent'))

let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  const user = currentUser.value
  if (!isRegistered.value || !user) {
    await router.replace('/login?redirect=/amis')
    return
  }
  loading.value = true
  try {
    const [f, s, c, n] = await Promise.all([
      listFriends(),
      listSuggestions(),
      getMyFriendCode(user.id),
      getMyDisplayName(user.id),
    ])
    if (seq !== loadSeq) return
    all.value = f
    suggestions.value = s
    code.value = c
    myName.value = n?.trim() ?? ''
  } catch (e) {
    if (seq === loadSeq) await toast((e as Error).message, 'danger')
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

/** Exécute une action sur une personne, puis recharge les listes. */
async function act(userId: string, action: () => Promise<unknown>, done?: string) {
  if (busy.value) return
  busy.value = userId
  try {
    await action()
    await load()
    if (done) await toast(done)
  } catch (e) {
    await toast((e as Error).message, 'danger')
  } finally {
    busy.value = null
  }
}

const accept = (f: Friend) => act(f.user_id, () => acceptFriend(f.user_id), `${f.display_name} et toi êtes amis`)
const decline = (f: Friend) => act(f.user_id, () => removeFriend(f.user_id))
const cancel = (f: Friend) => act(f.user_id, () => removeFriend(f.user_id))

const request = (s: Suggestion) =>
  act(s.user_id, async () => {
    const state = await requestFriend(s.user_id)
    await toast(state === 'friends' ? `${s.display_name} et toi êtes amis` : 'Demande envoyée')
  })

async function confirmRemove(f: Friend) {
  const alert = await alertController.create({
    header: `Retirer ${f.display_name} de tes amis ?`,
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      {
        text: 'Retirer',
        role: 'destructive',
        handler: async () => {
          try {
            await act(f.user_id, () => removeFriend(f.user_id))
          } catch (e) {
            await toast((e as Error).message, 'danger')
          }
        },
      },
    ],
  })
  await alert.present()
}

async function saveName() {
  const n = nameInput.value.trim()
  if (!n || !currentUser.value) return
  try {
    await setMyDisplayName(currentUser.value.id, n)
    myName.value = n
  } catch (e) {
    await toast((e as Error).message, 'danger')
  }
}

function shareLink() {
  if (!code.value) return
  const url = friendLinkUrl(code.value)
  void openShareSheet({ header: 'Ajouter des amis', title: 'tfek', text: friendLinkText(url), url })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

onIonViewWillEnter(load)
watch(() => currentUser.value?.id, () => void load())
</script>

<style scoped>
.name-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 4px 0 14px;
  border-radius: 12px;
  background: var(--tfek-surface);
}
.name-input {
  flex: 1;
}
.people {
  list-style: none;
  margin: 0 16px;
  padding: 0;
}
.people li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tfek-line);
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--tfek-surface);
  color: var(--tfek-text);
  border: 1px solid var(--tfek-line);
}
.avatar.friend {
  background: var(--t-accent);
  border-color: var(--t-accent);
  color: var(--t-on-accent);
}
.avatar.pending {
  background: transparent;
  border-style: dashed;
  color: var(--tfek-muted);
}
.name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 16px;
}
.small {
  font-size: 0.8rem;
}
.pad {
  margin: 0 16px 12px;
}
</style>
