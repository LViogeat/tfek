# tfek — spécifications des prochains chantiers

Spécifications des chantiers décidés le 22/11/2026, dans l'ordre où on les fera. Le **pourquoi** est dans
[`PRODUIT.md`](PRODUIT.md), le fonctionnement actuel dans [`CLAUDE.md`](../CLAUDE.md).

Chaque chantier suit le même plan : objectif, parcours, interface, données et sécurité, cas limites, tests,
hors périmètre. Les libellés entre guillemets sont ceux de l'interface : ils respectent les règles de
`CLAUDE.md` (tutoiement, « évènement », pas de point d'exclamation ni d'emoji, pas de phrase explicative).

| # | Chantier | Taille | Dépend de |
|---|---|---|---|
| 1 | [Mise en ligne de test en France](#1-mise-en-ligne-de-test-en-france) | S | — |
| 2 | [Dupliquer un évènement](#2-dupliquer-un-évènement) | S | — |
| 3 | [Relancer les « peut-être »](#3-relancer-les--peut-être-) | S | — |
| 4 | [Prévenir quand l'heure ou le lieu change](#4-prévenir-quand-lheure-ou-le-lieu-change) | S | — |
| 5 | [Socle RGPD](#5-socle-rgpd) | M | 1 |
| 6 | [Co-organisateurs](#6-co-organisateurs) | M | — |
| 7 | [Notifications et rappel la veille](#7-notifications-et-rappel-la-veille) | L | 1, 4 |
| 8 | [Mur de discussion](#8-mur-de-discussion) | M | 7 (pour vivre) |
| 9 | [Qui ramène quoi](#9-qui-ramène-quoi) | M | — |
| 10 | [Sondage de date](#10-sondage-de-date) | L | 4 |
| 11 | [Migration vers un hébergeur français](#11-migration-vers-un-hébergeur-français) | L | tout le reste, avant le lancement public |

S : une session · M : une à deux sessions · L : plusieurs sessions.

## Règles communes

- **Migrations** : à partir de la mise en ligne (chantier 1), `…_init.sql` est figé. Chaque chantier ajoute sa
  migration (`npx supabase migration new <nom>`), puis `npm run db:types`.
- **Accès** : comme aujourd'hui, les tables ne sont pas lisibles publiquement. Lecture publique par RPC
  `security definer` qui prennent le slug, écritures sensibles par RPC. Jamais de `user_id` renvoyé aux invités.
- **Organisateur** : partout où une règle dit « organisateur », utiliser `is_event_organizer(event_id)`, qui
  inclura les co-organisateurs (chantier 6). Ne plus écrire `organizer_id = auth.uid()` dans du nouveau code.
- **Fusion invité → compte** : toute nouvelle table liée à un `user_id` doit être traitée dans
  `merge_anonymous_user` (les données de l'anonyme passent au compte) et dans `export_my_data` (chantier 5).
- **Principe n° 1** : lire et répondre restent sans compte. Un compte peut être demandé pour **écrire** (mur)
  ou **organiser**, au moment où la personne en a besoin, jamais avant.
- **Tests** : chaque chantier ajoute ses tests de règles d'accès dans `tests/db.test.ts` et un passage dans
  `tests/e2e/smoke.cjs`.

---

## 1. Mise en ligne de test en France

**Objectif** : essayer tfek sur de vrais téléphones, avec des données hébergées en France dès le départ.

Le pas-à-pas existe déjà dans [`DEPLOIEMENT.md`](DEPLOIEMENT.md). Ce chantier y ajoute :

- **Supabase** : région **Paris (`eu-west-3`)**, déjà prévue.
- **Vercel** : les fonctions de l'aperçu du lien (`api/event-preview.ts`, `api/og.ts`) tournent en Paris :
  `export const config = { runtime: 'edge', regions: ['cdg1'] }`. Les fichiers statiques passent par le CDN
  mondial de Vercel : ils ne contiennent aucune donnée personnelle.
- **E-mails** : SMTP **Brevo** (société française, offre gratuite) dans Supabase → Authentication → SMTP,
  plutôt que Resend. Les mêmes identifiants serviront aux notifications (chantier 7).
- **Domaine** : à choisir (par exemple `tfek.fr`). `VITE_PUBLIC_URL` et les URL de redirection de Supabase
  suivent.

**Vérifications sur téléphone** (iPhone et Android, à noter dans `DEPLOIEMENT.md`) :
- aperçu du lien dans WhatsApp, Messenger, iMessage ; mise à jour de l'aperçu après une réponse (`?r=`) ;
- réponse sans compte, puis création de compte avec le code e-mail, puis fusion ;
- partage WhatsApp et SMS depuis la feuille de partage ;
- installation de la PWA (« Ajouter à l'écran d'accueil ») ;
- lien d'ami ouvert depuis WhatsApp.

**Après** : `…_init.sql` ne bouge plus, voir les règles communes.

---

## 2. Dupliquer un évènement

**Objectif** : refaire un évènement récurrent (foot du jeudi, apéro du mois) en deux appuis.

**Parcours (organisateur)**
1. Sur la page de modification de l'évènement, bouton « Dupliquer », au-dessus de « Annuler l'évènement ».
   Il est aussi proposé pour un évènement annulé ou passé.
2. Le formulaire de création s'ouvre (`/new?from=<slug>`) pré-rempli : titre, description, lieu, couleur du
   billet, options de confidentialité, durée.
3. **Date** : même jour de la semaine et même heure, une semaine plus tard. Si cette date est déjà passée,
   on avance de semaine en semaine jusqu'à la prochaine date future.
4. Interrupteur « Reprendre les invités (N) », activé par défaut s'il y a des invités attendus.
5. « Publier l'évènement » : comportement habituel (nouveau `draftId`, page de l'évènement avec
   `?created=1` et l'invitation à partager).

**Ce qui n'est pas repris** : réponses, infos, messages du mur, liste « qui ramène quoi » (proposée plus tard),
sondage de date, co-organisateurs (à rajouter, pour ne pas imposer un rôle sans le demander).

**Données et sécurité**
- Aucune table nouvelle.
- RPC `copy_invitees(p_from text, p_to text) returns int` : organisateur des **deux** évènements. Copie les
  prénoms. Un prénom rattaché à un **ami** de l'organisateur reste rattaché à cet ami (l'évènement apparaît
  dans ses invitations, comme `invite_friends`). Un prénom rattaché à quelqu'un d'autre (invité anonyme, compte
  non ami) est copié **sans** rattachement.
- Pré-remplissage : le formulaire lit l'évènement source avec `getEventForEdit` (qui vérifie l'organisateur).

**Cas limites**
- Source introuvable ou pas organisateur : formulaire vide, sans message.
- Brouillon déjà présent en `localStorage` : `?from=` l'emporte, le brouillon n'est pas effacé.
- Sans compte : impossible (seul un organisateur voit le bouton).

**Tests** : `copy_invitees` (ami rattaché, anonyme non rattaché, refus si pas organisateur des deux) ; unitaire
du calcul de la date ; e2e « dupliquer → publier → invités repris ».

**Hors périmètre** : récurrence automatique (« tous les jeudis »).

---

## 3. Relancer les « peut-être »

**Objectif** : obtenir une réponse ferme de ceux qui ont dit « peut-être », sans relancer tout le groupe.

**Parcours (organisateur)**
1. Le bouton « Relancer ceux qui n'ont pas répondu » devient « Relancer ».
2. Il ouvre une feuille avec les choix qui ont du sens :
   - « Pas encore répondu · N » (seulement si des invités attendus n'ont pas répondu, sinon le choix générique
     « Ceux qui n'ont pas répondu ») ;
   - « Peut-être · N » (seulement si N > 0).
   S'il n'y a qu'un choix, la feuille de partage s'ouvre directement.
3. La feuille de partage (WhatsApp, SMS…) s'ouvre avec le message pré-rédigé.

**Messages** (`share.ts`)
- 1 prénom : « Petit rappel pour « T ». Alex, tu m'avais dit peut-être. Tu viens ? Réponds ici : URL »
- 2 à 8 prénoms : « Petit rappel pour « T ». Alex et Inès, vous m'aviez dit peut-être. Vous venez ?
  Répondez ici : URL »
- Plus de 8, ou sans prénoms : « Petit rappel pour « T ». Si tu m'avais dit peut-être, tu viens ?
  Réponds ici : URL »

**Confidentialité** : quand les réponses ne sont visibles que par l'organisateur (`show_guest_list = false`),
citer des prénoms dans le groupe révélerait leur réponse. Les messages sont alors **sans prénoms**, aussi bien
pour « peut-être » que pour « pas encore répondu » (correction du comportement actuel).

**Données** : aucune. Les prénoms viennent de `get_event_guests` (statut `maybe`), toujours accessible à
l'organisateur.

**Tests** : unitaires des messages (singulier, pluriel, plus de 8, mode privé) ; e2e du choix « Peut-être ».

---

## 4. Prévenir quand l'heure ou le lieu change

**Objectif** : qu'aucun invité ne rate un changement. C'est le premier manque face à Facebook.

**Parcours (organisateur)**
1. Il modifie la date, l'heure de début ou de fin, ou le lieu, puis « Enregistrer ».
2. Une **info est publiée automatiquement** sur la page de l'évènement, par exemple :
   - « Nouvelle heure : samedi 6 décembre à 21:00 (au lieu de 20:00) »
   - « Nouvelle date : samedi 13 décembre à 20:00 (au lieu du samedi 6 décembre) »
   - « Nouveau lieu : Bar du Marché, Lyon (au lieu de Chez moi) »
   Plusieurs changements à la fois → une seule info, une ligne par changement.
3. Retour sur la page de l'évènement, et la feuille de partage « Prévenir les invités » s'ouvre avec le texte
   de l'info (même message que « Publier et partager »). L'organisateur peut la fermer.
4. **Annulation** : même mécanisme, info « Évènement annulé » et feuille de partage.

Les changements de titre, de description ou de couleur ne publient rien.

**Côté invité** : l'info apparaît en tête de page (« Info de Camille · à l'instant ») et l'aperçu du lien
change déjà avec la date (empreinte de l'image).

**Données et sécurité**
- `announcements.kind text not null default 'message' check (kind in ('message', 'change', 'cancel'))`.
  Une info `change` ou `cancel` porte une étiquette « Changement » ou « Annulation » sur la page. Le chantier 7
  s'en sert pour notifier.
- Publication côté client après `updateEvent` (comparaison de l'ancien et du nouvel évènement), par le même
  `postAnnouncement` avec `kind`. Pas de trigger : l'organisateur doit pouvoir supprimer l'info comme les autres.
- Textes générés dans `format.ts` (`changeSummary(before, after)`), testés en unitaire.

**Cas limites**
- Dates sans changement réel (même instant, autre saisie) : rien n'est publié.
- Fin ajoutée ou retirée seule : « Fin : 23:00 » ou « Plus d'heure de fin ».
- Évènement passé : pas d'info automatique.

**Tests** : unitaires de `changeSummary` ; db : `kind` contraint, lecture publique inchangée ; e2e
« changer l'heure → info visible pour un invité ».

---

## 5. Socle RGPD

**Objectif** : pouvoir dire « conforme au RGPD » sans réserve avant d'ouvrir au public. La suppression de
compte est obligatoire et manque aujourd'hui.

### 5.1 Supprimer son compte
- Page « Mon compte » : bouton « Supprimer mon compte », en bas, discret.
- Confirmation en deux temps (`alertController`) : « Supprimer ton compte ? » puis, s'il organise des
  évènements à venir : « Tes N évènements à venir seront supprimés. » avec « Supprimer » en rouge.
- RPC `delete_my_account()` (`security definer`) : supprime la ligne `auth.users`. Les cascades effacent profil,
  évènements organisés (et leurs réponses, infos, messages, listes), réponses, amitiés. Les prénoms de la liste
  « c'est moi » sont libérés (`on delete set null`).
- Avec des co-organisateurs (chantier 6) : un évènement dont il est le créateur **passe au plus ancien
  co-organisateur** au lieu d'être supprimé.
- Le client se déconnecte et revient à l'accueil.

### 5.2 Effacer ses réponses sans compte
- Accueil, bloc « Tes réponses sur cet appareil » : lien « Effacer » → même confirmation → `delete_my_account()`
  fonctionne aussi pour une session anonyme. Rien n'est demandé de plus à l'invité.

### 5.3 Télécharger ses données
- « Mon compte » : « Télécharger mes données » → RPC `export_my_data() returns jsonb` (profil, évènements
  organisés, réponses, prénoms « c'est moi », amis, infos, messages, objets pris, votes) → fichier
  `tfek-mes-donnees.json` (même mécanisme que l'export `.ics`).

### 5.4 Durées de conservation
Tâche `pg_cron` quotidienne (extension disponible sur Supabase et en auto-hébergement) :

| Donnée | Durée | Action |
|---|---|---|
| Évènement (avec réponses, infos, messages, listes, votes) | 24 mois après sa date | supprimé |
| Compte anonyme | 6 mois après la date du dernier évènement auquel il a répondu (ou 30 jours sans aucune réponse) | supprimé |
| Compte inscrit inactif | 3 ans sans connexion | e-mail d'avertissement (chantier 7), puis suppression 30 jours après |
| Jetons de fusion | expirés | supprimés (déjà 1 jour) |
| Abonnements push | refusés par le navigateur (410) | supprimés à l'envoi |

Durées à valider par le porteur du projet. Elles sont inscrites dans la politique de confidentialité.

### 5.5 Pages légales
- Routes `/confidentialite` et `/mentions-legales`, pages statiques dans l'app, au style de l'app.
- Liens en pied de page : page d'évènement (à côté de « Crée ton évènement avec tfek »), connexion, compte.
- **Politique de confidentialité** : responsable du traitement, données collectées (prénom, e-mail pour les
  comptes, réponses, messages, abonnements push), finalités, base légale (exécution du service), durées
  (5.4), sous-traitants et lieux (Supabase sur AWS Paris, Vercel, Brevo), droits (accès, rectification,
  effacement, portabilité, opposition), contact, réclamation auprès de la CNIL.
- **Mentions légales** : éditeur, directeur de la publication, hébergeur.
- Les informations sur l'éditeur sont à fournir par le porteur du projet (voir « Questions ouvertes »).

### 5.6 Le reste
- **Registre des traitements** : `docs/RGPD.md`, tenu à jour à chaque chantier.
- **Cookies** : la session est dans `localStorage` et sert au fonctionnement : pas de bandeau. Toute mesure
  d'audience future devra être sans cookie et hébergée en Europe.
- **Sous-traitants** : accepter les contrats de traitement (DPA) de Supabase, Vercel et Brevo.

**Tests** : db (`delete_my_account` pour un anonyme et un compte, cascades, transfert à un co-organisateur ;
`export_my_data` ne renvoie que ses propres données ; tâche de conservation sur des dates simulées) ; e2e
« supprimer mon compte ».

---

## 6. Co-organisateurs

**Objectif** : organiser à plusieurs (EVJF, sortie entre amis), avec les mêmes outils pour tous.

**Rôles**
- **Créateur** (`events.organizer_id`, inchangé) : tout, y compris supprimer l'évènement et gérer les
  co-organisateurs.
- **Co-organisateur** : comme le créateur (modifier, annuler, dupliquer, infos, invités, amis, relances, voir
  toutes les réponses), sauf supprimer l'évènement et gérer les co-organisateurs. Il peut se retirer lui-même.

**Parcours**
1. Page de l'évènement, outils de l'organisateur : section « Co-organisateurs » avec les pastilles de ses
   **amis** (même composant que l'invitation d'amis). Un appui → co-organisateur.
2. Le co-organisateur voit l'évènement dans « Organisés » sur l'accueil.
3. Billet et page : « Organisé par Camille et Alex » (au-delà de deux : « Camille, Alex et Inès »).
4. Retirer : croix à côté du nom (créateur) ; « Ne plus co-organiser » pour le co-organisateur.

Seuls des amis peuvent être ajoutés : ce sont des comptes, et l'amitié vaut accord pour ce lien de confiance.
Un lien d'invitation à co-organiser pourra venir plus tard.

**Données et sécurité**
- Table `event_cohosts (event_id, user_id, created_at, primary key (event_id, user_id))`, RLS lecture pour
  les organisateurs de l'évènement et la personne elle-même, écritures par RPC.
- `is_event_organizer(event_id)` inclut les co-organisateurs. **Audit obligatoire** de tout ce qui teste
  aujourd'hui `organizer_id = auth.uid()` :
  - policies `events` (update ; delete reste réservé au créateur), `rsvps` « l'organisateur voit » ;
  - `get_event` (`is_organizer`, compteurs ; ajout de `is_owner` et de `organizer_names`), `get_event_guests`,
    `get_event_invitees`, `add_invitees`, `get_invitable_friends`, `invite_friends`, `friend_suggestions`
    (les co-organisateurs se croisent) ;
  - client : `getEventForEdit` (filtre `organizer_id` à remplacer par une RPC `can_edit_event`),
    `listOrganized` (ajouter les évènements co-organisés).
- RPC `add_cohost(p_slug, p_user)` (créateur, ami requis), `remove_cohost(p_slug, p_user)` (créateur, ou
  soi-même).
- Fusion : sans objet (comptes seulement). Suppression de compte : transfert (5.1).

**Cas limites**
- Un co-organisateur avait répondu avant : sa réponse reste mais la barre de réponse disparaît (comme pour
  l'organisateur).
- Un co-organisateur qui n'est plus ami reste co-organisateur. L'amitié ne compte qu'à l'ajout.

**Tests** : db (chaque RPC et policy auditée, pour un co-organisateur et pour un autre compte) ; e2e « ajouter
un co-organisateur → il modifie l'évènement ».

---

## 7. Notifications et rappel la veille

**Objectif** : prévenir les invités sans dépendre de l'organisateur : rappel la veille, changements, infos.
C'est le second manque face à Facebook.

**Canaux** (gratuits ; rien par SMS)
- **E-mail** pour les comptes, via l'API transactionnelle **Brevo** (offre gratuite : environ 300 e-mails par
  jour, à surveiller).
- **Push web** pour tous, invités sans compte compris, après accord du navigateur. Fonctionne sur Android et
  ordinateur dans le navigateur ; **sur iPhone, seulement si l'app est ajoutée à l'écran d'accueil**
  (iOS 16.4 et plus). Les invités venus de WhatsApp sur iPhone ne seront donc souvent pas joignables : le
  partage par l'organisateur reste le filet.

**Consentement**
- Push : l'invité choisit. Après une réponse « Oui » ou « Peut-être », le bloc « C'est noté » propose
  « Me prévenir » à côté de « Créer mon compte ». Un appui → demande d'autorisation du navigateur.
- E-mail : activé par défaut pour les comptes, pour les évènements où ils ont répondu oui ou peut-être et ceux
  qu'ils organisent (service attendu). Réglage « E-mails » sur « Mon compte », lien de désinscription en un
  clic dans chaque e-mail.
- Par évènement : « Ne plus être prévenu » sur la page (coupe push et e-mail pour cet évènement).

**Ce qui est envoyé**

| Évènement | Destinataires | Quand |
|---|---|---|
| Rappel | oui + peut-être | la veille à 18:00, heure de l'évènement (pas d'envoi si créé moins de 24 h avant) |
| Changement d'heure, de date ou de lieu (info `change`) | oui + peut-être + invités attendus rattachés à un compte | tout de suite |
| Annulation (info `cancel`) | oui + peut-être + invités attendus rattachés à un compte | tout de suite |
| Nouvelle info (info `message`) | oui + peut-être | tout de suite, si « Prévenir les invités » est coché à la publication (coché par défaut) |
| Invitation d'un ami (chantier « amis ») | l'ami invité | tout de suite |
| Nouveaux messages du mur (chantier 8) | voir 8 | regroupés |
| Résumé des réponses | organisateurs | une fois par jour s'il y a du nouveau, désactivable |

Textes sobres, par exemple : « Demain : Anniversaire de Camille, 20:00, Chez moi, Lyon » ; « Nouvelle heure
pour « Anniversaire de Camille » : 21:00 ». Chaque notification ouvre la page de l'évènement.

**Données et sécurité**
- `push_subscriptions (id, user_id, endpoint unique, p256dh, auth, created_at)` : écriture par RPC pour
  soi-même, jamais lisible par d'autres.
- `profiles.email_notifications boolean not null default true`.
- `event_mutes (event_id, user_id, primary key)`.
- `notification_log (event_id, user_id, kind, ref, sent_at, unique (event_id, user_id, kind, ref))` : un même
  envoi ne part jamais deux fois.
- `events.timezone text not null default 'Europe/Paris'` : règle aussi l'heure de l'aperçu du lien (limite
  connue de `DEPLOIEMENT.md`).
- **Envoi** : une fonction Supabase Edge `notify` (clés VAPID et clé Brevo en secrets) ; un trigger sur
  `announcements` l'appelle par `pg_net` ; `pg_cron` l'appelle toutes les 10 minutes pour les rappels et les
  résumés.
- **Service worker** : `vite-plugin-pwa` passe en stratégie `injectManifest` pour ajouter la réception des
  push et le clic.
- Fusion : abonnements push, préférences et silences passent au compte.

**Cas limites**
- Abonnement expiré (réponse 410) : supprimé.
- Évènement annulé : plus de rappel.
- Plusieurs appareils : un push par appareil, un seul e-mail.

**Tests** : db (destinataires calculés pour chaque type, silences, journal anti-doublon) ; unitaires des
textes ; fonction `notify` testée avec un faux Brevo et un faux service push ; e2e : abonnement push dans
Chromium.

**Hors périmètre** : SMS, notifications natives iOS/Android (viendront avec les builds Capacitor).

---

## 8. Mur de discussion

**Objectif** : un fil par évènement pour échanger, sans remplacer le groupe WhatsApp. **Lire est libre,
écrire demande un compte** : chaque message a un auteur identifiable, ce qui rend la modération possible.

**Parcours**
- **Lire** : section « Discussion » sur la page de l'évènement, après « Qui vient ». Les 3 derniers messages,
  puis « Voir les N messages ». Ordre chronologique, sans fil de réponses.
- **Écrire (compte)** : champ « Écrire un message » et bouton d'envoi. 1 000 caractères au plus, texte seul.
- **Écrire (sans compte)** : un appui sur le champ affiche « Crée ton compte pour écrire » → connexion avec
  retour sur l'évènement. Le texte déjà tapé est gardé (`sessionStorage`) et remis dans le champ au retour,
  sans envoi automatique.
- **Supprimer** : l'auteur ses messages ; les organisateurs tous les messages. « Message supprimé » reste
  affiché à la place, pour garder le fil lisible.
- **Signaler** : sur le message de quelqu'un d'autre, « Signaler » → raison courte facultative → « Merci,
  c'est noté ». Obligation européenne (DSA) dès que l'app est ouverte au public.

**Interface** : prénom de l'auteur, marque « organisateur » ou « ami », heure relative. Pas de photo, pas de
réaction en v1.

**Réglages** : dans le formulaire, interrupteur « Discussion » (activé par défaut). Désactivé : section
masquée, messages conservés. Évènement annulé : lecture seule.

**Visibilité** : le mur est lisible par toute personne qui a le lien, quel que soit le réglage « Qui voit les
réponses ». Écrire est un acte public de l'auteur, qui voit son prénom à côté du champ.

**Notifications** (chantier 7) : organisateurs, au plus un envoi par heure et par évènement (« 3 nouveaux
messages ») ; participants qui ont déjà écrit dans le fil, même rythme ; les autres ne sont pas prévenus.

**Données et sécurité**
- `messages (id, event_id, author_id, body check 1..1000, created_at, deleted_at, deleted_by)`.
- `message_reports (id, message_id, reporter_id, reason, created_at, unique (message_id, reporter_id))`.
- `events.allow_messages boolean not null default true`.
- RPC `get_event_messages(p_slug, p_before timestamptz default null, p_limit int default 30)` → prénom, marques,
  `is_mine`, `can_delete`, sans `user_id` ; `post_message(p_slug, p_body)` (compte inscrit, évènement non
  annulé, mur activé) ; `delete_message(p_id)` ; `report_message(p_id, p_reason)`.
- Limite : 10 messages par minute et par compte (vérifiée dans `post_message`).
- Signalements : un e-mail à l'adresse de modération (secret de `notify`). La suppression se fait d'abord à la
  main dans Studio ; une petite page d'administration viendra si le volume l'exige.
- Suppression de compte : ses messages sont supprimés (cascade). Export : inclus.

**Tests** : db (anonyme ne peut pas écrire, organisateur supprime tout, auteur seulement les siens, limite de
débit, mur désactivé, évènement annulé, aucun `user_id` exposé) ; e2e « invité → Crée ton compte pour écrire →
retour avec le texte → envoi ».

**Hors périmètre** : photos, réactions, réponses en fil, messages privés.

---

## 9. Qui ramène quoi

**Objectif** : la liste « j'apporte les chips » de toute soirée entre amis, sans tableau partagé.

**Parcours**
- **Organisateur** : section « À ramener », champ « Ajouter » qui accepte une liste (« Chips, boissons x2,
  glaçons »). `x2` (ou `×2`) donne une quantité de 2.
- **Invité** : chaque ligne affiche « Je prends ». Un appui :
  - s'il a répondu « Oui » ou « Peut-être » : c'est pris, sous son prénom de réponse ;
  - sinon : la barre de réponse s'ouvre sur « Oui » ; l'objet est pris après « Envoyer ma réponse ».
  Un nouvel appui : « Je ne prends plus ».
- **Invité** : « J'apporte autre chose » ajoute une ligne déjà prise par lui.
- Affichage : « Chips · Alex », « Boissons · 1/2 · Inès », « Glaçons » (libre).

**Confidentialité** : réponses privées → les invités voient « Pris » sans prénom ; les organisateurs voient
les prénoms.

**Données et sécurité**
- `items (id, event_id, label check 1..80, quantity int default 1 check 1..20, created_by, position, created_at)`.
- `item_claims (item_id, user_id, created_at, primary key (item_id, user_id))`.
- RPC `get_event_items(p_slug)`, `add_items(p_slug, p_labels text[])` (organisateur), `bring_item(p_slug,
  p_label)` (invité avec réponse oui/peut-être : crée et prend), `claim_item(p_id)` / `unclaim_item(p_id)`
  (session anonyme acceptée, réponse oui/peut-être exigée, quantité respectée), `delete_item(p_id)`
  (organisateur, ou créateur si personne d'autre ne l'a pris).
- Réponse passée à « Non » : ses objets sont libérés (dans `rsvp`).
- Fusion invité → compte : `item_claims` et `items.created_by` suivent. Dupliquer (chantier 2) : interrupteur
  « Reprendre la liste à ramener », sans les prises.

**Tests** : db (quantité, réponse requise, libération au « Non », confidentialité des prénoms, fusion) ;
unitaire du découpage « x2 » ; e2e « je prends → visible chez l'organisateur ».

---

## 10. Sondage de date

**Objectif** : trouver la date qui arrange le plus de monde, avant de lancer les réponses.

**Parcours (organisateur)**
1. Dans le formulaire, sous la date : « Proposer plusieurs dates ». On ajoute de 2 à 6 créneaux (date et heure).
2. L'évènement est publié **en sondage** : billet avec « DATE À CHOISIR » et le nombre de dates proposées.
3. Il voit pour chaque date le nombre de disponibles et leurs prénoms, et un bouton « Choisir cette date ».
4. « Choisir cette date » → la date est fixée, le sondage se ferme, une info « Date choisie : samedi 6 décembre
   à 20:00 » est publiée (`kind = 'change'`, donc partage proposé et notification au chantier 7).

**Parcours (invité)**
- Pendant le sondage, la barre du bas devient « Tes disponibilités » : les dates à cocher, le même « C'est
  toi ? » pour le prénom, « Envoyer ». Sans compte, comme une réponse.
- Une fois la date choisie, la barre redevient « Tu viens ? ». Ceux qui étaient disponibles ce jour-là ne sont
  pas inscrits d'office : être disponible n'est pas venir.

**Ce qui change ailleurs pendant le sondage** : pas d'ajout à l'agenda, pas de rappel, aperçu du lien « Date à
choisir », tri provisoire sur la première date proposée.

**Données et sécurité**
- `events.date_poll_open boolean not null default false` ; `starts_at` reste obligatoire et vaut la première
  date proposée tant que le sondage est ouvert (rien d'autre ne casse).
- `date_options (id, event_id, starts_at, ends_at, position)` ;
  `date_votes (event_id, user_id, display_name, option_ids uuid[], updated_at, primary key (event_id, user_id))`.
- RPC `vote_dates(p_slug, p_option_ids, p_display_name, p_invitee_id)` (anonyme accepté, comme `rsvp`) ;
  `get_date_poll(p_slug)` (nombre par date ; prénoms selon `show_guest_list`, toujours pour les
  organisateurs) ; `choose_date(p_slug, p_option_id)` (organisateur).
- Réponse « Oui/Peut-être/Non » refusée tant que le sondage est ouvert.
- Fusion : `date_votes` suit. Dupliquer : le sondage n'est pas repris.

**Tests** : db (vote anonyme, confidentialité, choix réservé aux organisateurs, réponses refusées pendant le
sondage) ; e2e « proposer 3 dates → 2 votes → choisir → info publiée ».

**Hors périmètre** : « si besoin » (troisième niveau de disponibilité), créneaux sur plusieurs jours.

---

## 11. Migration vers un hébergeur français

**Objectif** : pouvoir écrire « hébergé en France, par une société française » sans réserve. Supabase et
Vercel hébergent à Paris mais sont des sociétés américaines (soumises au Cloud Act). À faire **avant le
lancement public**.

**Cible** (à choisir après comparaison des offres) : Scaleway, OVHcloud ou Clever Cloud.

| Brique | Aujourd'hui | Demain |
|---|---|---|
| Base + Auth + API | Supabase cloud (Paris) | Supabase **auto-hébergé** (Docker : Postgres, GoTrue, PostgREST, Kong) sur une machine française, ou Postgres managé + ces services |
| Fichiers (couvertures plus tard) | — | stockage objet du même hébergeur |
| App (fichiers statiques) | Vercel | stockage objet + CDN de l'hébergeur, ou petit serveur |
| Aperçu du lien (`api/`) | fonctions Vercel | petit serveur Node (par exemple Hono) : même code de `api/_lib/preview.ts`, `@vercel/og` remplacé par Satori + resvg |
| Notifications | fonction Supabase Edge | même code en tâche du serveur |
| E-mails | Brevo | Brevo |

**Étapes**
1. Environnement de préproduction complet chez l'hébergeur, déploiement scripté.
2. Sauvegardes quotidiennes (`pg_dump` chiffré vers le stockage objet, 30 jours) et restauration testée.
3. Supervision minimale (disponibilité, erreurs, espace disque).
4. Bascule : gel des écritures quelques minutes, `pg_dump`/`pg_restore` (schémas `public` **et** `auth`,
   pour garder comptes et sessions), changement DNS, vérifications du chantier 1.
5. Mise à jour des mentions légales et de la politique de confidentialité (hébergeur, sous-traitants).

**Coût** : quelques dizaines d'euros par mois, à chiffrer sur devis. C'est le premier coût fixe du projet, à
valider avec le porteur.

---

## Questions ouvertes (porteur du projet)

1. **Mentions légales** : nom ou société éditrice, adresse, e-mail de contact, e-mail de modération.
2. **Durées de conservation** (5.4) : 24 mois pour les évènements, 6 mois pour les anonymes, 3 ans pour les
   comptes inactifs : d'accord ?
3. **Nom de domaine**.
4. **Notifications par e-mail actives par défaut** pour les comptes (7) : d'accord ?
5. **Hébergeur français** (11) : préférence entre Scaleway, OVHcloud et Clever Cloud, ou comparaison à faire ?
