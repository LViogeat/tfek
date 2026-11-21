import { computed, reactive, readonly, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { publicUrl } from './appUrl'

const MERGE_TOKEN_KEY = 'tfek.mergeToken'

const state = reactive({
  ready: false,
  session: null as Session | null,
})

export const auth = readonly(state)

/** Incrémenté quand des réponses d'invité ont été rattachées au compte : les pages rechargent. */
export const mergedVersion = ref(0)

export const currentUser = computed(() => state.session?.user ?? null)
/** Vrai compte (pas un invité anonyme) */
export const isRegistered = computed(() => !!currentUser.value && !currentUser.value.is_anonymous)

let readyPromise: Promise<void> | null = null

export function initAuth(): Promise<void> {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    const { data } = await supabase.auth.getSession()
    state.session = data.session
    state.ready = true
    supabase.auth.onAuthStateChange((event, session) => {
      state.session = session
      if (event === 'SIGNED_IN' && session && !session.user.is_anonymous) {
        // Ne pas appeler Supabase directement dans ce callback (verrou interne)
        setTimeout(() => void mergePendingGuest(), 0)
      }
    })
    if (state.session && !state.session.user.is_anonymous) {
      void mergePendingGuest()
    }
  })()
  return readyPromise
}

/** Garantit une session (anonyme si besoin) pour répondre à un event sans compte. */
export async function ensureGuestSession(): Promise<void> {
  await initAuth()
  if (state.session) return
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  state.session = data.session
}

/**
 * À appeler juste avant une connexion : si l'utilisateur est un invité anonyme,
 * on garde un jeton pour rattacher ses réponses au compte une fois connecté.
 */
export async function prepareGuestMerge(): Promise<void> {
  if (!currentUser.value?.is_anonymous) return
  const { data } = await supabase.rpc('create_merge_token')
  if (data) localStorage.setItem(MERGE_TOKEN_KEY, data)
}

let merging = false
async function mergePendingGuest(): Promise<void> {
  const token = localStorage.getItem(MERGE_TOKEN_KEY)
  if (!token || merging) return
  merging = true
  try {
    const { data, error } = await supabase.rpc('merge_anonymous_user', { p_token: token })
    if (!error) {
      // Succès, ou jeton expiré / déjà utilisé (0) : dans tous les cas il ne resservira pas
      localStorage.removeItem(MERGE_TOKEN_KEY)
      if (data) mergedVersion.value++
    } else if (error.code) {
      // Erreur renvoyée par la base (droits, jeton invalide…) : réessayer ne changera rien
      console.error('Fusion du compte invité impossible', error)
      localStorage.removeItem(MERGE_TOKEN_KEY)
    }
    // Sinon (pas de code = erreur réseau) : on garde le jeton pour le prochain démarrage.
    // Il expire côté serveur au bout d'un jour, la tentative suivante le nettoiera.
  } catch (e) {
    console.error('Fusion du compte invité : erreur réseau', e)
  } finally {
    merging = false
  }
}

function redirectUrl(path: string): string {
  return publicUrl(path)
}

export async function sendEmailCode(email: string, redirectPath: string) {
  await prepareGuestMerge()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl(redirectPath), shouldCreateUser: true },
  })
  if (error) throw error
}

export async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signInWithPassword(email: string, password: string) {
  await prepareGuestMerge()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signInWithGoogle(redirectPath: string) {
  await prepareGuestMerge()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl(redirectPath) },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
  localStorage.removeItem(MERGE_TOKEN_KEY)
}
