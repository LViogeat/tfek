import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  goingNames, imageVersion, isValidSlug, memoizeSuccess, longDate, ogImageTree, previewDescription, previewHtml,
  responsesSentence, shortPlace, ticketDate, type PreviewEvent, type PreviewGuest,
} from '../api/_lib/preview'
import { maybeText, reminderText, shareUrl } from '../src/lib/share'

const EVENT: PreviewEvent = {
  slug: 'k7m2qx9pda',
  title: 'Anniversaire de Camille',
  // 20:00 à Paris (heure d'hiver)
  starts_at: '2026-12-05T19:00:00Z',
  ends_at: null,
  location: 'Chez moi, 12 rue des Lilas, Lyon',
  theme: 'bordeaux',
  show_guest_list: true,
  show_counts: true,
  cancelled_at: null,
  organizer_name: 'Camille',
  counts: { going: 12, maybe: 3, declined: 1 },
}
const GUESTS: PreviewGuest[] = [
  { display_name: 'Alex Martin', status: 'going' },
  { display_name: 'Sam', status: 'declined' },
  { display_name: 'Inès', status: 'going' },
  { display_name: 'Théo', status: 'going' },
  { display_name: 'Léa', status: 'maybe' },
]
const names = goingNames(EVENT, GUESTS)

describe('aperçu du lien', () => {
  it('formate la date à l’heure de Paris', () => {
    expect(longDate(EVENT.starts_at)).toBe('Samedi 5 décembre à 20:00')
    expect(ticketDate(EVENT.starts_at)).toBe('SAM 05.12')
  })

  it('garde la ville de l’adresse', () => {
    expect(shortPlace(EVENT.location)).toBe('Lyon')
    expect(shortPlace('Parc de la Tête d’Or')).toBe('Parc de la Tête d’Or')
    expect(shortPlace(null)).toBe('')
  })

  it('prénoms des premiers qui viennent, seulement si la liste est publique', () => {
    expect(names).toEqual(['Alex', 'Inès', 'Théo'])
    expect(goingNames({ ...EVENT, show_guest_list: false }, GUESTS)).toEqual([])
  })

  it('phrase des réponses selon le réglage', () => {
    expect(responsesSentence(EVENT, names)).toBe('Alex, Inès et 10 autres viennent, 3 peut-être')
    expect(responsesSentence(EVENT, [])).toBe('12 viennent, 3 peut-être')
    expect(responsesSentence({ ...EVENT, counts: { going: 2, maybe: 0, declined: 0 } }, names)).toBe('Alex et Inès viennent')
    expect(responsesSentence({ ...EVENT, counts: { going: 1, maybe: 0, declined: 0 } }, names)).toBe('Alex vient')
    expect(responsesSentence({ ...EVENT, counts: { going: 3, maybe: 0, declined: 0 } }, ['Alex'])).toBe('Alex et 2 autres viennent')
    // Rien à afficher : réponses masquées, personne encore, ou event annulé
    expect(responsesSentence({ ...EVENT, counts: null }, [])).toBe('')
    expect(responsesSentence({ ...EVENT, counts: { going: 0, maybe: 2, declined: 0 } }, [])).toBe('')
    expect(responsesSentence({ ...EVENT, cancelled_at: '2026-11-30T10:00:00Z' }, names)).toBe('')
  })

  it('description : adresse complète sans réponses, ville avec', () => {
    expect(previewDescription({ ...EVENT, counts: null }, [])).toBe('Samedi 5 décembre à 20:00 · Chez moi, 12 rue des Lilas, Lyon')
    expect(previewDescription(EVENT, names)).toBe('Samedi 5 décembre à 20:00 · Lyon · Alex, Inès et 10 autres viennent, 3 peut-être')
    expect(previewDescription({ ...EVENT, cancelled_at: '2026-11-30T10:00:00Z' }, names)).toMatch(/^Annulé · /)
  })

  it('l’empreinte de l’image change avec les réponses, pas avec les refus', () => {
    const v = imageVersion(EVENT, names)
    expect(imageVersion(EVENT, names)).toBe(v)
    expect(imageVersion({ ...EVENT, counts: { going: 13, maybe: 3, declined: 1 } }, names)).not.toBe(v)
    expect(imageVersion({ ...EVENT, counts: { going: 12, maybe: 3, declined: 5 } }, names)).toBe(v)
    expect(imageVersion({ ...EVENT, theme: 'vert' }, names)).not.toBe(v)
  })

  it('échappe le HTML des balises', () => {
    const html = previewHtml({ origin: 'https://tfek.app', slug: EVENT.slug, event: { ...EVENT, title: 'Soirée "<script>"' }, guests: GUESTS })
    expect(html).not.toContain('<script>')
    expect(html).toContain('content="Soirée &quot;&lt;script&gt;&quot;"')
    expect(html).toContain('<meta property="og:image:width" content="1200">')
  })

  it('aperçu générique pour un event introuvable', () => {
    const html = previewHtml({ origin: 'https://tfek.app', slug: 'x', event: null, guests: [] })
    expect(html).toContain('<meta property="og:title" content="tfek">')
    expect(html).not.toContain('og:image"')
  })

  it('refuse les slugs bizarres', () => {
    expect(isValidSlug('anniv-camille')).toBe(true)
    expect(isValidSlug('../etc')).toBe(false)
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug(null)).toBe(false)
  })

  it('l’image affiche les réponses seulement quand il y en a', () => {
    const text = (t: unknown) => JSON.stringify(t)
    expect(text(ogImageTree(EVENT, names))).toContain('12 VIENNENT · 3 PEUT-ÊTRE')
    expect(text(ogImageTree({ ...EVENT, counts: null }, []))).not.toContain('VIENNENT')
    expect(text(ogImageTree({ ...EVENT, cancelled_at: '2026-11-30T10:00:00Z' }, names))).toContain('ANNULÉ')
  })
})

describe('lien partagé', () => {
  // eventUrl() prend l'origine de la page
  beforeAll(() => vi.stubGlobal('window', { location: { origin: 'https://tfek.app' } }))
  const withSlug = { ...EVENT, slug: 'abc' }

  it('porte l’empreinte de l’image quand les réponses sont visibles', () => {
    const url = shareUrl(withSlug, GUESTS)
    expect(url).toBe(`https://tfek.app/e/abc?r=${imageVersion(withSlug, names)}`)
  })

  it('change quand un invité en remplace un autre, même avec les mêmes chiffres', () => {
    const swapped: PreviewGuest[] = [{ display_name: 'Paul', status: 'going' }, ...GUESTS.slice(1)]
    expect(shareUrl(withSlug, swapped)).not.toBe(shareUrl(withSlug, GUESTS))
  })

  it('suit ce que voit la messagerie : sans liste publique, les prénoms ne comptent pas', () => {
    const privateList = { ...withSlug, show_guest_list: false }
    const swapped: PreviewGuest[] = [{ display_name: 'Paul', status: 'going' }, ...GUESTS.slice(1)]
    expect(shareUrl(privateList, swapped)).toBe(shareUrl(privateList, GUESTS))
  })

  it('lien simple sans réponses visibles', () => {
    expect(shareUrl({ ...withSlug, counts: { going: 0, maybe: 2, declined: 0 } })).toBe('https://tfek.app/e/abc')
    // L'organisatrice voit les chiffres, mais pas la messagerie
    expect(shareUrl({ ...withSlug, show_guest_list: false, show_counts: false }, GUESTS)).toBe('https://tfek.app/e/abc')
  })
})

describe('chargement des polices', () => {
  it('garde le succès, réessaie après un échec', async () => {
    let calls = 0
    const load = memoizeSuccess(async () => {
      calls++
      if (calls === 1) throw new Error('réseau')
      return 'ok'
    })
    await expect(load()).rejects.toThrow('réseau')
    expect(await load()).toBe('ok')
    expect(await load()).toBe('ok')
    expect(calls).toBe(2)
  })
})

describe('relance', () => {
  it('s’accorde avec le nombre de prénoms', () => {
    expect(reminderText('Dîner', 'U', ['Alex'])).toBe('Petit rappel pour « Dîner ». Alex, dis-moi si tu viens : U')
    expect(reminderText('Dîner', 'U', ['Alex', 'Inès'])).toBe('Petit rappel pour « Dîner ». Alex et Inès, dites-moi si vous venez : U')
    expect(reminderText('Dîner', 'U')).toContain('Si ce n’est pas déjà fait')
  })
})

describe('relance des « peut-être »', () => {
  it('prénoms au singulier, au pluriel, ou message général', () => {
    expect(maybeText('Dîner', 'U', ['Alex'])).toBe('Petit rappel pour « Dîner ». Alex, tu m’avais dit peut-être. Tu viens ? Réponds ici : U')
    expect(maybeText('Dîner', 'U', ['Alex', 'Inès'])).toBe(
      'Petit rappel pour « Dîner ». Alex et Inès, vous m’aviez dit peut-être. Vous venez ? Répondez ici : U',
    )
    const many = Array.from({ length: 9 }, (_, i) => `P${i}`)
    expect(maybeText('Dîner', 'U', many)).toBe('Petit rappel pour « Dîner ». Si tu m’avais dit peut-être, tu viens ? Réponds ici : U')
    expect(maybeText('Dîner', 'U')).toBe(maybeText('Dîner', 'U', many))
  })
})
