import { Share } from '@capacitor/share'
import { publicUrl } from './appUrl'
import { goingNames, imageVersion, showResponses, type PreviewEvent, type PreviewGuest } from './linkPreview'

export function eventUrl(slug: string): string {
  return publicUrl(`/e/${slug}`)
}

/**
 * Lien à mettre dans les messages. WhatsApp et Messenger gardent l'aperçu en cache pour chaque
 * adresse : quand les réponses sont affichées dans l'aperçu, on ajoute `?r=<empreinte de l'image>`
 * pour qu'un rappel montre les réponses du moment (chiffres et prénoms) et pas celles du premier envoi.
 */
export function shareUrl(event: PreviewEvent, guests: PreviewGuest[] = []): string {
  const base = eventUrl(event.slug)
  // Ce que voit le robot d'une messagerie, qui consulte l'évènement sans session
  const seen: PreviewEvent = { ...event, counts: event.show_counts ? event.counts : null }
  if (!showResponses(seen)) return base
  return `${base}?r=${imageVersion(seen, goingNames(seen, guests))}`
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

/** Le lien est déjà dans le texte : on ne le passe pas en plus, sinon il apparaît deux fois. */
export async function nativeShare(title: string, text: string) {
  await Share.share({ title, text, dialogTitle: title })
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
