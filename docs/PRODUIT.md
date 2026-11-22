# tfek — vision produit et décisions

Ce document garde la trace du **pourquoi**. Le **comment** technique est dans [`CLAUDE.md`](../CLAUDE.md) et le [`README`](../README.md).

## Le problème

Les événements Facebook étaient parfaits : une page par event, les infos, qui vient (Oui / Peut-être / Non), les annonces de l'organisateur. Mais plus personne n'est sur Facebook.

Aujourd'hui les events s'organisent dans un groupe WhatsApp ou Messenger :
- les **infos importantes** (heure, lieu, changements, quoi ramener) sont **noyées** dans la conversation ;
- l'organisateur **ne sait pas qui vient** (compter les 👍, relancer chacun…).

## La réponse tfek

Une **page par event**, partagée par un **simple lien** collé dans la conversation existante. tfek **complète** WhatsApp, il ne le remplace pas.

## Principes (validés avec le porteur du projet)

1. **Zéro barrière pour les invités.** Répondre = ouvrir le lien, cliquer Oui/Peut-être/Non, taper son prénom. **Jamais de compte obligatoire.** L'organisateur veut avant tout que les gens répondent.
2. **Inciter au compte, sans forcer.**
   - L'**organisateur** a intérêt à un compte (gérer, voir les réponses, publier des infos) : il est **obligatoire pour publier**, mais demandé **après** qu'il a rempli son event (il est déjà investi).
   - L'**invité** se voit proposer un compte *après* avoir répondu (« retrouve tes events partout »). S'il accepte, ses réponses passées sont rattachées.
   - Avec un compte : tableau de bord **« Organisés »** et **« Invitations »**.
3. **Connexion sans friction** : pas de mot de passe. Code à 6 chiffres par e-mail (ou lien magique), Google en option.
4. **Notifications sans coût** : SMS = payant → à éviter. Les annonces et relances partent **du téléphone de l'organisateur** (WhatsApp / SMS / partage natif) avec un message pré-rédigé contenant le lien. Plus tard : push web (gratuit) et e-mail (offres gratuites) pour ceux qui l'acceptent, en option.
5. **Confidentialité : simple par défaut, réglable si besoin.**
   - Défaut : visible par **quiconque a le lien**, liste des invités visible, +1 autorisés. Les events ne sont **pas listables**.
   - Options : qui voit les réponses (tout le monde avec les prénoms, le nombre seulement, ou l'organisateur seul, comme sur Facebook), interdire les +1.
   - Plus tard : events **publics découvrables**.
6. **Web app d'abord** (PWA), avec **Ionic + Vue + Capacitor** pour publier sur les stores plus tard sans réécrire.
7. **Plus tard, si l'app perce** : events sponsorisés.
8. **Style « billet », version chic** (choisi après plusieurs pistes de maquettes) : app toujours en sombre, chaque invitation est un billet d'entrée (bandeau aux couleurs profondes avec fines rayures et liseré, **tampon rond « INVITATION · TFEK »** qui porte la marque, date et heure en police machine, ligne pointillée). L'organisateur choisit parmi 6 palettes : Noir et or, Bordeaux, Vert anglais, Bleu nuit, Terre cuite, Ivoire. Détails dorés, traits fins, pas de couleurs fluo. Le côté fun passe par le visuel, **pas par les textes** : ton sobre, **pas de point d'exclamation ni d'emoji dans l'interface** (les utilisateurs mettent ce qu'ils veulent dans leurs propres textes). Police unique : JetBrains Mono (titres en gras serré, texte, détails du billet), embarquée.

## Choix techniques et pourquoi

| Choix | Raison |
|---|---|
| Ionic + Vue + Capacitor | Une base de code → web, iOS, Android. Vue = préférence du porteur. |
| Supabase (vs Firebase) | Données très relationnelles (events, réponses, comptes) → Postgres. Coût prévisible, pas de verrouillage (auto-hébergeable). |
| Sessions anonymes Supabase pour les invités | Identité stable sans rien demander ; convertible en vrai compte. |
| Jeton de fusion (`merge_tokens`) | Rattacher les réponses d'un invité anonyme à un compte existant, de façon sûre. |
| Accès public via RPC par slug | « Qui a le lien peut voir » sans permettre de lister tous les events. |
| Supabase local + Mailpit en dev | Le porteur avait été bloqué par les e-mails de confirmation Supabase : en local, aucun vrai e-mail, aucune limite, comptes de test en 1 clic. |

## Ce qui existe (MVP v0.1)

- Créer / modifier / annuler un event (titre, date, fin optionnelle, lieu, description, couleur du billet, options de confidentialité)
- Page event : infos, ajout à l'agenda (.ics), lien carte, **dernière info mise en avant**, réponse Oui/Peut-être/Non + prénom + accompagnants, liste des invités groupée
- Organisateur : publier une info puis la partager, inviter, relancer, supprimer une info
- **Aperçu riche du lien** (WhatsApp, Messenger, iMessage, Telegram…) : image billet 1200 × 630 aux couleurs de l'event, titre, date, lieu et, si l'organisateur l'autorise, les réponses (« Alex, Inès et 10 autres viennent »). Rendu par des fonctions Vercel (`api/`), envoyé uniquement aux robots des messageries.
- Comptes : code e-mail, fusion invité → compte, tableau de bord Organisés / Invitations, prénom modifiable

## Feuille de route

Par ordre de priorité proposé :

1. **Mise en ligne** : projet Supabase cloud + hébergement statique (Vercel), SMTP réel (Resend/Brevo), domaine. Pas-à-pas dans [`DEPLOIEMENT.md`](DEPLOIEMENT.md).
2. **Vérifier l'aperçu du lien sur de vrais téléphones** une fois en ligne (WhatsApp, Messenger, iMessage), et passer le favicon (encore violet) au style billet.
3. **Poids du bundle** (~330 Ko gzip) : découpage, chargement différé.
4. **Notifications optionnelles** : push web pour les invités, e-mail pour les comptes (nouvelle info, rappel la veille).
5. **Image de couverture** (Supabase Storage).
6. Connexion Google en production.
7. Builds natifs iOS/Android + liens profonds (le lien magique ouvre aujourd'hui la version web ; le code à 6 chiffres marche partout).
8. Idées en attente : « qui ramène quoi », sondage de date, commentaires, validation des participants par l'organisateur, events publics découvrables, events sponsorisés.
