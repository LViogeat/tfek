import { supabase } from './supabase'
import type { Database } from './database.types'

export type RsvpStatus = Database['public']['Enums']['rsvp_status']
export type EventVisibility = Database['public']['Enums']['event_visibility']
export type EventRow = Database['public']['Tables']['events']['Row']

export interface EventDetails {
  id: string
  slug: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  cover_url: string | null
  visibility: EventVisibility
  show_guest_list: boolean
  allow_plus_ones: boolean
  cancelled_at: string | null
  created_at: string
  organizer_name: string
  is_organizer: boolean
  counts: { going: number; maybe: number; declined: number }
  my_rsvp: { status: RsvpStatus; display_name: string; plus_ones: number } | null
}

export interface Guest {
  display_name: string
  status: RsvpStatus
  plus_ones: number
  is_me: boolean
  updated_at: string
}

export interface Announcement {
  id: string
  body: string
  created_at: string
}

export interface EventInput {
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  visibility: EventVisibility
  show_guest_list: boolean
  allow_plus_ones: boolean
}

/** Lève une erreur Supabase ; sans erreur, `data` est présent (sauf maybeSingle / RPC nullable). */
function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function getEvent(slug: string): Promise<EventDetails | null> {
  const data = check(await supabase.rpc('get_event', { p_slug: slug }))
  return (data as unknown as EventDetails | null) ?? null
}

export async function getGuests(slug: string): Promise<Guest[]> {
  return check(await supabase.rpc('get_event_guests', { p_slug: slug }))
}

export async function getAnnouncements(slug: string): Promise<Announcement[]> {
  return check(await supabase.rpc('get_event_announcements', { p_slug: slug }))
}

export async function respond(slug: string, status: RsvpStatus, displayName: string, plusOnes = 0) {
  check(
    await supabase.rpc('rsvp', {
      p_slug: slug,
      p_status: status,
      p_display_name: displayName,
      p_plus_ones: plusOnes,
    }),
  )
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  return check(await supabase.from('events').insert(input).select().single())
}

export async function updateEvent(id: string, input: Partial<EventInput> & { cancelled_at?: string | null }) {
  return check(await supabase.from('events').update(input).eq('id', id).select().single())
}

export async function getEventForEdit(slug: string): Promise<EventRow | null> {
  return check(await supabase.from('events').select().eq('slug', slug).maybeSingle()) ?? null
}

export async function postAnnouncement(eventId: string, body: string) {
  check(await supabase.from('announcements').insert({ event_id: eventId, body }))
}

export async function deleteAnnouncement(id: string) {
  check(await supabase.from('announcements').delete().eq('id', id))
}

export async function listOrganized(userId: string): Promise<EventRow[]> {
  return check(
    await supabase.from('events').select().eq('organizer_id', userId).order('starts_at', { ascending: true }),
  )
}

export interface Invitation {
  status: RsvpStatus
  event: EventRow
}

export async function listInvitations(userId: string): Promise<Invitation[]> {
  const rows = check(
    await supabase.from('rsvps').select('status, events(*)').eq('user_id', userId),
  )
  return rows
    .filter((r) => r.events && r.events.organizer_id !== userId)
    .map((r) => ({ status: r.status, event: r.events as EventRow }))
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at))
}

export async function getMyDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.display_name ?? null
}

export async function setMyDisplayName(userId: string, name: string) {
  check(await supabase.from('profiles').update({ display_name: name }).eq('id', userId))
}
