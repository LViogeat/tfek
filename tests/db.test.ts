/**
 * Tests d'intégration sur la base Supabase locale.
 * Prérequis : `npm run db:start` puis `npm run db:reset` (charge seed.sql).
 */
import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

function client() {
  return createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function guest() {
  const c = client()
  const { error } = await c.auth.signInAnonymously()
  if (error) throw error
  return c
}

async function user(email: string) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password: 'password' })
  if (error) throw error
  return c
}

const SLUG = 'anniv-camille'

describe('accès public par lien', () => {
  it('un visiteur non connecté voit l’event via son slug', async () => {
    const { data, error } = await client().rpc('get_event', { p_slug: SLUG })
    expect(error).toBeNull()
    expect(data).toMatchObject({ title: 'Anniversaire de Camille 🎂', organizer_name: 'Camille', is_organizer: false })
  })

  it('on ne peut pas lister les events', async () => {
    const { data } = await client().from('events').select()
    expect(data).toEqual([])
    const g = await guest()
    expect((await g.from('events').select()).data).toEqual([])
  })

  it('slug inconnu → null', async () => {
    const { data } = await client().rpc('get_event', { p_slug: 'nexistepas' })
    expect(data).toBeNull()
  })

  it('les annonces sont visibles avec le lien', async () => {
    const { data } = await client().rpc('get_event_announcements', { p_slug: SLUG })
    expect(data?.[0]?.body).toContain('4521B')
  })
})

describe('réponse sans compte', () => {
  it('un visiteur sans session ne peut pas répondre', async () => {
    const { error } = await client().rpc('rsvp', { p_slug: SLUG, p_status: 'going', p_display_name: 'X' })
    expect(error).not.toBeNull()
  })

  it('un invité anonyme répond, modifie sa réponse et apparaît dans la liste', async () => {
    const g = await guest()
    const name = `Invité ${Math.random().toString(36).slice(2, 7)}`
    expect((await g.rpc('rsvp', { p_slug: SLUG, p_status: 'maybe', p_display_name: name })).error).toBeNull()
    expect((await g.rpc('rsvp', { p_slug: SLUG, p_status: 'going', p_display_name: name, p_plus_ones: 2 })).error).toBeNull()

    const { data: ev } = await g.rpc('get_event', { p_slug: SLUG })
    expect((ev as any).my_rsvp).toEqual({ status: 'going', display_name: name, plus_ones: 2 })

    const { data: guests } = await g.rpc('get_event_guests', { p_slug: SLUG })
    const me = guests!.filter((x) => x.is_me)
    expect(me).toHaveLength(1)
    expect(me[0]).toMatchObject({ display_name: name, status: 'going', plus_ones: 2 })
    // Ne fuite pas d'identifiants
    expect(Object.keys(guests![0]!)).not.toContain('user_id')

    // L'invité retrouve l'event dans ses invitations
    const uid = (await g.auth.getUser()).data.user!.id
    const { data: mine } = await g.from('rsvps').select('status, events(slug)').eq('user_id', uid)
    expect(mine?.map((r) => r.events?.slug)).toContain(SLUG)
  })

  it('pas de +1 quand on décline', async () => {
    const g = await guest()
    await g.rpc('rsvp', { p_slug: SLUG, p_status: 'declined', p_display_name: 'Sam', p_plus_ones: 3 })
    const { data } = await g.rpc('get_event', { p_slug: SLUG })
    expect((data as any).my_rsvp.plus_ones).toBe(0)
  })

  it('prénom obligatoire', async () => {
    const g = await guest()
    const { error } = await g.rpc('rsvp', { p_slug: SLUG, p_status: 'going', p_display_name: '   ' })
    expect(error).not.toBeNull()
  })
})

describe('organisation', () => {
  it('un invité anonyme ne peut pas créer d’event', async () => {
    const g = await guest()
    const { error } = await g.from('events').insert({ title: 'Test', starts_at: new Date().toISOString() })
    expect(error).not.toBeNull()
  })

  it('un compte crée un event, publie une annonce, masque la liste des invités', async () => {
    const orga = await user('orga@test.fr')
    const { data: ev, error } = await orga
      .from('events')
      .insert({ title: 'Soirée jeux', starts_at: new Date(Date.now() + 86400e3).toISOString(), show_guest_list: false })
      .select()
      .single()
    expect(error).toBeNull()
    expect(ev!.slug).toMatch(/^[a-zA-Z0-9]{10}$/)

    expect((await orga.from('announcements').insert({ event_id: ev!.id, body: 'Ramenez vos jeux' })).error).toBeNull()

    const g = await guest()
    await g.rpc('rsvp', { p_slug: ev!.slug, p_status: 'going', p_display_name: 'Léa' })

    // Liste masquée pour les invités, visible pour l'organisateur
    expect((await g.rpc('get_event_guests', { p_slug: ev!.slug })).data).toEqual([])
    const { data: forOrga } = await orga.rpc('get_event_guests', { p_slug: ev!.slug })
    expect(forOrga?.map((x) => x.display_name)).toEqual(['Léa'])
    // Les compteurs restent visibles
    const { data: details } = await g.rpc('get_event', { p_slug: ev!.slug })
    expect((details as any).counts.going).toBe(1)

    // Un invité ne peut ni modifier l'event ni publier d'annonce
    const upd = await g.from('events').update({ title: 'Hack' }).eq('id', ev!.id).select()
    expect(upd.data ?? []).toEqual([])
    expect((await g.from('announcements').insert({ event_id: ev!.id, body: 'spam' })).error).not.toBeNull()
  })

  it('un autre compte ne peut pas modifier l’event de quelqu’un', async () => {
    const other = await user('invite@test.fr')
    const res = await other.from('events').update({ title: 'Hack' }).eq('slug', SLUG).select()
    expect(res.data ?? []).toEqual([])
  })
})

describe('fusion invité → compte', () => {
  it('les réponses anonymes sont rattachées au compte après connexion', async () => {
    const c = await guest()
    const { data: ev } = await (await user('orga@test.fr'))
      .from('events')
      .insert({ title: 'Brunch', starts_at: new Date(Date.now() + 86400e3).toISOString() })
      .select()
      .single()
    await c.rpc('rsvp', { p_slug: ev!.slug, p_status: 'going', p_display_name: 'Alex' })

    const { data: token } = await c.rpc('create_merge_token')
    expect(token).toBeTruthy()

    // Même client : connexion au vrai compte
    await c.auth.signInWithPassword({ email: 'invite@test.fr', password: 'password' })
    const { data: merged } = await c.rpc('merge_anonymous_user', { p_token: token! })
    expect(merged).toBe(1)

    const { data } = await c.rpc('get_event', { p_slug: ev!.slug })
    expect((data as any).my_rsvp.status).toBe('going')
    const { data: guests } = await c.rpc('get_event_guests', { p_slug: ev!.slug })
    expect(guests).toHaveLength(1)

    // Le jeton n'est utilisable qu'une fois
    expect((await c.rpc('merge_anonymous_user', { p_token: token! })).data).toBe(0)
  })

  it('un compte inscrit ne peut pas créer de jeton', async () => {
    const c = await user('invite@test.fr')
    expect((await c.rpc('create_merge_token')).data).toBeNull()
  })
})
