import { supabase } from './supabase'
import { publicUrl } from './appUrl'

/** Relation avec quelqu'un : amis, demande envoyée, demande reçue. */
export type FriendState = 'friends' | 'sent' | 'received'

export interface Friend {
  user_id: string
  display_name: string
  state: FriendState
}

export interface Suggestion {
  user_id: string
  display_name: string
  /** Nombre d'évènements en commun */
  shared_events: number
}

export interface FriendLink {
  display_name: string
  is_me: boolean
  state: FriendState | null
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export function friendLinkUrl(code: string): string {
  return publicUrl(`/ami/${code}`)
}

export function friendLinkText(url: string): string {
  return `Ajoute-moi en ami sur tfek, pour s’inviter plus facilement : ${url}`
}

export async function getMyFriendCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('friend_code').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.friend_code ?? null
}

export async function listFriends(): Promise<Friend[]> {
  return check(await supabase.rpc('list_friends')) as Friend[]
}

export async function listSuggestions(): Promise<Suggestion[]> {
  return check(await supabase.rpc('friend_suggestions'))
}

export async function getFriendLink(code: string): Promise<FriendLink | null> {
  return (check(await supabase.rpc('get_friend_link', { p_code: code })) as unknown as FriendLink | null) ?? null
}

/** Renvoie le prénom du nouvel ami. */
export async function addFriendByCode(code: string): Promise<string> {
  return check(await supabase.rpc('add_friend_by_code', { p_code: code }))
}

/** Renvoie la nouvelle relation (`friends` si l'autre avait déjà demandé). */
export async function requestFriend(userId: string): Promise<FriendState> {
  return check(await supabase.rpc('request_friend', { p_user: userId })) as FriendState
}

export async function acceptFriend(userId: string) {
  check(await supabase.rpc('accept_friend', { p_user: userId }))
}

/** Retire un ami, refuse ou annule une demande. */
export async function removeFriend(userId: string) {
  check(await supabase.rpc('remove_friend', { p_user: userId }))
}

export async function getInvitableFriends(slug: string): Promise<{ user_id: string; display_name: string }[]> {
  return check(await supabase.rpc('get_invitable_friends', { p_slug: slug }))
}

export async function inviteFriends(slug: string, userIds: string[]): Promise<number> {
  return check(await supabase.rpc('invite_friends', { p_slug: slug, p_user_ids: userIds }))
}
