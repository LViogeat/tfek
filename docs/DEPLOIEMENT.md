# Mise en ligne de test (Supabase cloud + Vercel)

Objectif : tester tfek sur un vrai téléphone avec un lien stable, partageable. Tout est gratuit.

> ⚠️ **Après cette mise en ligne, ne plus modifier `supabase/migrations/20261121000000_init.sql`.**
> Tout changement de schéma passe par une nouvelle migration (`npx supabase migration new <nom>`).

## État au 21/11/2026

- `main` contient le design « billet chic » complet. Rien n'est encore déployé.
- Une première tentative « Claude fait tout par API » a échoué : le jeton enregistré pour
  `api.supabase.com` dans l'environnement cloud **Default** était refusé (401 « JWT could not be decoded »).
  Ce n'était pas un jeton d'accès personnel. **À supprimer ou remplacer** dans les réglages de
  l'environnement (secrets réseau) avant de réessayer.
- StackBlitz écarté : pas de base de données (Supabase local demande Docker) et l'aperçu
  n'est pas ouvrable depuis un autre appareil.

## Deux façons de faire

### A. Claude fait tout (le plus simple)

À demander dans une nouvelle session : « fais la mise en ligne de test, voir docs/DEPLOIEMENT.md ».

1. Créer un compte sur supabase.com, puis **Account → Access Tokens → Generate new token**.
   Le jeton commence par **`sbp_`** (ce n'est ni la clé `anon`/`publishable`, ni la `service_role`, ni un JWT `eyJ…`).
2. Créer un compte sur vercel.com (connexion avec GitHub), puis **Settings → Tokens → Create**.
3. Claude ouvre un formulaire sécurisé pour chaque jeton (`api.supabase.com`, puis `api.vercel.com`) :
   ne jamais les coller dans le chat.
4. Claude crée le projet Supabase (région Paris, `eu-west-3`), exécute le schéma, configure l'auth,
   crée le projet Vercel et déploie, puis vérifie le site.
5. Une fois fini, supprimer les jetons des réglages de l'environnement si on ne veut pas les garder.

Notes pour Claude :
- API de gestion Supabase : `POST /v1/projects` (création), `POST /v1/projects/{ref}/database/query`
  (exécuter `…_init.sql`, **sans** `seed.sql`), `PATCH /v1/projects/{ref}/config/auth` (voir la liste
  des réglages plus bas), `GET /v1/projects/{ref}/api-keys` (clé publishable).
- Le proxy injecte le jeton : ne pas envoyer d'en-tête `Authorization` soi-même.
- L'environnement par défaut n'a aucun hôte autorisé : enregistrer un jeton autorise aussi son hôte.
  Pour vérifier le site déployé (`*.vercel.app`, `<ref>.supabase.co`), il faudra peut-être
  autoriser ces hôtes (l'utilisateur a refusé la création d'un environnement dédié « tfek »).

### B. À la main depuis les sites (≈ 10 minutes, aucun jeton à donner)

**1. Supabase**

1. supabase.com → **New project** (région : Paris). Garder le mot de passe de la base quelque part.
2. **SQL Editor** → coller tout le contenu de `supabase/migrations/20261121000000_init.sql` → Run.
   (Ne pas exécuter `seed.sql` : ce sont des données de test locales.)
3. **Authentication → Sign In / Providers** :
   - activer **Allow anonymous sign-ins** (les invités répondent sans compte) ;
   - Email : activé, **Confirm email** désactivé, longueur du code (OTP) : **6**.
4. **Authentication → URL Configuration** :
   - Site URL : l'adresse Vercel (étape 2), par exemple `https://tfek.vercel.app` ;
   - Redirect URLs : `https://tfek.vercel.app/**`.
5. **Authentication → Emails → Templates** : pour **Magic link** et **Confirm signup**,
   sujet « Ton code de connexion tfek » et corps = contenu de `supabase/templates/magic_link.html`
   (et `confirmation.html`). Le code `{{ .Token }}` doit rester dans le modèle.
6. **Project Settings → API** : noter l'**URL du projet** et la **clé publishable** (`sb_publishable_…`).

**2. Vercel**

1. vercel.com → **Add New → Project** → importer le dépôt GitHub `LViogeat/tfek`.
2. Framework : **Vite** (détecté). Build : `npm run build`, dossier de sortie : `dist`.
3. Variables d'environnement :

   | Nom | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | URL du projet Supabase (`https://<ref>.supabase.co`) |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | clé publishable (`sb_publishable_…`) |
   | `VITE_PUBLIC_URL` | l'adresse Vercel, sans `/` final (ex. `https://tfek.vercel.app`) |

   Les fonctions de l'aperçu du lien (`api/`) lisent ces mêmes variables à l'exécution.

4. **Deploy**. Ensuite, chaque fusion dans `main` redéploie automatiquement.
5. Si l'adresse Vercel finale diffère de celle mise dans Supabase (étape 1.4), corriger la Site URL
   et les Redirect URLs, puis `VITE_PUBLIC_URL` et redéployer.

`vercel.json` (à la racine) renvoie toutes les routes vers `index.html` : sans lui, ouvrir directement
un lien `/e/<slug>` donnerait une 404. Il envoie aussi les robots des messageries (repérés à leur
user-agent) vers `/api/event-preview`, qui sert les balises Open Graph, et `/og/<slug>` vers
`/api/og`, qui dessine l'image du billet.

**Vérifier l'aperçu du lien** après déploiement :

```bash
curl -A "WhatsApp/2.23" https://tfek.vercel.app/e/<slug>
```

La réponse doit contenir `og:title` et `og:image` ; ouvrir l'adresse de `og:image` dans un navigateur
montre l'image. Le débogueur de partage de Facebook (developers.facebook.com/tools/debug) affiche
l'aperçu tel que Messenger le verra et permet de vider son cache.

**3. Sur le téléphone**

Ouvrir l'adresse Vercel. « Ajouter à l'écran d'accueil » l'installe comme une app (PWA).

## Limites connues de cette version de test

- **E-mails** : sans SMTP configuré, Supabase n'envoie les codes de connexion **qu'aux adresses des
  membres de l'organisation Supabase** (et environ 2 par heure). Toi tu peux te connecter et créer
  des events ; tes amis peuvent répondre (pas besoin de compte) mais pas créer de compte.
  Pour ouvrir à tous : brancher un SMTP gratuit (Resend ou Brevo) dans **Authentication → Emails → SMTP**.
- **Aperçu du lien** : les dates de l'aperçu sont à l'heure de Paris (les events n'ont pas de fuseau).
  WhatsApp garde un aperçu en cache par adresse : les messages partagés depuis l'app ajoutent
  `?r=<oui>-<peut-être>` au lien pour que les rappels montrent les réponses à jour.
- **Connexion Google** : désactivée (`VITE_ENABLE_GOOGLE=false`), à configurer plus tard si besoin.
