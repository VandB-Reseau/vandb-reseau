# Journal des versions

Ce qui a changé dans l'app, sprint par sprint, du plus récent au plus ancien.
Chaque ligne renvoie à sa demande de fusion (#n). La colonne « Base » signale les migrations
à passer dans Supabase (voir [supabase/README.md](supabase/README.md)).

Reconstitué le 21/10/2026 à partir de l'historique des demandes de fusion et des propositions de sprint.
Les sprints 0 à 4 (14/10/2026) ont précédé le transfert du dépôt et n'ont pas de demande de fusion ici.

## À venir

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
