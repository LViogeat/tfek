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
  // Ionic garde les pages précédentes dans le DOM (cachées) : on cible la page visible.
  // `ion-app` porte aussi la classe `ion-page` : d'où `ion-router-outlet >`
  const visible = (p, sel) => p.locator(`ion-router-outlet > .ion-page:not(.ion-page-hidden) ${sel}`)
  // Fin de la transition entre deux pages : une seule page visible
  const settled = (p) =>
    p.waitForFunction(() => document.querySelectorAll('ion-router-outlet > .ion-page:not(.ion-page-hidden)').length === 1)
  const button = (p, text) => p.locator('ion-button', { hasText: text })
  const titleInput = 'input[placeholder^="Anniversaire"]'

  // 1. Invité sans compte : se reconnaît dans la liste de l'organisateur (« c'est moi »)
  const g = await newPage()
  await g.goto(`${BASE}/e/anniv-camille`)
  await g.getByText('Tu viens ?').waitFor()
  await g.screenshot({ path: `${OUT}/1-event-invite.png`, fullPage: true })
  await g.getByRole('button', { name: /Oui/ }).click()
  await g.getByText('C’est toi ?').waitFor()
  check('invité : Alex, qui a déjà répondu, n’est pas proposé', (await g.locator('.name-chip', { hasText: 'Alex' }).count()) === 0)
  await g.locator('.name-chip', { hasText: 'Jordan' }).click()
  await g.screenshot({ path: `${OUT}/1b-cest-moi.png` })
  await g.getByRole('button', { name: /Envoyer ma réponse/ }).click()
  await g.getByText('C’est noté.', { exact: true }).waitFor()
  // La liste des invités se recharge juste après le message : on attend qu'elle contienne Jordan
  const listed = await visible(g, '.guests')
    .getByText('Jordan')
    .waitFor({ timeout: 5000 })
    .then(() => true, () => false)
  check('invité : réponse sans compte', listed)
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
  await button(o, 'Créer un évènement').click()
  await o.locator(titleInput).fill('Pétanque au parc')
  await o.locator('input[placeholder="Adresse ou nom du lieu"]').fill('Parc de la Tête d’Or')
  await button(o, 'Publier l’évènement').click()
  await o.getByText('Crée ton compte pour publier').waitFor()
  await button(o, 'orga@test.fr').click()
  await o.waitForURL(/\/e\/\w+\?created=1/, { timeout: 10000 })
  check('organisateur : publication après connexion', true, o.url())
  await o.getByPlaceholder('Changement d’heure, code de la porte, quoi ramener…').fill('RDV près du kiosque 🎯')
  await button(o, 'Publier et partager').click()
  await o.getByText('Prévenir les invités').waitFor()
  check('organisateur : annonce + feuille de partage', true)
  await sleep(400)
  await o.screenshot({ path: `${OUT}/4-partage-annonce.png` })

  // 3b. L'organisateur garde les réponses pour lui : un invité ne voit ni le nombre ni la liste
  const slug = new URL(o.url()).pathname.split('/')[2]
  await o.goto(`${BASE}/e/${slug}/edit`)
  await visible(o, titleInput).waitFor()
  await visible(o, 'ion-accordion ion-item').filter({ hasText: 'Options de confidentialité' }).click()
  await visible(o, 'ion-select.responses-select').click()
  await o.locator('ion-action-sheet button', { hasText: 'Toi seul' }).click()
  await sleep(300)
  await o.screenshot({ path: `${OUT}/4b-qui-voit-les-reponses.png`, fullPage: true })
  await button(o, 'Enregistrer').click()
  await o.getByText('Évènement mis à jour').waitFor({ timeout: 8000 })
  const p = await newPage()
  await p.goto(`${BASE}/e/${slug}`)
  await p.getByText('Tu viens ?').waitFor()
  const hidden = await p
    .getByText('Réponses privées', { exact: true })
    .waitFor({ timeout: 5000 })
    .then(() => true, () => false)
  check('organisateur : réponses privées', hidden && (await visible(p, '.counts').count()) === 0)

  // 3c. L'organisateur voit qui n'a pas encore répondu et ajoute des prénoms
  await o.goto(`${BASE}/e/anniv-camille`)
  const pendingTitle = visible(o, '.group-title').filter({ hasText: 'Pas encore répondu' })
  await pendingTitle.waitFor({ timeout: 8000 })
  check('organisateur : Inès n’a pas encore répondu', (await pendingTitle.innerText()).includes('· 1'))
  await visible(o, 'input[placeholder^="Ajouter des invités"]').fill('Léo, Mia et Inès')
  await visible(o, '.add-invitees ion-button').click()
  await o.getByText('2 ajoutés, les autres étaient déjà là').waitFor({ timeout: 5000 })
  check('organisateur : prénoms ajoutés sans doublon', (await pendingTitle.innerText()).includes('· 3'))
  await sleep(300)
  await o.screenshot({ path: `${OUT}/4c-pas-encore-repondu.png`, fullPage: true })

  // 4. Un invité inscrit ne peut pas ouvrir le formulaire d'édition
  const i = await newPage()
  await i.goto(`${BASE}/login`)
  await button(i, 'invite@test.fr').click()
  await i.waitForURL(`${BASE}/`)
  await i.goto(`${BASE}/e/anniv-camille/edit`)
  await i.waitForURL(`${BASE}/`, { timeout: 8000 })
  check('invité : édition refusée', true)

  // 4b. Amis : sans compte, le lien d'ami mène à la connexion ; Alex ajoute Camille par son lien
  const v = await newPage()
  await v.goto(`${BASE}/ami/camilleAmi23`)
  await v.getByRole('button', { name: /Ajouter en ami/ }).click()
  await v.waitForURL(/\/login\?redirect=/)
  check('amis : sans compte, le lien mène à la connexion', decodeURIComponent(v.url()).includes('/ami/camilleAmi23?add=1'))
  await i.goto(`${BASE}/ami/camilleAmi23`)
  await i.getByText('Camille', { exact: true }).waitFor()
  await i.screenshot({ path: `${OUT}/5a-lien-ami.png` })
  await i.getByRole('button', { name: /Ajouter en ami/ }).click()
  await i.getByText('Camille et toi êtes amis').waitFor({ timeout: 5000 })
  check('amis : ajout par le lien', true)

  // 4c. Camille invite Alex d'un appui à la pétanque : l'évènement arrive dans ses invitations
  await o.goto(`${BASE}/e/${slug}`)
  const chip = visible(o, '.friend-chip').filter({ hasText: 'Alex' })
  await chip.waitFor({ timeout: 8000 })
  await chip.click()
  await visible(o, '.guests li').filter({ hasText: 'Alex' }).waitFor({ timeout: 5000 })
  check('amis : l’organisateur invite un ami d’un appui', (await visible(o, '.friend-chip').count()) === 0)
  await o.screenshot({ path: `${OUT}/5b-ami-invite.png`, fullPage: true })
  await i.goto(`${BASE}/`)
  await i.getByText('Invitations (2)').waitFor({ timeout: 8000 })
  await visible(i, 'ion-segment-button').filter({ hasText: 'Invitations' }).click()
  const invited = visible(i, 'ion-item').filter({ hasText: 'Pétanque au parc' })
  await invited.waitFor({ timeout: 8000 })
  check('amis : invitation reçue « À répondre »', /à répondre/i.test(await invited.innerText()))
  await i.screenshot({ path: `${OUT}/5c-invitations-ami.png` })
  await i.goto(`${BASE}/amis`)
  await visible(i, '.people').getByText('Camille').waitFor({ timeout: 8000 })
  await i.screenshot({ path: `${OUT}/5d-amis.png`, fullPage: true })
  check('amis : Camille dans la liste d’Alex', true)

  // 4d. Changement d'heure : info publiée automatiquement, partage proposé au retour sur la page
  await o.goto(`${BASE}/e/${slug}`)
  await o.locator('ion-router-outlet > .ion-page:not(.ion-page-hidden)').getByRole('link', { name: 'Modifier', exact: true }).click()
  const startInput = visible(o, 'input[type=datetime-local]').first()
  await startInput.waitFor()
  const start = await startInput.inputValue()
  await startInput.fill(start.replace(/T\d\d:\d\d$/, 'T21:30'))
  await button(o, 'Enregistrer').click()
  await o.getByText('Prévenir les invités').waitFor({ timeout: 8000 })
  await sleep(400)
  await o.screenshot({ path: `${OUT}/6a-changement-partage.png` })
  await o.locator('ion-action-sheet button', { hasText: 'Annuler' }).click()
  const info = visible(o, '.announce')
  await info.getByText(/Nouvelle heure : .* à 21:30 \(au lieu de/).waitFor({ timeout: 5000 })
  check('changement : info « Nouvelle heure » publiée', (await info.innerText()).includes('CHANGEMENT'))

  // 4e. Relancer les « peut-être » : réponses privées sur cet évènement, donc message sans prénoms
  await p.goto(`${BASE}/e/${slug}`)
  await p.getByRole('button', { name: /Peut-être/ }).click()
  await p.locator('.name-chip', { hasText: 'Autre prénom' }).click()
  await p.locator('ion-input input').first().fill('Zoé')
  await p.getByRole('button', { name: /Envoyer ma réponse/ }).click()
  await p.getByText('C’est noté.', { exact: true }).waitFor()
  await o.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await o.reload()
  await button(o, 'Relancer').click()
  await o.locator('ion-action-sheet button', { hasText: 'Peut-être · 1' }).click()
  await o.locator('ion-action-sheet button', { hasText: 'Copier le message' }).click()
  await o.getByText('Message copié').waitFor({ timeout: 5000 })
  const copied = await o.evaluate(() => navigator.clipboard.readText())
  check('relance : « peut-être » sans prénoms quand les réponses sont privées', copied.includes('Si tu m’avais dit peut-être') && !copied.includes('Zoé'), copied.split('\n')[0])

  // 4f. Dupliquer : formulaire pré-rempli une semaine plus tard, invités repris (Alex, ami, reste invité)
  await o.locator('ion-router-outlet > .ion-page:not(.ion-page-hidden)').getByRole('link', { name: 'Modifier', exact: true }).click()
  await button(o, 'Dupliquer').click()
  await o.waitForURL(/\/new\?from=/)
  await settled(o)
  await visible(o, 'ion-toggle').filter({ hasText: 'Reprendre les invités (1)' }).waitFor({ timeout: 8000 })
  check('dupliquer : formulaire pré-rempli', (await visible(o, titleInput).inputValue()) === 'Pétanque au parc')
  await o.screenshot({ path: `${OUT}/6b-dupliquer.png`, fullPage: true })
  await button(o, 'Publier l’évènement').click()
  await o.waitForURL(/\/e\/\w+\?created=1/, { timeout: 10000 })
  await settled(o)
  check('dupliquer : nouvel évènement publié', !o.url().includes(slug))
  const copiedPending = visible(o, '.group-title').filter({ hasText: 'Pas encore répondu' })
  await copiedPending.waitFor({ timeout: 8000 })
  check('dupliquer : invités repris', (await copiedPending.innerText()).includes('· 1'))

  // 5. Brouillon abandonné : pré-rempli plus tard, mais jamais publié tout seul
  const d = await newPage()
  await d.goto(`${BASE}/new`)
  await d.locator(titleInput).fill('Brouillon abandonné')
  await button(d, 'Publier l’évènement').click()
  await d.getByText('Crée ton compte pour publier').waitFor()
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

  // 6. Retour de connexion dans deux onglets en même temps : un seul évènement publié
  //    (après la vérification des erreurs : la seconde insertion renvoie volontairement un 409)
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'] })
  const t1 = await ctx2.newPage()
  await t1.goto(`${BASE}/login`)
  await button(t1, 'orga@test.fr').click()
  await t1.waitForURL(`${BASE}/`)
  const title = `Double onglet ${Date.now()}`
  await t1.evaluate((title) => {
    const starts = new Date(Date.now() + 7 * 86400e3).toISOString()
    localStorage.setItem('tfek.draftEvent', JSON.stringify({
      title, description: null, starts_at: starts, ends_at: null, location: null, visibility: 'link',
      show_guest_list: true, show_counts: true, allow_plus_ones: true, theme: 'noir',
      publishAfterLogin: true, draftId: crypto.randomUUID(),
    }))
  }, title)
  const t2 = await ctx2.newPage()
  await Promise.all([t1.goto(`${BASE}/new?publish=1`), t2.goto(`${BASE}/new?publish=1`)])
  await Promise.all([t1.waitForURL(/\/e\/\w+\?created=1/), t2.waitForURL(/\/e\/\w+\?created=1/)])
  await t1.goto(`${BASE}/`)
  await sleep(1500)
  const copies = await t1.getByText(title).count()
  check('brouillon : publié une seule fois depuis deux onglets', copies === 1 && new URL(t1.url()).pathname === '/', `${copies} exemplaire(s)`)
  await browser.close()
  console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert. Captures : tests/e2e/shots/')
  process.exit(failures ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
