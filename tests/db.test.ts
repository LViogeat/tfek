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
  async function eventWithInvitees(names: string[]) {
    const orga = await user('orga@test.fr')
    const { data: ev } = await orga
      .from('events')
      .insert({ title: 'Dîner', starts_at: new Date(Date.now() + 86400e3).toISOString(), show_guest_list: false, show_counts: false })
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
