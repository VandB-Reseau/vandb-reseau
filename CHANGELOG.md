# Journal des versions

Ce qui a changé dans l'app, sprint par sprint, du plus récent au plus ancien.
Chaque ligne renvoie à sa demande de fusion (#n). La colonne « Base » signale les migrations
à passer dans Supabase (voir [supabase/README.md](supabase/README.md)).

Reconstitué le 21/10/2026 à partir de l'historique des demandes de fusion et des propositions de sprint.
Les sprints 0 à 4 (14/10/2026) ont précédé le transfert du dépôt et n'ont pas de demande de fusion ici.

## À venir

- Challenge du mois (sprint 22, A6) : Santé du parc > Challenges. Le Directeur (réseau, région, liste) ou un RR (ses
  magasins) lance un challenge sur un mois : progression du CA, du panier moyen cave ou bar face au même mois de l'an
  dernier. Classement calculé par la base ; l'équipe voit le chiffre de ses seuls magasins. Si le challenge le prévoit,
  le franchisé voit sur son accueil son rang et le podium, sans aucun chiffre. **Migration à passer : `0028_challenges.sql`.**
- Bonnes pratiques proposées par les franchisés (sprint 22, A4) : dans son onglet Bonnes pratiques, le franchisé propose
  une pratique (titre, texte dicté ou écrit) et suit son état (En relecture, Publiée, Non retenue). Dans Infos réseau,
  l'équipe du magasin relit, complète (photos, thème) et publie au nom du franchisé, ou ne retient pas. Photos ajoutées
  par l'équipe à la relecture. **Migration à passer : `0027_pratiques_proposees.sql`.**
- Questions éclair aux franchisés (sprint 22, A3) : dans Infos réseau, le Directeur (tout le réseau ou une région) ou
  un RR (ses magasins) pose une question oui/non, à choix ou note de 1 à 5, avec ou sans le nom des répondants, ouverte
  jusqu'à une date. Le franchisé répond d'un geste depuis son accueil, une seule fois. Résultats, moyenne, détail par
  région et liste des franchisés sans réponse. Anonymat tenu par la base : la réponse est rangée sans compte ni nom.
  **Migration à passer : `0026_questions_eclair.sql`.**
- Réunions et formations (sprint 22, A2) : un événement de l'agenda invite des magasins (tout le réseau, une région ou
  une liste ; Directeur et RR seulement). Le franchisé répond Présent ou Absent depuis son accueil ; après la date,
  l'équipe pointe les présents dans l'événement. Fiche magasin, onglet Visites : réunions de l'année, « Présent à X sur
  Y ». La présence aux réunions s'ajoute aux repères d'engagement du franchisé. **Migration à passer :
  `0025_reunions.sql`.**
- Engagement du franchisé (sprint 22, A5), équipe seule : dans Équipe > Franchisés et en tête de sa fiche, trois repères
  sur 90 jours affichés tels quels, sans note : communications lues (Directeur et RR), tâches tenues dans les délais,
  dernier message écrit. Filtre « Peu engagés » (au moins deux repères en retrait : moins d'une communication sur deux
  lue, moins d'une tâche sur deux tenue, aucun message depuis 60 jours). Jamais dans l'espace du franchisé. Sans migration.
- Notifications sur le téléphone d'une tâche confiée et d'une communication à la une (sprint 22, F2) : les porteurs
  d'une nouvelle tâche (sauf celui qui l'écrit) la reçoivent ; une communication mise à la une prévient les franchisés
  visés, une seule fois. Les @ dans les groupes étaient déjà envoyés (0018). **Migration à passer :
  `0024_notifications_taches_une.sql`, puis redéployer la fonction `notifier`.**
- Infos réseau, seul endroit des communications et bonnes pratiques pour l'équipe (sprint 22, S1) : les canaux
  « Réseau V and B » et « Bonnes pratiques » quittent Messages, qui ne garde que les conversations ; leurs anciennes
  adresses mènent à Infos réseau, comme les liens du fil vers une bonne pratique. Un seul compteur de nouveautés,
  celui de l'icône Infos réseau. Le franchisé garde le canal Réseau dans ses Messages et son onglet Bonnes pratiques.
  Sans migration.
- Ouverture plus rapide (sprint 22, F1) : chaque grand écran (Magasins, fiches, Visites, Agenda, Santé du parc, Messages,
  Tâches, Infos réseau, Équipe, espace franchisé) a son propre fichier, chargé à la demande puis préchargé en tâche de
  fond ; carte, ligne et contact des fiches dans `src/components/Section.tsx`, calculs de l'agenda dans
  `src/data/agenda.ts`. Fichiers téléchargés avant l'accueil : 442 → 386 ko compressés (−13 %). Sans migration.
- Fiche magasin sans onglet Messages (sprint 22, S2) : le picto message de l'en-tête ouvre le groupe du magasin dans
  Messages ; six onglets, Visites passe dans ceux visibles sur téléphone. Les anciens liens `?vue=messages` mènent au
  groupe. La fiche du franchisé garde son onglet Messages. Sans migration.
- S'inspirer d'un magasin qui réussit (sprint 22, A1) : dans Chiffres et santé de la fiche magasin, sous les leviers,
  les 3 magasins les plus forts sur le levier en retrait sur les 3 derniers mois (panier : valeur moyenne ; flux :
  évolution vs N-1), de la même région d'abord, sinon de tous les magasins visibles du compte ; leur franchisé, leurs
  bonnes pratiques, et un bouton pour lui écrire. Équipe seule (`inspirationsDu` dans `src/data/leviers.ts`,
  test `leviers.spec.ts`). Sans migration.
- Fiche magasin : Journal et Bonnes pratiques ont chacun leur onglet (Joseph, 22/10/2026), au lieu d'être sous la Fiche.
  Les liens du fil vers une bonne pratique ouvrent l'onglet Bonnes pratiques. Sans migration.
- Compte rendu dans le fil d'actualité (Joseph, 22/10/2026) : une vignette carrée « Compte rendu », comme une photo, ouvre le
  compte rendu dans une fenêtre (plein écran sur téléphone) ; la fermer ou revenir en arrière laisse le fil à la même place,
  pour aimer ou commenter. Le bouton PDF mène à la page imprimable. Sans migration.
- « Vu par » des bonnes pratiques (Joseph, 22/10/2026) : comme pour les communications, le Directeur et les Responsables
  Régionaux voient sous chaque bonne pratique combien de franchisés l'ont vue, et lesquels pas encore. Un franchisé qui affiche
  les bonnes pratiques les a vues. **Migration à passer : `0023_lectures_pratiques.sql`.**
- Photo d'en-tête facultative sur les bonnes pratiques (Joseph, 22/10/2026) : affichée en grand au-dessus du titre, comme
  pour une communication, et rangée avec les photos de la pratique (champ `entete` dans `bonnes_pratiques`, les franchisés la
  voient avec les mêmes règles que les autres photos). Sans migration.
- Canaux « Réseau V and B » et « Bonnes pratiques » des Messages présentés comme un groupe (Joseph, 22/10/2026) : les
  publications défilent comme des messages, la plus récente en bas ; seuls ceux qui publient ont le bouton en pied, tout le
  monde aime et commente. Recherche et filtres restent dans Infos réseau. Sans migration.
- Fiche magasin sans fil (Joseph, 22/10/2026) : l'onglet Fil disparaît, la fiche s'ouvre sur l'onglet Fiche, qui reçoit le
  journal (notes, santé, déploiements, Coachs) et les bonnes pratiques du magasin ; même chose pour la fiche du franchisé.
- Onglet Infos réseau (Joseph, 22/10/2026) : toutes les communications et toutes les bonnes pratiques réunies, côte à côte sur PC,
  en deux onglets sur téléphone, avec une recherche et des filtres communs (magasin, thème, période). Icône dans l'en-tête,
  à droite du « + », avec le nombre de communications et bonnes pratiques pas encore vues (préférences du compte, sans
  migration) ; équipe seulement (test `infos-reseau.spec.ts`).
- Épingler une conversation (Joseph, 22/10/2026) : punaise dans l'en-tête de la conversation ; les épinglées passent en tête
  de Messages, sous Réseau V and B et Bonnes pratiques, et suivent le compte du PC au téléphone (préférences, sans migration).
- Messages et Tâches deviennent deux onglets (Joseph, 22/10/2026) : Échanges s'appelle Messages, Tâches a son onglet
  (`/taches`) avec un compteur rouge (tâches en retard et tâches confiées pas encore vues, chacune une fois ; « vu »
  suivi du PC au téléphone par les préférences du compte, sans migration). Téléphone : barre du bas Accueil, Visites,
  Messages, Tâches, Santé ; Magasins passe dans le menu du compte et reste dans la recherche. Franchisé : Messages et
  Tâches séparés aussi (test `onglet-taches.spec.ts`).
- Quitter un groupe : le groupe disparaît aussitôt de la liste (la messagerie est rechargée), avec le message de confirmation.
- Fil d'actualité de l'accueil : seulement les comptes rendus de visite, les bonnes pratiques et les communications
  (plus de messages, tâches ni chiffres ; la fiche magasin garde tout). J'aime et commentaires sur chaque compte
  rendu, pour l'équipe et le franchisé, chacun sur ses magasins. Échanges : les comptes rendus quittent les groupes
  magasin (test `fil-actualites.spec.ts`). **Base : `0022_reactions_visites`.**
- Bouton Créer (22/10/2026) : les choix s'ouvrent en menu juste sous le bouton, plus de fenêtre au centre ;
  absences retirées de l'app (menu Créer, menu des cases de l'Agenda, catégorie Congés, glisser et étirer,
  remplaçant suggéré, Ma semaine de l'Accueil). La table `leaves` reste en base, sans migration.
- Retouches de Joseph (22/10/2026) : plus de puces « Trier par » sur la liste des magasins (téléphone et PC étroit) ;
  Santé du parc > Chiffres, le filtre Alerte rejoint la barre, juste après Coach ; jusqu'à 20 thématiques de
  déploiement lisibles (fiche magasin : avancement puis thématiques rangées par état ; onglet Déploiements :
  avancement en grille sur PC, 5 premières puis le reste sur téléphone, points sur deux rangées) ; Paramètres >
  Import et export, un seul « Importer » par référentiel : le classeur des visites, l'export Asana et l'export mensuel
  des chiffres sont reconnus sur les cartes Visites, Nine box, Déploiements et Chiffres mensuels (section
  « Fichiers de suivi » retirée) ; planifier une visite sans heure, événement Google Agenda à la journée ;
  Échanges, « Avec le franchisé » / « Équipe seule » devient un picto cadenas à côté de l'envoi, le texte commencé
  suit ; bouton « Exporter » retiré de Magasins, Visites et Santé du parc (choix de Joseph), les exports complets
  restent dans Paramètres > Import et export (test `retouches-sante-echanges.spec.ts`). Pas de migration.
- Échanges sur PC : « Mes tâches » s'ouvre aussi quand une conversation est affichée.
- Menu réorganisé : la partie Paramètres passe de sept à trois entrées (Équipe, avec Collaborateurs et Franchisés
  en onglets ; Évolution du parc ; Paramètres, avec Charge des Coachs et Import et export en rubriques). Campagnes
  quittent les Visites pour Santé du parc, à côté de Déploiements ; Bonnes pratiques deviennent un canal épinglé
  d'Échanges, sous le Réseau V and B. Les anciennes adresses mènent au nouvel endroit (test `menu-reorganise.spec.ts`).
  Pas de migration.
- Revue mensuelle du Responsable Régional : nouvel onglet « Revue » de sa fiche. Pour le mois choisi (le mois écoulé
  par défaut) : magasins qui décrochent, visites faites par Coach face à la référence nine box du mois, tâches en
  retard à la fin du mois, changements de case ; téléchargeable en PDF (`src/data/revue.ts`,
  `src/components/RevueRR.tsx`, test `revue-rr.spec.ts`). Pas de migration.
- Favoris, fiches récentes, vues enregistrées de Magasins et lecture du canal « Réseau V and B » suivent le compte :
  rangés dans la base en plus de l'appareil, ils se retrouvent sur le PC comme sur le téléphone ; au premier
  lancement, ce que l'appareil avait déjà est repris (`src/lib/preferences.ts`, test `preferences-compte.spec.ts`).
  Équipe seulement ; le franchisé garde ses réglages sur l'appareil. **Base : `0021_preferences`.**
- Magasins sur PC large (1 100 px et plus) : chaque ligne montre l'alerte, l'évolution du CA vs N-1, la case nine box,
  la dernière visite et les tâches en cours, en colonnes ; un clic sur un titre trie (Magasin, CA vs N-1, Case,
  Vu, Tâches) et remplace les puces de tri. Téléphone et PC étroit inchangés (`src/components/ListeMagasins.tsx`,
  test `magasins-colonnes.spec.ts`). Pas de migration.
- Fiche magasin, un seul fil : le Journal entre dans le Fil (notes, changements de santé, déploiements, Coachs,
  ouverture, mêlés aux visites, tâches et chiffres, du plus récent au plus ancien) ; puce « Journal » pour les voir
  seuls ; « + Note » en tête du fil ; une note ou un classement se modifie d'un toucher. Plus de doublon de la même
  visite. En-tête : les compteurs sans valeur (CA du mois, écart) disparaissent au lieu d'un tiret ; fil pleine
  largeur sur PC (`journalDansLeFil` dans `src/components/Journal.tsx`). Pas de migration.
- Leviers du CA : dans la fiche magasin (Chiffres et santé), panier et flux de la cave et du bar placés face au réseau
  du même mois (moitié centrale du réseau en bande, médiane, écart en %) et au même mois de l'an dernier ; le levier
  le plus en retrait d'au moins 5 % est nommé (panier comparé au réseau, flux comparé à N-1). Magasins : filtre
  Levier (Panier cave, Flux cave, Panier bar, Flux bar), repris dans les vues enregistrées et l'export
  (`src/data/leviers.ts`, test `leviers.spec.ts`). **Base : `0020_reperes_quartiles`** (sans elle, la bande
  part de la médiane).
- Tâches de l'équipe cachées au franchisé : une tâche créée depuis un message du fil « Équipe seule » n'est plus
  renvoyée à l'espace franchisé (ni à l'aperçu « Voir comme »), le franchisé ne peut pas la cocher ni lire ses fichiers ;
  l'équipe la voit marquée « Équipe seule » (test `taches-equipe.spec.ts`, contrôles dans `regles_acces.sql`).
  Correction de sécurité reportée dans 0005, 0007 et 0009. **Base : `0019_taches_equipe`.**
- Tâches à plusieurs porteurs : le champ « Porteurs » accepte plusieurs personnes du magasin (franchisé, Coach,
  RR, Directeur) partout où l'on crée ou modifie une tâche (fiche magasin, compte rendu, Échanges, Mes tâches).
  La tâche figure dans « Mes tâches », l'Accueil et le compteur de chacun de ses porteurs. Rangés dans le champ
  `porteur`, séparés par des virgules : anciennes tâches inchangées, pas de migration (`src/data/actions.ts`).
- Échanges sur téléphone : la conversation tient dans l'écran visible, clavier compris. Le nom du magasin, du
  groupe ou de la personne reste en haut, la saisie tout en bas, et seuls les messages défilent.
- Échanges façon messagerie : un onglet « Échanges » remplace la cloche, Messages, Tâches et Communications.
  Discussions | Mes tâches ; un groupe par magasin avec deux fils, « Avec le franchisé » et « Équipe seule » ;
  comptes rendus et tâches affichés dans le fil ; « En faire une tâche » depuis un message ; groupes libres créés
  par le Directeur ou un RR ; canal « Réseau V and B » épinglé (les communications) ; messages à deux inchangés.
  Prévenus : franchisé et Coach de tout, RR et Directeur s'ils sont cités ou ont déjà écrit dans le fil.
  Barre du bas téléphone : Accueil · Magasins · Échanges · Visites · Santé, « + » dans l'en-tête.
  Anciennes adresses redirigées (`src/pages/Echanges.tsx`, test `echanges.spec.ts`).
  **Base : `0018_echanges_groupes`.**
- Accueil de pilotage : quatre repères en tête (CA vs N-1, magasins qui décrochent, visites de l'année face à la
  référence nine box, santé du parc), Actualités en colonne principale, À traiter, Mes tâches et Cette semaine à
  droite. Téléphone : repères qui glissent, un bloc court à onglets (deux lignes, puces une fois la liste dépliée),
  puis les actualités. Le franchisé retrouve les actualités de ses magasins (test `accueil-pilotage.spec.ts`).
- Téléphone : les onglets affichent autant de rubriques que la largeur le permet avant « Plus » (fiche magasin :
  Fil, Fiche, Tâches et Messages sur les grands téléphones). Magasins : rangée de lettres A, B, C… retirée, les
  intertitres par lettre restent.
- Agenda interactif : cliquer dans une case (ou sur « + » du jour) propose Visite, Absence ou Événement à cette date
  (visite à venir = planifiée, visite passée = compte rendu) ; sur PC, glisser un événement, une absence ou une visite
  prévue change sa date, tirer le bord droit d'un événement ou d'une absence change sa fin ; sur téléphone, « + » sur
  chaque jour et toucher un jour libre de la bande. Les campagnes datées apparaissent dans l'agenda (catégorie
  Campagnes, lien vers la campagne), limitées aux campagnes qui touchent un magasin visible du compte
  (`src/pages/Agenda.tsx`, test `agenda-interactif.spec.ts`). Pas de migration.
- « Actions » devient « Tâches » partout à l'écran : onglet des fiches magasin et Coach, listes en cours et faites,
  fenêtre d'ajout et de modification, messages de confirmation, compte rendu et préparation de visite (« Tâches en cours »,
  colonne « Tâche », « N tâches au plan »), message envoyé au franchisé (« Nos tâches »). « Plan d'action » (titre du
  compte rendu) et « Autres actions » (menu ⋯) inchangés. Code et clés de base inchangés. Pas de migration.
- Recherche globale : en tapant le nom d'une personne (Coach, Responsable Régional, franchisé, responsable de magasin),
  sa fiche passe en tête, avant ses magasins ; elle n'est plus poussée hors de la liste par les magasins qui la citent
  (`src/components/RechercheGlobale.tsx`, test `magasins.spec.ts`). Pas de migration.
- En-tête des fiches (magasin, Coach, RR, personne, espace franchisé) plus bas sur PC : CA du mois, écart vs l'an dernier
  et tâches en cours rangés sur la ligne du nom, entre les infos et les pictos ; téléphone inchangé
  (`ProfilPersonne` dans `src/components/Portefeuille.tsx`, test `entete-compact.spec.ts`). Pas de migration.
- Communications plus rapides : publier, modifier ou retirer ferme la fenêtre aussitôt (la page se met à jour
  sur place et la base suit ; si elle refuse, la fenêtre revient avec ce qui était saisi), sans relire tout le réseau ;
  au retour sur la page, la dernière liste s'affiche sans attendre ; commentaires retirés ou ajoutés sans attente ;
  liens des photos gardés 50 minutes pour qu'elles restent dans le cache du navigateur
  (test `communications-rapides.spec.ts`). Pas de migration.
- Onglets et barres de recherche et de filtres collés sous la barre du haut sur tous les écrans, comme dans les fiches
  (Visites, Magasins, Équipe, Santé du parc, Charge des Coachs, Agenda, Notifications, fil de l'accueil) ; les intertitres
  (mois, lettres, régions) se rangent dessous ; Paramètres : sommaire fixe sur PC, retour fixe sur téléphone
  (`src/components/Collant.tsx`, test `onglets-collants.spec.ts`). Pas de migration.
- Base de données remise en ordre : migrations numérotées dans `supabase/migrations/`, rejouées à chaque
  publication sur un PostgreSQL vide avec contrôle des règles d'accès (`npm run test:base`). Deux anciens
  scripts qui rouvraient les visites et les photos d'audit à tout compte connecté s'ils étaient rejoués sont corrigés.
- Base en ligne : le contrôle du 21/10/2026 a montré que toutes les tables étaient revenues à « tout compte connecté »
  (ancien script repassé) et que la dernière version des communications n'était pas passée. Remise à niveau en
  rejouant 0001 à 0012 — Base : `0012_garde_fous_et_journal` (+ suite complète)
- Documentation : schéma de la base ([docs/base-de-donnees.md](docs/base-de-donnees.md)),
  architecture ([docs/architecture.md](docs/architecture.md)), ce journal.
- Couleurs plus calmes : seul le rouge (Décroche, En retard, dépassement de charge) reste une pastille pleine ;
  orange, bleu et vert deviennent un texte coloré précédé d'un point. Sur téléphone, au-delà de 4 onglets,
  les 3 premiers restent visibles et « Plus » ouvre les autres dans un panneau du bas. « Voir plus » est
  gardé au retour arrière, pour retrouver la ligne quittée (#73)
- Tâches, messages, notifications : les tâches suivent la barre commune (recherche, filtres repliés sur téléphone,
  bouton rond) et sont rangées En retard, Cette semaine, Plus tard, Sans échéance ; bouton « Nouveau message »
  pour écrire à une personne du réseau ; notifications rangées Aujourd'hui, Hier, Cette semaine, puis par mois (#74)
- Écrans plus lisibles : « À traiter » commence par les urgences, avec des puces Urgent, Suivi, À voir pour filtrer ;
  Magasins affiche à droite la dernière visite (« vu il y a 45 j ») ; les photos restent en vignettes carrées, même
  seules, et s'ouvrent en plein écran ; Visites résume l'année en trois compteurs, « pas vus » filtre la liste ;
  nine box : cases vides discrètes et Coachs en initiales (plus de bulle qui recouvrait le libellé au téléphone) ;
  Équipe en liste : un intertitre par Responsable Régional, ses Coachs en lignes avec leur charge.
- Paramètres : un sommaire avec la valeur clé de chaque rubrique (charge maximale, seuils, délais), puis une
  rubrique par écran sur téléphone ; sur PC, le sommaire reste à gauche.
- Communications : le Directeur et le Responsable Régional voient « Lue par X franchisés sur Y » et, d'un toucher,
  qui ne l'a pas encore lue — Base : `0013_lectures_communications`
- Écrans plus compacts : sur téléphone, le compteur passe à droite du titre ; Plus en libellés seuls avec les postes
  à pourvoir ; Paramètres en lignes, le chiffre à droite ; contacts de la fiche à initiales, rôle sous le nom ;
  Magasins triés par nom, dernière visite ou évolution du CA, avec accès direct à une lettre ; fil de l'accueil
  regroupé par magasin et par jour ; Agenda en pastilles neutres et, sur téléphone, une bande des jours du mois ;
  plus de bouton de tournée par Coach dans Visites (la tournée reste dans Semaine) ; écrans peu utilisés chargés
  à la demande (application deux fois plus légère au démarrage).
- Communications : l'auteur ou le Directeur met une communication à la une jusqu'à une date ; elle reste en tête
  des Communications et du fil de l'accueil — Base : `0014_communications_a_la_une`
- Dernières finitions : sur PC, « À traiter » reste visible pendant qu'on fait défiler l'accueil ; sur téléphone,
  les filtres actifs de Magasins restent en puces sous la recherche ; fiche magasin à trois pictos, Planifier,
  Préparer et Modifier dans « Autres actions » ; historique des visites par mois avec vignettes ; postes à pourvoir
  en ligne grisée dans leur région ; absence et événement se créent depuis le bouton Créer.
- Magasins favoris et récents : « Ajouter aux favoris » dans « Autres actions » de la fiche ; favoris et 5 dernières
  fiches ouvertes en tête de Magasins (sans filtre) et de la recherche globale dès qu'on touche le champ. Gardés sur l'appareil.
- Fiches des personnes réservées : le Directeur voit toutes les fiches ; un Coach ou un Responsable Régional, celles
  de l'équipe et des seuls franchisés de ses magasins (préalable à l'ouverture de leurs comptes) — Base : `0015_fiches_personnes`
- Notifications sur le téléphone : « Recevoir les notifications sur cet appareil » dans le menu du compte ; un message
  privé reçu et, pour le franchisé, un nouveau compte rendu de visite arrivent en notification, même app fermée
  (sur iPhone, app ajoutée à l'écran d'accueil) — Base : `0016_notifications_telephone` + fonction Supabase `notifier`
- Visite prévue, visite faite : une visite planifiée ne compte dans le rythme et « pas vu depuis » qu'une fois son compte
  rendu enregistré ou confirmée « Faite » ; le jour J, Ma semaine propose « Faire le compte rendu » (prérempli des notes de
  préparation) ; date passée : ligne dans « À traiter » avec Faite et Reporter. Compte rendu commencé gardé sur
  l'appareil et repris à la réouverture, effacé à l'enregistrement — Base : `0017_visites_prevues`
- Fiche magasin en six onglets au lieu de neuf : Fil (le journal et les bonnes pratiques au bas du fil), Fiche,
  Tâches et campagnes, Messages, Visites, Chiffres et santé ; les anciens liens (santé, campagnes, journal) ouvrent
  l'onglet qui les accueille, à leur partie. Pas de migration.
- Magasins : filtre Alerte (Décroche, À surveiller, Pas vu depuis longtemps) ; une combinaison de recherche, filtres
  et tri s'enregistre sous un nom (« Enregistrer la vue ») et revient en puce au-dessus de la liste. Vues gardées sur
  l'appareil (`src/lib/vues.ts`). Pas de migration.
- Exporter : Magasins, historique des Visites et Santé du parc (Évaluer, Déploiements) partent en Excel avec exactement
  les lignes affichées, filtres compris ; Directeur et Responsables Régionaux seulement, sans téléphone ni courriel
  (`src/components/Exporter.tsx`). Pas de migration.
- Santé du parc, tableaux Évaluer et Déploiements (PC) : « Voir plus » est au bas du tableau et les lignes
  ajoutées apparaissent aussitôt ; chaque critère, la case et chaque thématique se trient (du plus haut au plus bas,
  puis l'inverse) et se filtrent par valeur (Faible, Moyen, Fort, non noté ; options de la thématique, non renseigné)
- Tableaux Évaluer et Déploiements : la colonne Magasin se trie de A à Z ou de Z à A et se filtre par nom,
  avec une recherche dans la liste
- Tableaux sur PC : le cadre du tableau défile vraiment (une carte masquait ce qui dépassait, « Voir plus » était
  hors d'atteinte à la souris) et sa hauteur tient compte des onglets et filtres collés en haut : la ligne des
  titres reste visible
- Tableaux Évaluer et Déploiements : « Voir plus » sous le tableau, toujours visible ; le tableau défile jusqu'aux
  lignes ajoutées

## 21/10/2026

- Barre du bas en verre sur téléphone : flottante, translucide, onglet actif en pastille (#70)

## Sprint 19 — la journée du Coach, la charge du Directeur (20/10/2026)

- Charge des Coachs dans Paramètres, simulation, trajets et kilomètres par la route ; compte rendu envoyé au franchisé en un geste (#69)
- Visites : préparer et planifier en une fenêtre (date, heure, notes), lien Google Agenda prérempli (#65) — Base : `0011_preparation_visites`
- Fiches : Appeler, Message et Visite en pictos à côté du nom (#68)
- Fenêtre Créer plus compacte, icône à côté du libellé partout (#67)

## Sprint 18 — portefeuilles et Ma semaine (20/10/2026)

- Portefeuille Coach et RR, Ma semaine, espace franchisé au nouveau design (#59)
- Infobulles à 12 px (#60)
- Fiches : onglets collants, position gardée au changement d'onglet (#61) ; en-tête bas sur téléphone (#62)

## Sprint 17 — harmonisation et communications (20/10/2026)

- Onglets harmonisés, Évaluer et Déploiements en lignes, imports et thématiques dans Paramètres, communications du réseau aux franchisés (#58) — Base : `0008_communications`
- Communications mises en forme (collées depuis un courriel) et reprises dans le fil d'activité (#63)
- Fil façon réseau social : photos des communications, bonnes pratiques de tout le réseau, J'aime et commentaires (#64) — Base : `0010_pratiques_reactions`

## Sprint 16 — app fluide, façon réseau social (20/10/2026)

- Accueil « À traiter » et fil d'activité, barre du bas avec Créer, listes en lignes (tableau au choix sur PC), fiche magasin en profil, J'aime sur les bonnes pratiques (#57)
- Visites : onglets Rythme et Historique sans blocage sur un grand réseau (#56)

## Messagerie, tâches et pièces jointes (20/10/2026)

Livré entre les sprints 13 et 16, sans numéro de sprint.

- Messagerie façon Messenger : conversations par magasin, @ simplifié (#49)
- Messagerie par personne, « Équipe seulement », page Notifications (#50)
- Échanges privés à deux, magasins cités avec # (#51) — Base : `0006_messagerie` repassée
- Actions : liste partagée à faire / faites pour l'équipe et le franchisé (#52) — Base : `0007_actions_franchise`
- Tâches : porteur choisi, liste de chacun, icône à côté de la cloche (#53)
- Pièces jointes : photos et fichiers sur les tâches et les messages (#54) — Base : `0009_pieces_jointes`
- En-tête : aperçu des tâches et des messages (#55)

## Sprint 13 — ouvrir l'app aux Coachs (19-20/10/2026)

- Accès de l'équipe ouverts depuis la fiche du Coach ou du RR, droits sur les référentiels, fiche avant visite, « Voir comme » (#47) — Base : `0005_cloisonnement_equipe` repassée
- Campagnes régionales tenues par les Responsables Régionaux (#48) — Base : `0005_cloisonnement_equipe` repassée

## Sprint 12 — messagerie et cloisonnement de l'équipe (19/10/2026)

- Messagerie par magasin, @mentions, cloche de notifications (#44) — Base : `0006_messagerie`
- Coach et RR : sans Paramètres, limités à leurs magasins à l'écran et dans la base (#45) — Base : `0005_cloisonnement_equipe`

## Sprint 11 — espace franchisé cloisonné (19/10/2026)

- L'Équipe passe en tête du groupe Paramètres (#41)
- Espace franchisé cloisonné par la base : le franchisé ne lit aucune table (#42) — Base : `0004_acces_franchises`
- Actions hors visite, ligne des titres fixe dans les tableaux (#43)
- Fiche magasin : audits dans l'onglet Visites (#46)

## Sprint 10 — fiche magasin en onglets (19/10/2026)

- Fiche magasin en onglets, actions suivies, associés et mandats, accueil par rôle (#40)

## Sprint 9 — nine box paramétrable (19/10/2026)

- Franchisé noté sur 5 critères pondérés, grille réglable (#39)
- Une date par déploiement (export et fiche magasin) (#38)

## Sprint 8 — référentiels, sauvegarde, campagnes (16/10/2026)

- Import et export Excel de chaque référentiel, sauvegarde complète, campagnes (#36)
- Import : une ligne absente du fichier est supprimée (#37)

## Sprint 7 — audits et photos (15/10/2026)

- Grilles d'audit hygiène et excellence opérationnelle, avec photos (#34) — Base : `0003_photos_audits`
- Photos sur toutes les visites et bonnes pratiques (#35)

## Sprint 6 — piloter au chiffre (15/10/2026)

- Chiffres mensuels, alerte de décrochage, appels hors rythme, note d'audit (#12)
- Affectations au mois, visites à plusieurs participants (#14)
- Menu : Santé du parc et Équipe échangés (#15) ; nine box : un changement par jour (#16)
- Chiffres : panier moyen et flux cave et bar, marge, CA cumulé calculé (#17)
- Plan d'affectation qui ne bloque plus (#18)
- Import du classeur de suivi des Coachs et des notes d'audit (#19, #20)
- Santé : modifier, supprimer ou effacer les classements nine box (#21, #22)
- Carte : magasins à leur vraie position, Coachs et RR avec leur picto et à la bonne commune (#23, #25, #28)
- Écrans ouverts en haut de page (#24) ; plus de page blanche après une mise en ligne (#26)
- Fiche magasin : chiffres d'un mois modifiables (#27), carte Google intégrée (#29)
- Barres d'outils et onglets cohérents partout (#30, #31, #32)
- Santé du parc > Chiffres alignés sur la fiche, décrochage sur l'écart de CA (#33)

## Sprint 5 — suivi des magasins (14-15/10/2026)

- Rythme de visite selon la nine box, historique de la santé, journal (#7)
- Année civile à la place de l'année fiscale (#8)
- Équipe : menu simplifié, zones réparties par temps de trajet (#9) ; tournées sur les vrais trajets routiers (#11)
- Historique daté : classement à une date choisie, import avec date (#10)

## Sprints 0 à 4 — fondations (14/10/2026)

- Sprint 0 : dépôt, React + MUI aux couleurs V and B, navigation PC et téléphone, connexion, tests Playwright, publication sur GitHub Pages
- Sprints 1 à 4 : magasins et carte, équipe et charge, visites et agenda, pilotage (accueil, santé du parc)
- Le même jour : zones Coach et RR sur la carte (#1), fiches personnelles et Franchisé (#2), Équipe en onglets (#3),
  charge des Coachs repensée (#4), compte rendu de visite dicté et plan d'action (#5, #6) — Base : `0002_visites_compte_rendu`
- Base de départ : les 9 tables de l'ancienne app, verrouillées aux comptes connectés — Base : `0001_tables_de_base`
