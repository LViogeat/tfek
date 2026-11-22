import { Share } from '@capacitor/share'
import { publicUrl } from './appUrl'

export function eventUrl(slug: string): string {
  return publicUrl(`/e/${slug}`)
}

/**
 * Lien à mettre dans les messages. WhatsApp et Messenger gardent l'aperçu en cache pour chaque
 * adresse : quand les réponses sont affichées dans l'aperçu, on ajoute `?r=oui-peutêtre` pour
 * qu'un rappel montre les chiffres du moment et pas ceux du premier envoi.
 */
export function shareUrl(event: {
  slug: string
  show_counts: boolean
  cancelled_at: string | null
  counts: { going: number; maybe: number } | null
}): string {
  const base = eventUrl(event.slug)
  const c = event.counts
  if (!event.show_counts || event.cancelled_at || !c || c.going === 0) return base
  return `${base}?r=${c.going}-${c.maybe}`
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function smsUrl(text: string): string {
  // `?&body=` fonctionne sur iOS et Android
  return `sms:?&body=${encodeURIComponent(text)}`
}

export async function canNativeShare(): Promise<boolean> {
  try {
    return (await Share.canShare()).value
  } catch {
    return false
  }
}

export async function nativeShare(title: string, text: string, url: string) {
  await Share.share({ title, text, url, dialogTitle: title })
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function invitationText(title: string, url: string): string {
  return `Tu es invité·e à « ${title} ».\nDis-moi si tu viens, pas besoin de compte : ${url}`
}

export function announcementText(title: string, body: string, url: string): string {
  return `Info pour « ${title} »\n${body}\n\nInfos et réponses : ${url}`
}

export function reminderText(title: string, url: string): string {
  return `Petit rappel pour « ${title} ». Si ce n’est pas déjà fait, dis-moi si tu viens : ${url}`
}
