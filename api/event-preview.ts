// Balises Open Graph d'un event, servies aux robots des messageries (voir vercel.json).
import { isValidSlug, loadPreview, previewHtml, publicOrigin, supabaseEnv } from './_lib/preview'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const env = process.env
  const slug = new URL(req.url).searchParams.get('slug')
  const origin = publicOrigin(env, req.url)
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' }

  if (!isValidSlug(slug)) {
    return new Response(previewHtml({ origin, slug: '', event: null, guests: [] }), { status: 404, headers })
  }
  try {
    const { event, guests } = await loadPreview(supabaseEnv(env), slug)
    return new Response(previewHtml({ origin, slug, event, guests }), { status: event ? 200 : 404, headers })
  } catch (e) {
    console.error(e)
    // En cas de souci, un aperçu générique plutôt que rien
    return new Response(previewHtml({ origin, slug, event: null, guests: [] }), {
      headers: { ...headers, 'Cache-Control': 'no-store' },
    })
  }
}
