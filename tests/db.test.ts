/**
 * Tests d'intégration sur la base Supabase locale.
 * Prérequis : `npm run db:start` puis `npm run db:reset` (charge seed.sql).
 */
import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'
import { goingNames, loadPreview, previewHtml } from '../api/_lib/preview'

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
    expect((ev as any).my_rsvp).toEqual({ status: 'going', display_name: name, plus_ones: 2, invitee_id: null })

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

describe('publication d’un brouillon', () => {
  it('un même brouillon n’est publié qu’une fois (deux onglets)', async () => {
    const orga = await user('orga@test.fr')
    const draftId = crypto.randomUUID()
    const row = { title: 'Brouillon partagé', starts_at: new Date(Date.now() + 86400e3).toISOString(), draft_id: draftId }
    expect((await orga.from('events').insert(row)).error).toBeNull()
    const second = await orga.from('events').insert(row)
    expect(second.error?.code).toBe('23505')
    const { data } = await orga.from('events').select('id').eq('draft_id', draftId)
    expect(data).toHaveLength(1)
  })

  it('message d’erreur en français pour un évènement annulé', async () => {
    const orga = await user('orga@test.fr')
    const { data: ev } = await orga
      .from('events')
      .insert({ title: 'Annulé', starts_at: new Date(Date.now() + 86400e3).toISOString(), cancelled_at: new Date().toISOString() })
      .select()
      .single()
    const g = await guest()
    const { error } = await g.rpc('rsvp', { p_slug: ev!.slug, p_status: 'going', p_display_name: 'Léa' })
    expect(error?.message).toBe('Cet évènement est annulé')
  })
})

describe('visibilité des réponses', () => {
  it('l’organisateur peut garder les réponses pour lui', async () => {
    const orga = await user('orga@test.fr')
    const { data: ev, error } = await orga
      .from('events')
      .insert({ title: 'Dîner secret', starts_at: new Date(Date.now() + 86400e3).toISOString(), show_guest_list: false, show_counts: false })
      .select()
      .single()
    expect(error).toBeNull()
    const g = await guest()
    await g.rpc('rsvp', { p_slug: ev!.slug, p_status: 'going', p_display_name: 'Léa' })

    // Ni nombre ni liste pour les invités et les visiteurs, tout pour l'organisateur
    expect(((await g.rpc('get_event', { p_slug: ev!.slug })).data as any).counts).toBeNull()
    expect(((await client().rpc('get_event', { p_slug: ev!.slug })).data as any).counts).toBeNull()
    expect((await g.rpc('get_event_guests', { p_slug: ev!.slug })).data).toEqual([])
    expect(((await orga.rpc('get_event', { p_slug: ev!.slug })).data as any).counts.going).toBe(1)
  })

  it('la liste des invités ne peut pas être publique si le nombre est masqué', async () => {
    const orga = await user('orga@test.fr')
    const { error } = await orga
      .from('events')
      .insert({ title: 'Incohérent', starts_at: new Date(Date.now() + 86400e3).toISOString(), show_guest_list: true, show_counts: false })
    expect(error).not.toBeNull()
  })
})

describe('aperçu du lien (fonctions Vercel)', () => {
  it('lit l’event et les prénoms avec la clé publique, sans session', async () => {
    const { event, guests } = await loadPreview({ url: URL, key: KEY }, SLUG)
    expect(event).toMatchObject({ title: 'Anniversaire de Camille 🎂', theme: 'bordeaux', show_counts: true })
    expect(event!.counts!.going).toBeGreaterThan(0)
    expect(goingNames(event!, guests).length).toBeGreaterThan(0)
    const html = previewHtml({ origin: 'https://tfek.app', slug: SLUG, event, guests })
    expect(html).toContain('<meta property="og:title" content="Anniversaire de Camille 🎂">')
    expect(html).toMatch(/og:image" content="https:\/\/tfek\.app\/og\/anniv-camille\?v=\w+"/)
  })

  it('slug inconnu → pas d’event', async () => {
    expect((await loadPreview({ url: URL, key: KEY }, 'nexistepas')).event).toBeNull()
  })
})

describe('invités attendus', () => {
  /** `isPrivate` : réponses visibles par l'organisateur seul. */
  async function eventWithInvitees(names: string[], isPrivate = false) {
    const orga = await user('orga@test.fr')
    const { data: ev } = await orga
      .from('events')
      .insert({ title: 'Dîner', starts_at: new Date(Date.now() + 86400e3).toISOString(), show_guest_list: !isPrivate, show_counts: !isPrivate })
      .select()
      .single()
    return { orga, slug: ev!.slug, added: (await orga.rpc('add_invitees', { p_slug: ev!.slug, p_names: names })) }
  }

  it('l’organisateur ajoute des prénoms, sans doublon', async () => {
    const { orga, slug, added } = await eventWithInvitees(['Inès', ' inès ', 'Sam', ''])
    expect(added.error).toBeNull()
    expect(added.data).toBe(2)
    expect((await orga.rpc('add_invitees', { p_slug: slug, p_names: ['SAM', 'Jo'] })).data).toBe(1)
    const { data } = await orga.rpc('get_event_invitees', { p_slug: slug })
    expect(data?.map((i) => [i.display_name, i.status])).toEqual([['Inès', null], ['Jo', null], ['Sam', null]])
  })

  it('seul l’organisateur ajoute ou retire des prénoms', async () => {
    const { orga, slug } = await eventWithInvitees(['Inès'])
    const g = await guest()
    expect((await g.rpc('add_invitees', { p_slug: slug, p_names: ['Pirate'] })).error).not.toBeNull()
    const other = await user('invite@test.fr')
    expect((await other.rpc('add_invitees', { p_slug: slug, p_names: ['Pirate'] })).error).not.toBeNull()

    const [ines] = (await orga.rpc('get_event_invitees', { p_slug: slug })).data!
    await g.from('invitees').delete().eq('id', ines!.id)
    expect((await orga.rpc('get_event_invitees', { p_slug: slug })).data).toHaveLength(1)
    expect((await orga.from('invitees').delete().eq('id', ines!.id).select()).data).toHaveLength(1)
  })

  it('« c’est moi » : le prénom est pris, l’organisateur voit la réponse, les autres ne le voient plus', async () => {
    const { orga, slug } = await eventWithInvitees(['Inès', 'Sam'])
    const g = await guest()
    const visible = (await g.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(visible.map((i) => [i.display_name, i.status])).toEqual([['Inès', null], ['Sam', null]])
    const ines = visible.find((i) => i.display_name === 'Inès')!

    expect((await g.rpc('rsvp', { p_slug: slug, p_status: 'going', p_display_name: '', p_invitee_id: ines.id })).error).toBeNull()
    const me = ((await g.rpc('get_event', { p_slug: slug })).data as any).my_rsvp
    expect(me).toMatchObject({ display_name: 'Inès', invitee_id: ines.id })
    expect((await g.rpc('get_event_invitees', { p_slug: slug })).data?.find((i) => i.is_me)?.display_name).toBe('Inès')

    // Un autre invité ne voit plus Inès et ne peut pas la prendre
    const g2 = await guest()
    expect((await g2.rpc('get_event_invitees', { p_slug: slug })).data?.map((i) => i.display_name)).toEqual(['Sam'])
    const taken = await g2.rpc('rsvp', { p_slug: slug, p_status: 'declined', p_display_name: '', p_invitee_id: ines.id })
    expect(taken.error?.message).toBe('Ce prénom a déjà répondu')

    // Visiteur sans session : prénoms libres, jamais de réponse
    const anon = (await client().rpc('get_event_invitees', { p_slug: slug })).data!
    expect(anon.map((i) => [i.display_name, i.status, i.is_me])).toEqual([['Sam', null, false]])

    const forOrga = (await orga.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(forOrga.map((i) => [i.display_name, i.status])).toEqual([['Inès', 'going'], ['Sam', null]])
  })

  it('réponses privées : un prénom pris reste affiché et se choisit sans rien révéler', async () => {
    const { orga, slug } = await eventWithInvitees(['Inès', 'Sam'], true)
    const g = await guest()
    const ines = (await g.rpc('get_event_invitees', { p_slug: slug })).data!.find((i) => i.display_name === 'Inès')!
    await g.rpc('rsvp', { p_slug: slug, p_status: 'going', p_display_name: '', p_invitee_id: ines.id })

    // Inès a répondu, mais les autres voient toujours les deux prénoms, sans réponse
    const g2 = await guest()
    const seen = (await g2.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(seen.map((i) => [i.display_name, i.status, i.is_me])).toEqual([['Inès', null, false], ['Sam', null, false]])
    // Choisir un prénom déjà pris ne renvoie pas d'erreur : la réponse est gardée, sans rattachement
    const res = await g2.rpc('rsvp', { p_slug: slug, p_status: 'declined', p_display_name: '', p_invitee_id: ines.id })
    expect(res.error).toBeNull()
    expect(((await g2.rpc('get_event', { p_slug: slug })).data as any).my_rsvp).toMatchObject({ display_name: 'Inès', invitee_id: null })
    // Le prénom reste à la première personne
    const forOrga = (await orga.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(forOrga.map((i) => [i.display_name, i.status])).toEqual([['Inès', 'going'], ['Sam', null]])
  })

  it('un prénom tapé qui est dans la liste vaut « c’est moi » ; changer d’avis libère le prénom', async () => {
    const { orga, slug } = await eventWithInvitees(['Inès', 'Sam'])
    const g = await guest()
    await g.rpc('rsvp', { p_slug: slug, p_status: 'maybe', p_display_name: 'sam' })
    expect(((await g.rpc('get_event', { p_slug: slug })).data as any).my_rsvp.display_name).toBe('Sam')
    const ines = (await g.rpc('get_event_invitees', { p_slug: slug })).data!.find((i) => i.display_name === 'Inès')!
    await g.rpc('rsvp', { p_slug: slug, p_status: 'maybe', p_display_name: '', p_invitee_id: ines.id })
    const forOrga = (await orga.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(forOrga.map((i) => [i.display_name, i.status])).toEqual([['Inès', 'maybe'], ['Sam', null]])
    // Un prénom hors liste libère aussi
    await g.rpc('rsvp', { p_slug: slug, p_status: 'maybe', p_display_name: 'Inès B.' })
    expect((await orga.rpc('get_event_invitees', { p_slug: slug })).data!.every((i) => i.status === null)).toBe(true)
  })

  it('un prénom ajouté après coup est rattaché à celui qui a déjà répondu', async () => {
    const { orga, slug } = await eventWithInvitees([])
    const g = await guest()
    await g.rpc('rsvp', { p_slug: slug, p_status: 'going', p_display_name: 'Léa' })
    await orga.rpc('add_invitees', { p_slug: slug, p_names: ['léa', 'Noé'] })
    const forOrga = (await orga.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(forOrga.map((i) => [i.display_name, i.status])).toEqual([['léa', 'going'], ['Noé', null]])
  })

  it('fusion : le « c’est moi » suit la réponse gardée', async () => {
    const { orga, slug } = await eventWithInvitees(['Alex', 'Inès'])
    const ids = Object.fromEntries((await orga.rpc('get_event_invitees', { p_slug: slug })).data!.map((i) => [i.display_name, i.id]))
    // Le compte répond « Alex », puis, plus tard et en invité, la même personne répond « Inès »
    const account = await user('invite@test.fr')
    await account.rpc('rsvp', { p_slug: slug, p_status: 'going', p_display_name: '', p_invitee_id: ids.Alex })
    const c = await guest()
    await c.rpc('rsvp', { p_slug: slug, p_status: 'maybe', p_display_name: '', p_invitee_id: ids['Inès'] })
    const { data: token } = await c.rpc('create_merge_token')
    await c.auth.signInWithPassword({ email: 'invite@test.fr', password: 'password' })
    await c.rpc('merge_anonymous_user', { p_token: token! })

    expect(((await c.rpc('get_event', { p_slug: slug })).data as any).my_rsvp).toMatchObject({ display_name: 'Inès', invitee_id: ids['Inès'] })
    const forOrga = (await orga.rpc('get_event_invitees', { p_slug: slug })).data!
    expect(forOrga.map((i) => [i.display_name, i.status])).toEqual([['Alex', null], ['Inès', 'maybe']])
  })

  it('le « c’est moi » suit l’invité quand il crée son compte', async () => {
    const { orga, slug } = await eventWithInvitees(['Alex'])
    const c = await guest()
    await c.rpc('rsvp', { p_slug: slug, p_status: 'going', p_display_name: 'Alex' })
    const { data: token } = await c.rpc('create_merge_token')
    await c.auth.signInWithPassword({ email: 'invite@test.fr', password: 'password' })
    await c.rpc('merge_anonymous_user', { p_token: token! })
    expect((await c.rpc('get_event_invitees', { p_slug: slug })).data?.[0]?.is_me).toBe(true)
    expect((await orga.rpc('get_event_invitees', { p_slug: slug })).data?.[0]?.status).toBe('going')
  })
})

describe('amis', () => {
  /** Un nouveau compte inscrit, avec un prénom. */
  async function newUser(name: string) {
    const c = client()
    const email = `${name.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}${Math.random().toString(36).slice(2, 8)}@test.fr`
    const { data, error } = await c.auth.signUp({ email, password: 'password', options: { data: { display_name: name } } })
    if (error) throw error
    return { c, id: data.user!.id }
  }
  async function codeOf(c: ReturnType<typeof client>, id: string) {
    return (await c.from('profiles').select('friend_code').eq('id', id).single()).data!.friend_code
  }

  it('le lien d’ami rend amis tout de suite, dans les deux sens', async () => {
    const a = await newUser('Nora')
    const b = await newUser('Paul')
    const code = await codeOf(a.c, a.id)

    // Lisible sans compte, pour afficher la page du lien
    expect((await client().rpc('get_friend_link', { p_code: code })).data).toMatchObject({ display_name: 'Nora', is_me: false, state: null })
    expect((await b.c.rpc('add_friend_by_code', { p_code: code })).data).toBe('Nora')
    expect((await a.c.rpc('list_friends')).data).toEqual([{ user_id: b.id, display_name: 'Paul', state: 'friends' }])
    expect((await b.c.rpc('get_friend_link', { p_code: code })).data).toMatchObject({ state: 'friends' })
    // Rouvrir le lien ne crée pas de doublon
    expect((await b.c.rpc('add_friend_by_code', { p_code: code })).error).toBeNull()
    expect((await b.c.rpc('list_friends')).data).toHaveLength(1)
    expect((await a.c.rpc('add_friend_by_code', { p_code: code })).error?.message).toBe("C'est ton propre lien")
  })

  it('un invité anonyme ne peut pas avoir d’amis', async () => {
    const a = await newUser('Nora')
    const g = await guest()
    expect((await g.rpc('add_friend_by_code', { p_code: await codeOf(a.c, a.id) })).error).not.toBeNull()
    expect((await a.c.rpc('request_friend', { p_user: (await g.auth.getUser()).data.user!.id })).error).not.toBeNull()
    // Pas de lien d'ami pour un anonyme
    const gid = (await g.auth.getUser()).data.user!.id
    expect((await client().rpc('get_friend_link', { p_code: await codeOf(g, gid) })).data).toBeNull()
  })

  it('demande, acceptation, refus et retrait', async () => {
    const a = await newUser('Nora')
    const b = await newUser('Paul')
    const c = await newUser('Zoé')
    expect((await a.c.rpc('request_friend', { p_user: b.id })).data).toBe('sent')
    expect((await b.c.rpc('list_friends')).data).toEqual([{ user_id: a.id, display_name: 'Nora', state: 'received' }])
    // Celui qui a demandé ne peut pas accepter à la place de l'autre
    expect((await a.c.rpc('accept_friend', { p_user: b.id })).data).toBe(false)
    expect((await b.c.rpc('accept_friend', { p_user: a.id })).data).toBe(true)
    expect((await a.c.rpc('list_friends')).data?.[0]?.state).toBe('friends')

    // Demandes croisées : la seconde vaut acceptation
    await a.c.rpc('request_friend', { p_user: c.id })
    expect((await c.c.rpc('request_friend', { p_user: a.id })).data).toBe('friends')

    // Retirer, dans n'importe quel sens
    expect((await b.c.rpc('remove_friend', { p_user: a.id })).data).toBe(true)
    expect((await a.c.rpc('list_friends')).data?.map((f) => f.display_name)).toEqual(['Zoé'])

    // Personne ne lit les amitiés des autres
    expect((await b.c.from('friendships').select()).data).toEqual([])
  })

  it('suggestions : les comptes croisés aux évènements dont la liste est visible', async () => {
    const orga = await newUser('Nora')
    const b = await newUser('Paul')
    const c = await newUser('Zoé')
    const ev = async (show: boolean) =>
      (await orga.c
        .from('events')
        .insert({ title: 'Apéro', starts_at: new Date(Date.now() + 86400e3).toISOString(), show_guest_list: show, show_counts: true })
        .select()
        .single()).data!.slug
    const open = await ev(true)
    const closed = await ev(false)
    await b.c.rpc('rsvp', { p_slug: open, p_status: 'going', p_display_name: 'Paul' })
    await c.c.rpc('rsvp', { p_slug: open, p_status: 'declined', p_display_name: 'Zoé' })
    await c.c.rpc('rsvp', { p_slug: closed, p_status: 'going', p_display_name: 'Zoé' })
    await b.c.rpc('rsvp', { p_slug: closed, p_status: 'going', p_display_name: 'Paul' })
    // Un anonyme n'est jamais suggéré
    await (await guest()).rpc('rsvp', { p_slug: open, p_status: 'going', p_display_name: 'Anonyme' })

    // L'organisateur voit tous ceux qui viennent ; Paul voit l'organisatrice, et Zoé seulement
    // via l'évènement fermé… où la liste est privée : pas de Zoé
    const forOrga = (await orga.c.rpc('friend_suggestions')).data!
    expect(forOrga.map((x) => [x.display_name, x.shared_events])).toEqual([['Paul', 2], ['Zoé', 1]])
    expect((await b.c.rpc('friend_suggestions')).data?.map((x) => x.display_name)).toEqual(['Nora'])

    await b.c.rpc('request_friend', { p_user: orga.id })
    expect((await b.c.rpc('friend_suggestions')).data).toEqual([])
  })

  it('l’organisateur invite un ami : l’évènement est dans ses invitations avant qu’il réponde', async () => {
    const orga = await newUser('Nora')
    const b = await newUser('Paul')
    const stranger = await newUser('Zoé')
    await b.c.rpc('add_friend_by_code', { p_code: await codeOf(orga.c, orga.id) })
    const { data: ev } = await orga.c
      .from('events')
      .insert({ title: 'Ciné', starts_at: new Date(Date.now() + 86400e3).toISOString() })
      .select()
      .single()

    expect((await orga.c.rpc('get_invitable_friends', { p_slug: ev!.slug })).data).toEqual([{ user_id: b.id, display_name: 'Paul' }])
    // Pas d'invitation pour qui n'est pas un ami
    expect((await orga.c.rpc('invite_friends', { p_slug: ev!.slug, p_user_ids: [b.id, stranger.id] })).data).toBe(1)
    expect((await orga.c.rpc('get_invitable_friends', { p_slug: ev!.slug })).data).toEqual([])
    expect((await orga.c.rpc('get_event_invitees', { p_slug: ev!.slug })).data?.map((i) => [i.display_name, i.status])).toEqual([['Paul', null]])

    // Paul voit l'évènement dans ses invitations, et se retrouve présélectionné
    const { data: mine } = await b.c.from('invitees').select('events(slug)').eq('user_id', b.id)
    expect(mine?.map((r) => r.events?.slug)).toEqual([ev!.slug])
    expect((await b.c.rpc('get_event_invitees', { p_slug: ev!.slug })).data?.[0]?.is_me).toBe(true)
    // Zoé, non invitée, ne voit rien
    expect((await stranger.c.from('events').select().eq('id', ev!.id)).data).toEqual([])
    // Un autre compte ne peut pas inviter à la place de l'organisateur
    expect((await b.c.rpc('invite_friends', { p_slug: ev!.slug, p_user_ids: [orga.id] })).error).not.toBeNull()

    // Un ami sans prénom n'est pas proposé, un homonyme devient « Paul 2 »
    const nameless = await newUser('Paul')
    await nameless.c.from('profiles').update({ display_name: null }).eq('id', nameless.id)
    const homonym = await newUser('Paul')
    for (const f of [nameless, homonym]) await f.c.rpc('add_friend_by_code', { p_code: await codeOf(orga.c, orga.id) })
    expect((await orga.c.rpc('get_invitable_friends', { p_slug: ev!.slug })).data).toEqual([{ user_id: homonym.id, display_name: 'Paul' }])
    expect((await orga.c.rpc('invite_friends', { p_slug: ev!.slug, p_user_ids: [nameless.id, homonym.id] })).data).toBe(1)
    expect((await orga.c.rpc('get_event_invitees', { p_slug: ev!.slug })).data?.map((i) => i.display_name)).toEqual(['Paul', 'Paul 2'])

    // Paul répond : l'organisateur le voit, marqué comme ami
    await b.c.rpc('rsvp', { p_slug: ev!.slug, p_status: 'going', p_display_name: 'Paul' })
    const guests = (await orga.c.rpc('get_event_guests', { p_slug: ev!.slug })).data!
    expect(guests.map((g) => [g.display_name, g.is_friend])).toEqual([['Paul', true]])
    expect((await client().rpc('get_event_guests', { p_slug: ev!.slug })).data?.[0]?.is_friend).toBe(false)
  })
})

describe('dupliquer et prévenir des changements', () => {
  it('copy_invitees : les amis restent rattachés, les autres prénoms sont copiés libres', async () => {
    const orga = await user('orga@test.fr')
    const friend = await user('invite@test.fr')
    const code = (await orga.from('profiles').select('friend_code').eq('id', '11111111-1111-1111-1111-111111111111').single()).data!.friend_code
    await friend.rpc('add_friend_by_code', { p_code: code })
    const mk = async () =>
      (await orga.from('events').insert({ title: 'Foot', starts_at: new Date(Date.now() + 86400e3).toISOString() }).select().single()).data!.slug
    const [a, b] = [await mk(), await mk()]
    await orga.rpc('add_invitees', { p_slug: a, p_names: ['Inès', 'Sam'] })
    await orga.rpc('invite_friends', { p_slug: a, p_user_ids: ['22222222-2222-2222-2222-222222222222'] })
    // Sam a répondu en invité anonyme : son prénom est copié sans lui
    const g = await guest()
    await g.rpc('rsvp', { p_slug: a, p_status: 'going', p_display_name: 'Sam' })

    // Un invité ou un autre compte ne peut pas copier
    expect((await friend.rpc('copy_invitees', { p_from: a, p_to: b })).error).not.toBeNull()
    expect((await orga.rpc('copy_invitees', { p_from: a, p_to: b })).data).toBe(3)
    const copied = (await orga.rpc('get_event_invitees', { p_slug: b })).data!
    expect(copied.map((i) => [i.display_name, i.status])).toEqual([['Alex', null], ['Inès', null], ['Sam', null]])
    // Alex (ami) voit déjà la copie dans ses invitations ; l'invité anonyme non
    const { data: mine } = await friend.from('invitees').select('events(slug)').eq('user_id', '22222222-2222-2222-2222-222222222222')
    expect(mine?.map((r) => r.events?.slug)).toContain(b)
    expect((await g.rpc('get_event_invitees', { p_slug: b })).data?.some((i) => i.is_me)).toBe(false)
    // Recopier n'ajoute rien
    expect((await orga.rpc('copy_invitees', { p_from: a, p_to: b })).data).toBe(0)
    // Ni vers le même évènement, ni vers un évènement annulé
    expect((await orga.rpc('copy_invitees', { p_from: a, p_to: a })).error).not.toBeNull()
    const { data: cancelled } = await orga
      .from('events')
      .insert({ title: 'Annulé', starts_at: new Date(Date.now() + 86400e3).toISOString(), cancelled_at: new Date().toISOString() })
      .select()
      .single()
    expect((await orga.rpc('copy_invitees', { p_from: a, p_to: cancelled!.slug })).error?.message).toBe('Cet évènement est annulé')
    await orga.rpc('remove_friend', { p_user: '22222222-2222-2222-2222-222222222222' })
  })

  it('les infos portent leur type, lisible par tous avec le lien', async () => {
    const orga = await user('orga@test.fr')
    const { data: ev } = await orga
      .from('events')
      .insert({ title: 'Ciné', starts_at: new Date(Date.now() + 86400e3).toISOString() })
      .select()
      .single()
    expect((await orga.from('announcements').insert({ event_id: ev!.id, body: 'Nouvelle heure : 21:00', kind: 'change' })).error).toBeNull()
    expect((await orga.from('announcements').insert({ event_id: ev!.id, body: 'x', kind: 'autre' })).error).not.toBeNull()
    const { data } = await client().rpc('get_event_announcements', { p_slug: ev!.slug })
    expect(data?.map((a) => [a.body, a.kind])).toEqual([['Nouvelle heure : 21:00', 'change']])
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

  it('la réponse la plus récente gagne quand le compte avait déjà répondu', async () => {
    const orga = await user('orga@test.fr')
    const { data: ev } = await orga
      .from('events')
      .insert({ title: 'Ciné', starts_at: new Date(Date.now() + 86400e3).toISOString() })
      .select()
      .single()
    // Le compte a dit oui la semaine dernière…
    const account = await user('invite@test.fr')
    await account.rpc('rsvp', { p_slug: ev!.slug, p_status: 'going', p_display_name: 'Alex' })
    // …puis, sur un autre téléphone, il répond non en invité et se connecte
    const c = await guest()
    await c.rpc('rsvp', { p_slug: ev!.slug, p_status: 'declined', p_display_name: 'Alex' })
    const { data: token } = await c.rpc('create_merge_token')
    await c.auth.signInWithPassword({ email: 'invite@test.fr', password: 'password' })
    expect((await c.rpc('merge_anonymous_user', { p_token: token! })).data).toBe(1)
    expect(((await c.rpc('get_event', { p_slug: ev!.slug })).data as any).my_rsvp.status).toBe('declined')
  })

  it('un compte inscrit ne peut pas créer de jeton', async () => {
    const c = await user('invite@test.fr')
    expect((await c.rpc('create_merge_token')).data).toBeNull()
  })
})

describe('identifiants aléatoires', () => {
  it('les slugs utilisent tout l’alphabet de façon uniforme', async () => {
    const orga = await user('orga@test.fr')
    const rows = Array.from({ length: 200 }, (_, i) => ({
      title: `Slug ${i}`,
      starts_at: new Date(Date.now() + 86400e3).toISOString(),
    }))
    const { data, error } = await orga.from('events').insert(rows).select('id, slug')
    expect(error).toBeNull()
    const counts = new Map<string, number>()
    for (const r of data!) for (const ch of r.slug) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    // 2000 caractères sur 57 symboles ≈ 35 chacun. Avec le biais modulo, les 28 premiers
    // symboles sortaient ~25 % plus souvent : on compare les deux moitiés de l'alphabet.
    const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const sum = (s: string) => [...s].reduce((n, c) => n + (counts.get(c) ?? 0), 0) / s.length
    const ratio = sum(alphabet.slice(0, 28)) / sum(alphabet.slice(28))
    expect(ratio).toBeGreaterThan(0.85)
    expect(ratio).toBeLessThan(1.15)
    await orga.from('events').delete().in('id', data!.map((r) => r.id))
  })
})
