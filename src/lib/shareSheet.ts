import { actionSheetController, toastController } from '@ionic/vue'
import { canNativeShare, copyToClipboard, nativeShare, smsUrl, whatsappUrl } from './share'

/**
 * Ouvre une feuille de partage : WhatsApp, SMS, partage natif, copier.
 * Le message part du téléphone de l'organisateur : gratuit et dans la conversation existante.
 */
export async function openShareSheet(opts: { header: string; title: string; text: string; url: string }) {
  const full = opts.text.includes(opts.url) ? opts.text : `${opts.text}\n${opts.url}`
  const native = await canNativeShare()

  const sheet = await actionSheetController.create({
    header: opts.header,
    buttons: [
      { text: 'WhatsApp', handler: () => void window.open(whatsappUrl(full), '_blank') },
      { text: 'SMS', handler: () => void (window.location.href = smsUrl(full)) },
      ...(native
        ? [{ text: 'Autre application…', handler: () => void nativeShare(opts.title, opts.text, opts.url).catch(() => {}) }]
        : []),
      {
        text: 'Copier le message',
        handler: () => {
          void copyToClipboard(full).then(async (ok) => {
            const t = await toastController.create({
              message: ok ? 'Message copié' : 'Impossible de copier',
              duration: 2000,
              position: 'top',
            })
            await t.present()
          })
        },
      },
      { text: 'Annuler', role: 'cancel' },
    ],
  })
  await sheet.present()
}
