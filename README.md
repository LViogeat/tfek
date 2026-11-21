# tfek

Organise tes events comme sur Facebook à l’époque, mais depuis un simple lien à coller dans ta conversation WhatsApp ou Messenger.

- **Organisateur** : crée un event en 30 s, publie des infos importantes qui ne se noient pas dans la conversation, voit qui vient, relance.
- **Invités** : répondent **sans compte** (juste un prénom). Ils peuvent créer un compte plus tard pour retrouver leurs events ; leurs réponses sont alors rattachées automatiquement.

## Stack

- **Front** : [Ionic](https://ionicframework.com/) + Vue 3 + TypeScript (Vite), PWA ; [Capacitor](https://capacitorjs.com/) prêt pour iOS/Android.
- **Back** : [Supabase](https://supabase.com/) (Postgres, Auth, Row Level Security). Pas de serveur à maintenir.

## Démarrer en local

Prérequis : Node 20+, Docker.

```bash
npm install
cp .env.example .env.local
npm run db:start   # lance Supabase en local (Docker) avec le schéma et les données de test
npm run dev        # http://localhost:5173
```

Comptes de test (mot de passe `password`) : `orga@test.fr`, `invite@test.fr` — boutons de connexion rapide sur la page de connexion en mode dev.

Les e-mails (codes de connexion) n’envoient rien de réel : ils arrivent dans **Mailpit** → http://127.0.0.1:54324.
Studio Supabase (base de données) → http://127.0.0.1:54323.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev |
| `npm run build` | Vérification des types + build de production (`dist/`) |
| `npm test` | Tests d’intégration sur la base locale (nécessite `db:start`) |
| `npm run db:reset` | Réapplique les migrations et recharge `supabase/seed.sql` |
| `npm run db:types` | Régénère `src/lib/database.types.ts` depuis le schéma |

## Organisation du code

```
supabase/
  migrations/      schéma SQL, policies RLS et fonctions RPC
  seed.sql         données de test locales
  templates/       e-mails de connexion (code à 6 chiffres + lien)
src/
  lib/             client Supabase, auth (invités anonymes + fusion), accès aux données, partage
  views/           pages (accueil, event, création/édition, connexion, compte)
  components/      carte de réponse, liste des invités…
tests/             tests d’intégration de la base (règles d’accès, parcours invité → compte)
```

## Choix d’architecture

- **Accès par lien** : un event est visible par toute personne qui a son lien (slug aléatoire de 10 caractères), mais les events ne sont pas listables. La lecture publique passe par des fonctions RPC (`get_event`, `get_event_guests`, `get_event_announcements`) qui prennent le slug.
- **Invités sans compte** : à la première réponse, l’app ouvre une session **anonyme** Supabase. Rien à saisir à part le prénom.
- **Fusion invité → compte** : avant de se connecter, l’invité obtient un jeton à usage unique (`create_merge_token`) ; une fois connecté, `merge_anonymous_user` rattache ses réponses à son compte.
- **Création d’event** : réservée aux comptes inscrits. On laisse remplir le formulaire d’abord, le compte est demandé au moment de publier, puis l’event est publié automatiquement.
- **Notifications gratuites** : les annonces et relances se partagent depuis le téléphone de l’organisateur (WhatsApp, SMS, partage natif), dans la conversation existante.

## Prochaines étapes

- Aperçu riche du lien dans WhatsApp (balises Open Graph rendues côté serveur pour `/e/:slug`)
- Notifications push web pour les invités qui le souhaitent, e-mail pour les comptes
- Image de couverture (Supabase Storage)
- Connexion Google en production (provider à configurer, puis `VITE_ENABLE_GOOGLE=true`)
- Déploiement : projet Supabase cloud + hébergement statique (Vercel / Netlify)
- Events publics découvrables, puis events sponsorisés
