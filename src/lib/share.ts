import { Share } from '@capacitor/share'
import { publicUrl } from './appUrl'

export function eventUrl(slug: string): string {
  return publicUrl(`/e/${slug}`)
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
