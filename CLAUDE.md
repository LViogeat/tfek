# CLAUDE.md — tfek

Contexte pour reprendre le projet dans une nouvelle session. À lire en entier avant de coder.

- **Vision, décisions produit et feuille de route** : [`docs/PRODUIT.md`](docs/PRODUIT.md) — lis-le, il explique *pourquoi* les choses sont comme elles sont.
- **Mise en ligne** : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).
- **Démarrage et scripts** : [`README.md`](README.md).

## En une phrase

App d'events « comme Facebook avant », partagée par un lien dans WhatsApp/Messenger. Les **invités répondent sans compte** ; l'**organisateur** a un compte (demandé au moment de publier).

## Règles à respecter

- **Ne jamais ajouter de friction pour les invités** (pas de compte, pas d'e-mail obligatoire, pas d'étape en plus). C'est le principe n°1 du produit.
- **On lit avant de répondre** : la réponse est dans une barre fixée en bas de la page d'event, jamais au-dessus de la description.
- **Dire « évènement » (avec accent grave), jamais « event » ni « événement »** dans l'interface et les messages (le code garde `event`).
- **Pas de phrases explicatives** : l'appli doit se comprendre seule. Des libellés courts, pas de texte d'aide sous les champs ni de paragraphes de présentation.
- **UI en français, tutoiement**, ton simple et sobre : **pas de point d'exclamation ni d'emoji dans l'interface** (ni dans les messages de partage). Le fun passe par le design. Les commentaires de code sont aussi en français.
- **Design « billet »** : voir `src/theme/variables.css` (tokens) et `src/lib/themes.ts` (6 palettes chic par event). Réutilise les classes `.disp`, `.mono`, `.lbl`, `.section-title` et les variables `--t-bg`, `--t-band`, `--t-stamp`, `--t-accent`, `--t-on-accent` plutôt que des couleurs en dur. Le tampon de marque est le composant `TfekStamp`.
- Pas de service payant sans en parler (SMS notamment) : les notifications passent par le partage depuis le téléphone de l'organisateur.
- Commits en français, sur la branche de travail indiquée par la session.

## Stack

- Front : **Ionic 8 + Vue 3 (Composition API, `<script setup>`) + TypeScript**, Vite 6, PWA (`vite-plugin-pwa`), **Capacitor 7** (`capacitor.config.ts`, pas encore de projets `ios/`/`android/`).
- Back : **Supabase** (Postgres + Auth + RLS). Pas de serveur applicatif, sauf deux fonctions Vercel pour l’aperçu du lien (`api/`).
- Le projet a été monté à la main (pas via `ionic start`, bloqué par le réseau) : c'est normal qu'il n'y ait pas `ionic.config.json`.

## Carte du code

```
api/                                   fonctions Vercel (edge) de l'aperçu du lien, routées par vercel.json
  event-preview.ts                     balises Open Graph de /e/:slug, servies aux seuls robots des messageries
  og.ts                                image du billet 1200 × 630 (/og/:slug?v=empreinte), via @vercel/og
  _lib/preview.ts                      logique pure : textes, empreinte, arbre d'éléments Satori, lecture REST
  _fonts/                              JetBrains Mono en .woff (Satori ne lit pas le woff2)
supabase/
  migrations/20261121000000_init.sql   TOUT le schéma : tables, RLS, fonctions RPC, droits
  seed.sql                             comptes + events de test (local uniquement)
  templates/                           e-mails de connexion FR (code {{ .Token }} + lien)
  config.toml                          anonymes activés, confirmations désactivées, URLs :5173
src/
  main.ts / App.vue / router/          entrée, IonRouterOutlet, routes
  lib/supabase.ts                      client typé
  lib/database.types.ts                GÉNÉRÉ (npm run db:types) — ne pas éditer à la main
  lib/auth.ts                          état de session, invité anonyme, connexion, fusion invité→compte
  lib/events.ts                        toutes les requêtes (RPC + tables) et les types métier
  lib/appUrl.ts                        origine publique (VITE_PUBLIC_URL, obligatoire en natif)
  lib/share.ts / shareSheet.ts         textes pré-rédigés + feuille WhatsApp / SMS / natif / copier
  lib/ics.ts                           export agenda (RFC 5545 ; partage de fichier en natif)
  lib/draft.ts                         brouillon d'event (localStorage) pendant la connexion, avec un draftId
  lib/redirect.ts                      safeRedirect : chemin de retour après connexion, limité à l'app
  lib/linkPreview.ts                   empreinte de l'aperçu, partagée entre l'app (?r=) et api/
  lib/themes.ts                        thèmes des billets (doit rester aligné avec la contrainte events.theme)
  lib/format.ts                        dates en français
  views/                               HomePage, EventPage, EventFormPage, LoginPage, AccountPage
  theme/variables.css                  thème sombre global, polices, tokens du style billet
  components/                          EventTicket (+ TfekStamp), RsvpBar (réponse fixée en bas, « C'est toi ? », + Confetti), GuestList (+ « Pas encore répondu »), EventListItem, RsvpBadge
tests/
  db.test.ts                           intégration sur la base locale (règles d'accès, fusion, slugs, aperçu)
  preview.test.ts                      unitaires de l'aperçu du lien et du lien partagé
  ics.test.ts / format.test.ts         unitaires
  e2e/smoke.cjs                        parcours complets dans Chromium (iPhone simulé)
```

Routes : `/` accueil · `/new` création · `/e/:slug` event · `/e/:slug/edit` édition · `/login?redirect=…&reason=publish` · `/account`.

## Modèle de données et sécurité

Tables : `profiles` (créé par trigger pour chaque utilisateur, anonyme compris), `events`, `rsvps` (PK `event_id, user_id`), `invitees`, `announcements`, `merge_tokens`.

- **Accès par lien** : `events` n'est pas lisible publiquement. La lecture publique passe par des RPC `security definer` qui prennent le slug : `get_event` (détails + compteurs + `my_rsvp` + `is_organizer`), `get_event_guests` (respecte `show_guest_list`, jamais de `user_id` exposé), `get_event_announcements`.
- **Répondre** : uniquement via la RPC `rsvp(slug, status, display_name, plus_ones, invitee_id)`, qui exige une session (anonyme acceptée) et refuse les events annulés.
- **Invités attendus** (`invitees`) : prénoms ajoutés par l'organisateur (`add_invitees`, sans doublon, insensible à la casse). En répondant, l'invité dit « c'est moi » (`invitee_id`, ou un prénom tapé identique) : `invitees.user_id` le retient, une personne = un prénom par évènement, un prénom pris ne peut plus l'être par un autre. `get_event_invitees` ne renvoie aux invités que les prénoms libres et le leur, sans réponse ; l'organisateur les reçoit tous avec leur réponse (`null` = pas encore répondu). Un prénom ajouté après coup est rattaché à celui qui a déjà répondu sous ce prénom, et la fusion invité → compte fait suivre le « c'est moi ».
- **Créer un event** : policy `is_registered()` (session non anonyme). Modifier, supprimer ou publier une annonce : organisateur uniquement (`is_event_organizer`).
- **Visibilité des réponses** : trois niveaux dans le formulaire (« Qui voit les réponses »), stockés dans `show_guest_list` et `show_counts` (contrainte : la liste implique le nombre). Sans `show_counts`, `get_event` renvoie `counts: null` aux invités. Le même réglage s'applique à l'aperçu du lien.
- **Lecture directe autorisée** : l'organisateur voit ses events et leurs réponses ; un utilisateur voit ses réponses et les events auxquels il a répondu (pour « Invitations »). ⚠️ Un invité peut donc *lire* la ligne d'un event auquel il a répondu : toute requête « réservée à l'organisateur » doit filtrer sur `organizer_id` (voir `getEventForEdit`).
- **Slugs** : `generate_slug()` sur 10 caractères, alphabet sans ambiguïté, tirage uniforme (rejet des octets biaisés).

### Parcours d'authentification

1. Un invité répond → `ensureGuestSession()` → `signInAnonymously()`.
2. Avant toute connexion (`sendEmailCode`, `signInWithPassword`, `signInWithGoogle`), `prepareGuestMerge()` crée un jeton de fusion s'il est anonyme (localStorage `tfek.mergeToken`).
3. Au `SIGNED_IN` d'un vrai compte, `mergePendingGuest()` appelle `merge_anonymous_user(token)`, puis incrémente `mergedVersion` : les pages qui le surveillent rechargent.
4. Création d'event sans compte : brouillon enregistré (avec un `draftId`), puis `/login?redirect=/new?publish=1`. **Seul ce retour avec `publish=1` publie automatiquement**. Un brouillon abandonné ne fait que pré-remplir le formulaire. La contrainte unique `(organizer_id, draft_id)` empêche de publier deux fois le même brouillon (lien de connexion ouvert dans un autre onglet) : `createEvent` renvoie alors l'évènement existant.
5. Fusion invité → compte : si les deux ont répondu au même évènement, la réponse la plus récente gagne.

## Aperçu du lien (Open Graph)

- Les robots (WhatsApp, facebookexternalhit, Twitterbot, TelegramBot…) n'exécutent pas le JS. `vercel.json` les reconnaît à leur user-agent et réécrit `/e/:slug` vers `/api/event-preview`. Les humains reçoivent l'app normale.
- L'URL de l'image contient une empreinte (`imageVersion`) : elle change quand le titre, la date, le thème ou les réponses changent. Les liens partagés ajoutent `?r=<même empreinte>` (`shareUrl`, calculée comme la voit un visiteur sans session) pour contourner le cache de WhatsApp par adresse.
- Les réponses ne s'affichent qu'à partir d'un « oui » (jamais « 0 viennent ») ; les prénoms seulement si la liste est publique.
- **Satori** (moteur de @vercel/og) : tout `div` à plusieurs enfants doit être en `display: flex` (le helper `h()` le fait), un enfant unique se passe sans tableau, et des lettres tournées loin de l'origine du canevas sont mal placées : le tampon est donc rendu dans sa propre image puis incrusté (`stampTree` + `renderOgImage`).
- `@vercel/og` est épinglé en **0.11.1** : la 1.0.x publiée référence un `hb.wasm` absent du paquet.
- En local, `vercel dev` n'est pas utilisé : la logique est testée par `tests/preview.test.ts` et `db.test.ts`. Pour voir l'image, rendre `renderOgImage` avec la version Node de @vercel/og (il faut définir `globalThis.require` et `__dirname` avant de l'importer en ESM).

## Pièges connus

- **Ionic garde les pages en cache dans le DOM** : utilise `onIonViewWillEnter` (pas seulement `onMounted`) pour recharger. Dans les tests, cible `.ion-page:not(.ion-page-hidden) …`.
- **Thème par page** : une variable CSS qui en référence une autre est résolue là où elle est déclarée. `themeStyle()` redéfinit donc aussi les variables Ionic (`--ion-background-color`, `--ion-color-primary`…) sur l'`ion-page`, pas seulement les `--t-*`.
- **Pas d'appel Supabase directement dans `onAuthStateChange`** (risque de blocage interne) : passe par `setTimeout`.
- **Chargements concurrents** : `HomePage` et `EventPage` utilisent un compteur `loadSeq` pour ignorer les réponses obsolètes. Garde ce schéma.
- Le helper `check()` de `events.ts` lève sur erreur ; `.single()` lève si 0 ligne (par exemple à cause de la RLS).
- Les erreurs dans les `handler` d'`alertController` sont avalées : mets-y toujours `try/catch` avec un toast.
- Les attributs `label` d'`ion-input` sont des propriétés, pas des attributs DOM : dans les tests, cible les `placeholder`.
- Après un changement de schéma : `npm run db:reset` puis `npm run db:types`.
- **Migrations** : rien n'est encore déployé, donc `…_init.sql` peut encore être modifié directement. **Dès le premier déploiement**, ne plus jamais le toucher : créer une nouvelle migration (`npx supabase migration new <nom>`).

## Dev local

```bash
npm install && cp .env.example .env.local
npm run db:start      # Supabase local (Docker)
npm run dev           # http://localhost:5173
```

- Comptes de test (mot de passe `password`) : `orga@test.fr` (Camille, organise `anniv-camille` et `rando-vercors`), `invite@test.fr` (Alex, a répondu à `anniv-camille`). Invités attendus d'`anniv-camille` : Alex (a répondu), Inès et Jordan. Connexion en 1 clic sur `/login` en mode dev.
- E-mails : Mailpit http://127.0.0.1:54324 · Base : Studio http://127.0.0.1:54323.

### Dans une session Claude Code cloud

Le démon Docker n'est pas lancé au démarrage du conteneur :

```bash
dockerd > /tmp/dockerd.log 2>&1 &     # puis attendre que `docker ps` réponde
npx supabase start
```

Le premier `supabase start` télécharge les images (quelques minutes). Si un `db reset` échoue avec « Cannot connect to the Docker daemon », relance `dockerd`. Playwright et Chromium sont préinstallés (`require('playwright')`) : **ne pas les réinstaller**.

## Vérifier avant de committer

```bash
npm run typecheck
npm run db:reset && npm test        # 52 tests, base locale requise
npm run db:reset && npm run e2e     # serveur dev lancé ; captures dans tests/e2e/shots/
npm run build
```

`npm test` et `npm run e2e` modifient la base : fais un `db:reset` avant chaque e2e pour avoir des compteurs propres.

## État actuel

MVP v0.1 fonctionnel en local, design « billet chic » terminé et fusionné dans `main`, **non déployé**.

- Aperçu riche du lien et réglage « Qui voit les réponses » codés (fonctions Vercel dans `api/`), à vérifier sur téléphone après la mise en ligne.
- **Prochaine étape : mise en ligne de test** pour essayer l'app sur téléphone. Tout est préparé dans [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) (deux options : Claude fait tout par API avec des jetons, ou pas-à-pas manuel ; `vercel.json` déjà en place). Une première tentative a échoué sur un mauvais jeton Supabase, voir le document.
- Ensuite : voir les priorités dans [`docs/PRODUIT.md`](docs/PRODUIT.md#feuille-de-route).
