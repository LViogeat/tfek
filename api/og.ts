// Image d'aperçu d'un event (billet 1200 × 630), générée à la volée.
import { ImageResponse } from '@vercel/og'
import { isValidSlug, loadPreview, renderOgImage, supabaseEnv } from './_lib/preview'

export const config = { runtime: 'edge' }

const fonts = Promise.all(
  ([600, 700, 800] as const).map(async (weight) => ({
    name: 'JetBrains Mono',
    weight,
    style: 'normal' as const,
    data: await fetch(new URL(`./_fonts/jetbrains-mono-${weight}.woff`, import.meta.url)).then((r) => r.arrayBuffer()),
  })),
)

export default async function handler(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get('slug')
  if (!isValidSlug(slug)) return new Response('Not found', { status: 404 })
  try {
    const { event, guests } = await loadPreview(supabaseEnv(process.env), slug)
    if (!event) return new Response('Not found', { status: 404 })
    return await renderOgImage(ImageResponse, {
      event,
      guests,
      fonts: await fonts,
      // L'URL contient une empreinte du contenu (?v=) : on peut garder l'image longtemps
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch (e) {
    console.error(e)
    return new Response('Erreur', { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
