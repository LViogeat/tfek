// Aperçu riche des liens d'event (WhatsApp, Messenger, iMessage, Telegram…).
// Les robots de ces applis n'exécutent pas le JavaScript : vercel.json leur envoie
// /api/event-preview (balises Open Graph) au lieu de l'app, et /og/:slug sert l'image du billet.
// Ce fichier ne contient que de la logique pure, testée dans tests/preview.test.ts.

import { getTheme } from '../../src/lib/themes'
import { goingNames, imageVersion, showResponses, type PreviewEvent, type PreviewGuest } from '../../src/lib/linkPreview'

export { goingNames, imageVersion, showResponses, type PreviewEvent, type PreviewGuest }

/** Les events n'ont pas de fuseau : on affiche l'heure de France, comme la plupart des invités. */
export const TIME_ZONE = 'Europe/Paris'

export const DEFAULT_TITLE = 'tfek'
export const DEFAULT_DESCRIPTION = 'Organise tes évènements et sache qui vient.'

const SLUG_RE = /^[A-Za-z0-9-]{1,64}$/

export function isValidSlug(slug: string | null | undefined): slug is string {
  return !!slug && SLUG_RE.test(slug)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « Samedi 5 décembre à 20:00 » */
export function longDate(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE }).format(d)
  return `${capitalize(day)} à ${shortTime(iso)}`
}

/** « SAM 05.12 », comme sur le billet de l'app */
export function ticketDate(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TIME_ZONE }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('weekday').replace('.', '').toUpperCase()} ${get('day')}.${get('month')}`
}

/** « 20:00 » */
export function shortTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(new Date(iso))
}

/** Dernière partie de l'adresse, en général la ville : « Chez moi, 12 rue des Lilas, Lyon » → « Lyon » */
export function shortPlace(location: string | null): string {
  if (!location) return ''
  return location.split(',').pop()!.trim()
}

/** « Alex, Inès et 10 autres viennent, 3 peut-être » ou « 12 viennent, 3 peut-être » */
export function responsesSentence(event: PreviewEvent, names: string[]): string {
  if (!showResponses(event)) return ''
  const { going, maybe } = event.counts!
  const verb = going > 1 ? 'viennent' : 'vient'
  const maybeText = maybe ? `, ${maybe} peut-être` : ''
  if (names.length === 0) return `${going} ${verb}${maybeText}`
  const shown = names.slice(0, Math.min(2, going))
  const rest = going - shown.length
  const who = rest > 0
    ? `${shown.join(', ')} et ${rest} ${rest > 1 ? 'autres' : 'autre'}`
    : shown.join(' et ')
  return `${who} ${verb}${maybeText}`
}

export function previewDescription(event: PreviewEvent, names: string[]): string {
  const parts = [longDate(event.starts_at)]
  const resp = responsesSentence(event, names)
  // Avec les réponses, on garde la ville pour que la description reste courte
  const place = resp ? shortPlace(event.location) : event.location
  if (place) parts.push(place)
  if (resp) parts.push(resp)
  const text = parts.join(' · ')
  return event.cancelled_at ? `Annulé · ${text}` : text
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Page HTML minimale servie aux robots : uniquement des balises. */
export function previewHtml(opts: { origin: string; slug: string; event: PreviewEvent | null; guests: PreviewGuest[] }): string {
  const { origin, slug, event } = opts
  const url = `${origin}/e/${slug}`
  const tags: [string, string, string][] = []
  const meta = (attr: 'property' | 'name', key: string, value: string) => tags.push([attr, key, value])

  let title = DEFAULT_TITLE
  let description = DEFAULT_DESCRIPTION
  meta('property', 'og:type', 'website')
  meta('property', 'og:site_name', 'tfek')
  meta('property', 'og:locale', 'fr_FR')
  meta('property', 'og:url', url)
  if (event) {
    const names = goingNames(event, opts.guests)
    title = event.title
    description = previewDescription(event, names)
    meta('property', 'og:title', title)
    meta('property', 'og:description', description)
    meta('property', 'og:image', `${origin}/og/${slug}?v=${imageVersion(event, names)}`)
    meta('property', 'og:image:type', 'image/png')
    meta('property', 'og:image:width', '1200')
    meta('property', 'og:image:height', '630')
    meta('property', 'og:image:alt', `Invitation : ${event.title}`)
    meta('name', 'twitter:card', 'summary_large_image')
  } else {
    meta('property', 'og:title', title)
    meta('property', 'og:description', description)
    meta('name', 'twitter:card', 'summary')
  }
  meta('name', 'description', description)

  const head = tags.map(([a, k, v]) => `<meta ${a}="${k}" content="${escapeHtml(v)}">`).join('\n    ')
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    ${head}
  </head>
  <body>
    <p><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></p>
  </body>
</html>
`
}

// ---------------------------------------------------------------------------
// Image du billet (1200 × 630), décrite comme un arbre d'éléments pour Satori (@vercel/og)
// ---------------------------------------------------------------------------

export interface Node {
  type: string
  props: { style?: Record<string, unknown>; children?: (Node | string)[] | Node | string; [attr: string]: unknown }
}

/** Satori exige `display: flex` sur tout conteneur à plusieurs enfants : on le met par défaut. */
function h(style: Record<string, unknown>, ...children: (Node | string | false | null | undefined)[]): Node {
  const kids = children.filter((c): c is Node | string => !!c || c === '')
  // Un enfant unique passe tel quel : Satori compte un tableau comme plusieurs nœuds
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } }
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
const PAD = 84
/** Le titre s'arrête avant le tampon */
const TITLE_WIDTH = 820

/** Taille du tampon sur le billet (rendu au double pour rester net) */
export const STAMP_SIZE = 236
export const STAMP_RENDER_SIZE = STAMP_SIZE * 2
const TILT = -12

/**
 * Tampon rond « INVITATION · TFEK », comme le composant TfekStamp, à rendre dans sa propre image.
 * Satori place mal des lettres tournées dès qu'elles ne sont pas à l'origine du canevas, et applique
 * mal une rotation parente : le tampon est donc rendu à part (puis incrusté avec `stampSrc`), et
 * l'inclinaison est ajoutée à chaque lettre.
 */
export function stampTree(themeId: string, size = STAMP_SIZE): Node {
  const color = getTheme(themeId).stamp
  const ring = 'INVITATION · TFEK · INVITATION · TFEK · '
  const radius = size * 0.36
  const fontSize = Math.round(size * 0.084)
  const circle = (r: number, width: number) =>
    h({
      position: 'absolute',
      left: size / 2 - r * size,
      top: size / 2 - r * size,
      width: 2 * r * size,
      height: 2 * r * size,
      borderRadius: '50%',
      border: `${width}px solid ${color}`,
    })
  // Chaque lettre est une petite boîte placée sur le cercle puis tournée sur elle-même
  const box = fontSize * 1.3
  const letters = [...ring].map((ch, i) => {
    const angle = (i * 2 * Math.PI) / ring.length + (TILT * Math.PI) / 180
    const x = size / 2 + radius * Math.sin(angle)
    const y = size / 2 - radius * Math.cos(angle)
    return h(
      {
        position: 'absolute', left: Math.round(x - box / 2), top: Math.round(y - box / 2), width: box, height: box,
        justifyContent: 'center', alignItems: 'center',
        transform: `rotate(${(angle * 180) / Math.PI}deg)`,
        fontSize, fontWeight: 700, color,
      },
      ch === ' ' ? '\u00a0' : ch,
    )
  })
  return h(
    { position: 'relative', width: size, height: size, fontFamily: 'JetBrains Mono' },
    circle(0.47, size * 0.017),
    circle(0.435, size * 0.0085),
    circle(0.26, size * 0.0106),
    ...letters,
    h(
      { position: 'absolute', left: 0, top: 0, width: size, height: size, justifyContent: 'center', alignItems: 'center', fontSize: Math.round(size * 0.14), fontWeight: 800, color, transform: `rotate(${TILT}deg)` },
      'tfek',
    ),
  )
}

function titleSize(title: string): { fontSize: number; lines: number } {
  const len = [...title].length
  if (len <= 30) return { fontSize: 80, lines: 2 }
  if (len <= 56) return { fontSize: 62, lines: 3 }
  return { fontSize: 50, lines: 3 }
}

/** `stampSrc` : image du tampon (data URI) produite à partir de stampTree() */
export function ogImageTree(event: PreviewEvent, names: string[], stampSrc?: string): Node {
  const t = getTheme(event.theme)
  const withResp = showResponses(event)
  const cancelled = !!event.cancelled_at
  const { fontSize, lines } = titleSize(event.title)
  const { going, maybe } = event.counts ?? { going: 0, maybe: 0 }
  const faces = names.slice(0, Math.min(3, going))

  return h(
    {
      position: 'relative', width: OG_WIDTH, height: OG_HEIGHT,
      backgroundColor: t.band,
      // Fines rayures verticales du bandeau
      backgroundImage: `repeating-linear-gradient(90deg, ${rgba(t.bandText, 0.05)} 0px, ${rgba(t.bandText, 0.05)} 1px, transparent 1px, transparent 7px)`,
      color: t.bandText,
      fontFamily: 'JetBrains Mono',
    },
    // Liseré intérieur
    h({ position: 'absolute', left: 38, top: 38, right: 38, bottom: 38, borderRadius: 28, border: `3px solid ${rgba(t.bandText, 0.24)}` }),
    !!stampSrc && {
      type: 'img',
      props: { src: stampSrc, width: STAMP_SIZE, height: STAMP_SIZE, style: { position: 'absolute', right: 70, top: 48, width: STAMP_SIZE, height: STAMP_SIZE } },
    } as Node,
    h({ position: 'absolute', left: PAD, top: 92, fontSize: 36, fontWeight: 700, letterSpacing: 5, color: t.stamp }, `N° ${event.slug.toUpperCase()}`),
    h(
      {
        position: 'absolute', left: PAD, width: TITLE_WIDTH, bottom: withResp ? 252 : 196,
        fontSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: -fontSize * 0.04,
        display: 'block', lineClamp: lines,
        textDecoration: cancelled ? 'line-through' : 'none',
      },
      event.title,
    ),
    h(
      { position: 'absolute', left: PAD, right: PAD, bottom: withResp ? 164 : 92, gap: 36, fontSize: 38, fontWeight: 700, letterSpacing: 1.5 },
      h({ flexShrink: 0 }, ticketDate(event.starts_at)),
      h({ flexShrink: 0 }, shortTime(event.starts_at)),
      !!event.location && h({ display: 'block', fontWeight: 600, opacity: 0.85, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, shortPlace(event.location)),
    ),
    withResp &&
      h(
        { position: 'absolute', left: PAD, right: PAD, bottom: 80, alignItems: 'center', gap: 24, color: t.stamp, fontSize: 43, fontWeight: 800, letterSpacing: 1.5 },
        faces.length > 0 &&
          h(
            {},
            ...faces.map((n, i) =>
              h(
                {
                  width: 74, height: 74, borderRadius: '50%', marginLeft: i === 0 ? 0 : -18,
                  border: `6px solid ${t.band}`, backgroundColor: t.stamp, color: t.band,
                  justifyContent: 'center', alignItems: 'center', fontSize: 30, fontWeight: 800,
                },
                [...n][0]!.toUpperCase(),
              ),
            ),
          ),
        `${going} ${going > 1 ? 'VIENNENT' : 'VIENT'}${maybe ? ` · ${maybe} PEUT-ÊTRE` : ''}`,
      ),
    cancelled &&
      h(
        {
          position: 'absolute', right: 84, bottom: 84, transform: 'rotate(-8deg)',
          border: `4px solid ${t.stamp}`, borderRadius: 14, padding: '10px 26px',
          backgroundColor: t.band, color: t.stamp, fontSize: 44, fontWeight: 800, letterSpacing: 6,
        },
        'ANNULÉ',
      ),
  )
}

// ---------------------------------------------------------------------------
// Lecture des données (REST Supabase, clé publique : mêmes droits qu'un visiteur sans session)
// ---------------------------------------------------------------------------

export interface SupabaseEnv {
  url: string
  key: string
}

export function supabaseEnv(env: Record<string, string | undefined>): SupabaseEnv {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définis')
  return { url: url.replace(/\/$/, ''), key }
}

async function rpc<T>(env: SupabaseEnv, fn: string, slug: string): Promise<T> {
  const res = await fetch(`${env.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  })
  if (!res.ok) throw new Error(`${fn} : ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

export async function loadPreview(env: SupabaseEnv, slug: string): Promise<{ event: PreviewEvent | null; guests: PreviewGuest[] }> {
  const [event, guests] = await Promise.all([
    rpc<PreviewEvent | null>(env, 'get_event', slug),
    rpc<PreviewGuest[]>(env, 'get_event_guests', slug),
  ])
  return { event, guests: guests ?? [] }
}

/** Origine publique des liens : VITE_PUBLIC_URL si défini, sinon celle de la requête. */
export function publicOrigin(env: Record<string, string | undefined>, requestUrl: string): string {
  const configured = env.PUBLIC_URL ?? env.VITE_PUBLIC_URL
  return (configured ?? new URL(requestUrl).origin).replace(/\/$/, '')
}

/** Encode une image PNG en data URI (btoa existe dans le runtime edge comme dans Node). */
export function pngDataUri(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(bin)}`
}

/** Le constructeur ImageResponse de @vercel/og (version edge en production, Node en local). */
type ImageResponseClass = new (element: never, options: Record<string, unknown>) => Response

export interface OgFont {
  name: string
  weight: 600 | 700 | 800
  style: 'normal'
  data: ArrayBuffer
}

/** Rend l'image du billet : d'abord le tampon, puis le billet qui l'incruste. */
export async function renderOgImage(
  ImageResponse: ImageResponseClass,
  opts: { event: PreviewEvent; guests: PreviewGuest[]; fonts: OgFont[]; headers?: Record<string, string> },
): Promise<Response> {
  const stamp = new ImageResponse(stampTree(opts.event.theme, STAMP_RENDER_SIZE) as never, {
    width: STAMP_RENDER_SIZE,
    height: STAMP_RENDER_SIZE,
    fonts: opts.fonts,
  })
  const stampSrc = pngDataUri(await stamp.arrayBuffer())
  const tree = ogImageTree(opts.event, goingNames(opts.event, opts.guests), stampSrc)
  return new ImageResponse(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: opts.fonts,
    emoji: 'twemoji',
    headers: opts.headers,
  })
}

/**
 * Garde en mémoire le résultat d'un chargement asynchrone, mais pas son échec :
 * après une erreur passagère, l'appel suivant réessaie au lieu de renvoyer la même erreur.
 */
export function memoizeSuccess<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = load().catch((e) => {
        cached = null
        throw e
      })
    }
    return cached
  }
}
