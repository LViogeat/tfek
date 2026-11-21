# CLAUDE.md — tfek

Contexte pour reprendre le projet dans une nouvelle session. À lire en entier avant de coder.

- **Vision, décisions produit et feuille de route** : [`docs/PRODUIT.md`](docs/PRODUIT.md) — lis-le, il explique *pourquoi* les choses sont comme elles sont.
- **Démarrage et scripts** : [`README.md`](README.md).

## En une phrase

App d'events « comme Facebook avant », partagée par un lien dans WhatsApp/Messenger. Les **invités répondent sans compte** ; l'**organisateur** a un compte (demandé au moment de publier).

## Règles à respecter

- **Ne jamais ajouter de friction pour les invités** (pas de compte, pas d'e-mail obligatoire, pas d'étape en plus). C'est le principe n°1 du produit.
- **UI en français, tutoiement**, ton simple et chaleureux. Les commentaires de code sont aussi en français.
- Pas de service payant sans en parler (SMS notamment) : les notifications passent par le partage depuis le téléphone de l'organisateur.
- Commits en français, sur la branche de travail indiquée par la session.

## Stack

- Front : **Ionic 8 + Vue 3 (Composition API, `<script setup>`) + TypeScript**, Vite 6, PWA (`vite-plugin-pwa`), **Capacitor 7** (`capacitor.config.ts`, pas encore de projets `ios/`/`android/`).
- Back : **Supabase** (Postgres + Auth + RLS). Pas de serveur applicatif.
- Le projet a été monté à la main (pas via `ionic start`, bloqué par le réseau) : c'est normal qu'il n'y ait pas `ionic.config.json`.

## Carte du code

```
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
  lib/draft.ts                         brouillon d'event (localStorage) pendant la connexion
  lib/format.ts                        dates en français
  views/                               HomePage, EventPage, EventFormPage, LoginPage, AccountPage
  components/                          RsvpCard, GuestList, EventListItem, RsvpBadge
tests/
  db.test.ts                           intégration sur la base locale (règles d'accès, fusion, slugs)
  ics.test.ts / format.test.ts         unitaires
  e2e/smoke.cjs                        parcours complets dans Chromium (iPhone simulé)
```

Routes : `/` accueil · `/new` création · `/e/:slug` event · `/e/:slug/edit` édition · `/login?redirect=…&reason=publish` · `/account`.

## Modèle de données et sécurité

Tables : `profiles` (créé par trigger pour chaque utilisateur, anonyme compris), `events`, `rsvps` (PK `event_id, user_id`), `announcements`, `merge_tokens`.

- **Accès par lien** : `events` n'est pas lisible publiquement. La lecture publique passe par des RPC `security definer` qui prennent le slug : `get_event` (détails + compteurs + `my_rsvp` + `is_organizer`), `get_event_guests` (respecte `show_guest_list`, jamais de `user_id` exposé), `get_event_announcements`.
- **Répondre** : uniquement via la RPC `rsvp(slug, status, display_name, plus_ones)`, qui exige une session (anonyme acceptée) et refuse les events annulés.
- **Créer un event** : policy `is_registered()` (session non anonyme). Modifier, supprimer ou publier une annonce : organisateur uniquement (`is_event_organizer`).
- **Lecture directe autorisée** : l'organisateur voit ses events et leurs réponses ; un utilisateur voit ses réponses et les events auxquels il a répondu (pour « Invitations »). ⚠️ Un invité peut donc *lire* la ligne d'un event auquel il a répondu : toute requête « réservée à l'organisateur » doit filtrer sur `organizer_id` (voir `getEventForEdit`).
- **Slugs** : `generate_slug()` sur 10 caractères, alphabet sans ambiguïté, tirage uniforme (rejet des octets biaisés).

### Parcours d'authentification

1. Un invité répond → `ensureGuestSession()` → `signInAnonymously()`.
2. Avant toute connexion (`sendEmailCode`, `signInWithPassword`, `signInWithGoogle`), `prepareGuestMerge()` crée un jeton de fusion s'il est anonyme (localStorage `tfek.mergeToken`).
3. Au `SIGNED_IN` d'un vrai compte, `mergePendingGuest()` appelle `merge_anonymous_user(token)`, puis incrémente `mergedVersion` : les pages qui le surveillent rechargent.
4. Création d'event sans compte : brouillon enregistré, puis `/login?redirect=/new?publish=1`. **Seul ce retour avec `publish=1` publie automatiquement**. Un brouillon abandonné ne fait que pré-remplir le formulaire.

## Pièges connus

- **Ionic garde les pages en cache dans le DOM** : utilise `onIonViewWillEnter` (pas seulement `onMounted`) pour recharger. Dans les tests, cible `.ion-page:not(.ion-page-hidden) …`.
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

- Comptes de test (mot de passe `password`) : `orga@test.fr` (Camille, organise `anniv-camille` et `rando-vercors`), `invite@test.fr` (Alex, a répondu à `anniv-camille`). Connexion en 1 clic sur `/login` en mode dev.
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
npm run db:reset && npm test        # 18 tests, base locale requise
npm run db:reset && npm run e2e     # serveur dev lancé ; captures dans tests/e2e/shots/
npm run build
```

`npm test` et `npm run e2e` modifient la base : fais un `db:reset` avant chaque e2e pour avoir des compteurs propres.

## État actuel

MVP v0.1 fonctionnel en local, non déployé. Prochaine étape proposée : aperçu riche du lien WhatsApp (Open Graph côté serveur), puis mise en ligne (Supabase cloud + Vercel). Détail et priorités dans [`docs/PRODUIT.md`](docs/PRODUIT.md#feuille-de-route).
