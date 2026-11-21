/**
 * Test de bout en bout dans un vrai navigateur (iPhone simulé).
 *
 * Prérequis : `npm run db:reset` (base propre + données de test) et `npm run dev` lancé.
 * Lancer : `npm run e2e`  — captures dans tests/e2e/shots/ (ignoré par git)
 *
 * Utilise Playwright ; s'il n'est pas installé : `npm i -D playwright && npx playwright install chromium`.
 * Variables : E2E_BASE (défaut http://localhost:5173), MAILPIT (défaut http://127.0.0.1:54324)
 */
const path = require('node:path')
const fs = require('node:fs')
const { chromium, devices } = require('playwright')

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173'
const MAILPIT = process.env.MAILPIT ?? 'http://127.0.0.1:54324'
const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/** Récupère le code à 6 chiffres reçu par `email` dans Mailpit. */
async function emailCode(email) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json()
    const m = list.messages.find((x) => x.To.some((t) => t.Address === email))
    if (m) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()
      return (full.Text.match(/\b(\d{6})\b/) || full.HTML.match(/>(\d{6})</))[1]
    }
    await sleep(500)
  }
  throw new Error(`Aucun e-mail reçu pour ${email}`)
}

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const newPage = async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    return page
  }
  // Ionic garde les pages précédentes dans le DOM (cachées) : on cible la page visible
  const visible = (p, sel) => p.locator(`.ion-page:not(.ion-page-hidden) ${sel}`)
  const button = (p, text) => p.locator('ion-button', { hasText: text })
  const titleInput = 'input[placeholder^="Anniversaire"]'

  // 1. Invité sans compte : répond avec son prénom
  const g = await newPage()
  await g.goto(`${BASE}/e/anniv-camille`)
  await g.getByText('Tu viens ?').waitFor()
  await g.screenshot({ path: `${OUT}/1-event-invite.png`, fullPage: true })
  await g.getByRole('button', { name: /Oui/ }).click()
  await g.locator('ion-input input').first().fill('Jordan')
  await g.getByRole('button', { name: /Envoyer ma réponse/ }).click()
  await g.getByText('C’est noté !', { exact: true }).waitFor()
  check('invité : réponse sans compte', (await g.getByText('Jordan').count()) > 0)
  await g.screenshot({ path: `${OUT}/2-apres-reponse.png`, fullPage: true })

  // 2. L'invité crée son compte avec le code e-mail → sa réponse est conservée
  await button(g, 'Créer mon compte').click()
  const email = `jordan${Date.now()}@test.fr`
  await g.locator('input[type=email]').fill(email)
  await g.getByRole('button', { name: 'Recevoir un code' }).click()
  await g.locator('input[autocomplete=one-time-code]').fill(await emailCode(email))
  await g.getByRole('button', { name: 'Valider' }).click()
  await g.waitForURL(/\/e\/anniv-camille/)
  const answer = visible(g, '.answer')
  await answer.waitFor({ timeout: 8000 })
  check('invité → compte : réponse rattachée', (await answer.innerText()).includes('Je viens'))
  await g.goto(`${BASE}/`)
  await g.getByText('Invitations (1)').waitFor({ timeout: 8000 })
  check('accueil : event dans « Invitations »', true)
  await g.screenshot({ path: `${OUT}/3-accueil-invitations.png` })

  // 3. Organisateur : remplit l'event, se connecte, l'event est publié automatiquement
  const o = await newPage()
  await o.goto(`${BASE}/`)
  await button(o, 'Créer un event').click()
  await o.locator(titleInput).fill('Pétanque au parc')
  await o.locator('input[placeholder="Adresse ou nom du lieu"]').fill('Parc de la Tête d’Or')
  await button(o, 'Publier l’event').click()
  await o.getByText('Dernière étape avant de publier').waitFor()
  await button(o, 'orga@test.fr').click()
  await o.waitForURL(/\/e\/\w+\?created=1/, { timeout: 10000 })
  check('organisateur : publication après connexion', true, o.url())
  await o.getByPlaceholder('Changement d’heure, code de la porte, quoi ramener…').fill('RDV près du kiosque 🎯')
  await button(o, 'Publier et partager').click()
  await o.getByText('Prévenir les invités').waitFor()
  check('organisateur : annonce + feuille de partage', true)
  await sleep(400)
  await o.screenshot({ path: `${OUT}/4-partage-annonce.png` })

  // 4. Un invité inscrit ne peut pas ouvrir le formulaire d'édition
  const i = await newPage()
  await i.goto(`${BASE}/login`)
  await button(i, 'invite@test.fr').click()
  await i.waitForURL(`${BASE}/`)
  await i.goto(`${BASE}/e/anniv-camille/edit`)
  await i.waitForURL(`${BASE}/`, { timeout: 8000 })
  check('invité : édition refusée', true)

  // 5. Brouillon abandonné : pré-rempli plus tard, mais jamais publié tout seul
  const d = await newPage()
  await d.goto(`${BASE}/new`)
  await d.locator(titleInput).fill('Brouillon abandonné')
  await button(d, 'Publier l’event').click()
  await d.getByText('Dernière étape avant de publier').waitFor()
  await d.goto(`${BASE}/login`)
  await button(d, 'orga@test.fr').click()
  await d.waitForURL(`${BASE}/`)
  await d.goto(`${BASE}/new`)
  await sleep(2000)
  check('brouillon : pré-rempli', (await visible(d, titleInput).inputValue()) === 'Brouillon abandonné')
  await d.goto(`${BASE}/`)
  await sleep(1500)
  check('brouillon : pas publié automatiquement', (await d.getByText('Brouillon abandonné').count()) === 0)

  check('aucune erreur JavaScript', errors.length === 0, errors.join(' | '))
  await browser.close()
  console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert. Captures : tests/e2e/shots/')
  process.exit(failures ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
