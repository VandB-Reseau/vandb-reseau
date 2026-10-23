# Base de données

Base Supabase (PostgreSQL) du projet `aipodcpbakywbrrilaud`. Le schéma est entièrement décrit par les
migrations de [`supabase/migrations/`](../supabase/migrations) ; ce document en donne la carte.
Mode d'emploi des migrations : [`supabase/README.md`](../supabase/README.md).

Mis à jour le 23/10/2026 (migration `0030`).

## Principes

- **Rôle lu dans la base.** Le rôle du compte (`directeur`, `rr`, `coach`, `franchise`, `sans_acces`) est rangé
  dans `auth.users.raw_app_meta_data`, posé par les fonctions d'ouverture d'accès, et relu par `mon_role()`.
  Le jeton de connexion seul ne donne aucun droit.
- **Trois niveaux d'accès** (Row Level Security) :
  - le Directeur de réseau voit et écrit tout ;
  - un Coach ou un RR lit les référentiels et l'agenda de tout le réseau, mais ne lit et n'écrit les visites,
    chiffres et suivi que de ses magasins (`magasins_visibles()`, tenu par `perimetre_equipe`) ;
  - un franchisé ne lit **aucune table** : tout passe par des fonctions (`espace_franchise()`, messagerie,
    communications, actions), qui vérifient ses magasins dans `acces_franchises`.
- **Tables sociales fermées.** Messages, communications, J'aime et commentaires n'ont aucun droit direct
  (`REVOKE ALL`) : seules leurs fonctions les lisent et les écrivent, et posent elles-mêmes l'auteur.
- **Un magasin est identifié par son nom** (`store`, `store_name`), un Coach par son nom (`cs`, `coach`),
  un RR par son identifiant (`rr`). Renommer un magasin ou un Coach réécrit ces valeurs (l'app et les
  fonctions `renommer_*`).
- **Noms internes hérités de l'ancienne app**, gardés tels quels : `cs` = Coach, `dr` = Responsable Régional,
  `store` = magasin, `*_overrides` = fiche complétée à la main.

## Tables

### Référentiels (lecture : équipe ; écriture : Directeur)

| Table | Contenu | Clé |
| --- | --- | --- |
| `app_config` | Réglages et référentiels en clé / valeur, `value` = texte JSON (détail plus bas) | `key` |
| `store_overrides` | Fiche de chaque magasin : coordonnées, adresse, `franchise` (vrai = franchisé), `rr` (RR en direct), position | `store_name` |
| `reassigns` | Coach de chaque magasin à partir d'une date (effet le 1er du mois ; `date` en texte AAAA-MM-JJ) | `id` ; `store`, `cs`, `date` |
| `cs_overrides` | Coachs : téléphone, courriel, ville, couleur, `tech` (Technicien) | `cs_name` |
| `recruits` | Recrues à venir ou fictives (simulation de charge) | `id` |

Exception : toute l'équipe écrit la clé `bonnes_pratiques` d'`app_config`.

### Fiches des personnes (Directeur : tout ; Coach et RR : l'équipe et les franchisés de leurs magasins)

| Table | Contenu | Clé |
| --- | --- | --- |
| `fiches_personnes` | Fiche personnelle (prénom, nom, naissance, arrivée, ville, courriel, téléphone) en JSON. Clé : `directeur`, `rr:<identifiant>`, `coach:<nom>`, `franchise:<nom>`. Avant `0015`, clé `fiches_personnes` d'`app_config` | `cle` |

Un franchisé est « de mes magasins » (`franchise_de_mes_magasins`) s'il est inscrit sur un de ces magasins
(`store_overrides.resp` ou `store_adds`), s'il en est associé (`suivi_magasins`, rubrique `associes`) ou si son
compte franchisé porte sur l'un d'eux. Seul le Directeur écrit.

### Préférences de chaque compte (équipe : sa seule ligne ; franchisé : aucun accès)

| Table | Contenu | Clé |
| --- | --- | --- |
| `preferences` | `valeur` en JSON : `suivis` (favoris, fiches récentes), `vues` (vues enregistrées de Magasins), `reseauVu` (dernière ouverture du canal Réseau), `tachesVues` (tâches déjà vues, pour le compteur de l’onglet Tâches), `epingles` (conversations épinglées en tête de Messages), `pratiquesVues` (bonnes pratiques déjà vues, pour le compteur Infos réseau), ajoutées sans migration. Reprise de l'appareil au premier lancement (0021) | `user_id` |

### Données par magasin (Directeur : tout ; Coach et RR : leurs magasins)

| Table | Contenu | Clé |
| --- | --- | --- |
| `visits` | Visites, appels, audits. `visitor` = participants séparés par « , » ; `sections` = compte rendu en 10 parties ; `action_plan` = plan d'action ; `docs` = photos et liens ; `group_id` relie une tournée ; `prevue` = planifiée, pas encore faite (0017) : ne compte ni dans le rythme ni dans « pas vu depuis » | `id` |
| `store_finance` | Chiffres mensuels : `pm_cave`, `flux_cave`, `pm_bar`, `flux_bar`, `ca_ext`, `marge` saisis ; `ca_cave`, `ca_bar`, `panier`, `freq`, `ebitda` hérités | `store_name`, `month` |
| `suivi_magasins` | Suivi par magasin, une ligne par rubrique (`cle`, liste ci-dessous), `valeur` en JSON | `store_name`, `cle` |

Rubriques de `suivi_magasins` (contrainte `suivi_magasins_cle_check`) :

| `cle` | Contenu | Ancienne clé d'`app_config` |
| --- | --- | --- |
| `sante` | Notes nine box datées | `sante_parc` |
| `sante_sauvegarde` | Copie avant « Effacer toutes les notes » | `sante_parc_sauvegarde` |
| `notes` | Journal du magasin | `notes_magasins` |
| `audits` | Résultats consolidés des audits | `audits` |
| `associes` | Associés et mandats | `associes` |
| `actions` | Tâches hors visite ; `fil` = `equipe` pour une tâche née dans « Équipe seule », jamais renvoyée au franchisé (0019) | `actions` |
| `deploiements` | État et journal des thématiques déployées | `deploiements` (partie magasin) |
| `constats` | Constats de campagne | `campagnes` (partie constats) |
| `preparation` | Prochaine visite : date, heure, notes | `preparations_visites` |

Ajouter une rubrique = une migration qui remplace la contrainte (modèle : `0011_preparation_visites.sql`).

### Agenda (toute l'équipe lit et écrit)

| Table | Contenu |
| --- | --- |
| `events` | Événements : réunions, séminaires, formations ; `type` = `event`, `reunion` ou `formation` ; `invites` = magasins invités (0025, posés par le Directeur ou un RR seulement, contrôle `garde_invites`) ; `heure` (HH:MM, heure de Paris) et `html` (contenu mis en forme, 200 000 caractères au plus, nettoyé par l'app à chaque affichage), 0030 |
| `leaves` | Congés d'un Coach (`role` = `cs`) ou d'un RR (`dr`). Plus lue par l'app depuis le 22/10/2026 (absences retirées) ; gardée en base et dans la sauvegarde |

### Accès et périmètre

| Table | Contenu | Accès |
| --- | --- | --- |
| `acces_franchises` | Compte franchisé → nom du franchisé → ses magasins | lecture Directeur ; écriture par fonctions |
| `perimetre_equipe` | Pour chaque magasin : son Coach et les RR qui le suivent. Recopié par l'app du Directeur à chaque chargement (`maj_perimetre_equipe`) | lecture Directeur ; écriture par fonction |
| `campagnes_regions` | Campagnes régionales, tenues par leur RR | lecture équipe ; écriture RR auteur ou Directeur |
| `sauvegarde_cloisonnement` | Copie d'`app_config` avant le passage de `0005` (19/10/2026) | lecture Directeur |
| `journal_migrations` | Une ligne par migration passée en ligne, avec sa date | lecture Directeur |

### Échanges (aucun accès direct, fonctions seulement)

| Table | Contenu |
| --- | --- |
| `messages` | Messages : à deux (`destinataire`) ; groupe d'un magasin (`store`, avec `equipe` = fil « Équipe seule », jamais lu par le franchisé) ; groupe libre (`groupe`, et `destinataire` = `groupe:<id>` pour qu'une ancienne version de `messagerie` ne le montre qu'à son auteur, 0018) ; `pieces` = fichiers joints |
| `messages_lus` | Dernière lecture de chaque compte, par magasin, personne ou groupe (`groupe:<id>`) et par sujet (`messages`, `visites`, `equipe` pour « Équipe seule ») |
| `groupes` | Groupes libres (0018) : nom, `membres` (clés des personnes : `directeur`, `rr:<id>`, `coach:<nom>`, `franchise:<nom>`), créateur. Créés par le Directeur ou un RR ; un RR n'invite que l'équipe et les franchisés de ses magasins |
| `communications` | Communications du réseau ; `magasins` vide = tout le réseau ; `html` = version mise en forme ; `a_la_une` = en tête jusqu'à ce jour inclus (0014) |
| `communications_pouces`, `communications_commentaires` | J'aime et commentaires des communications |
| `communications_lectures` | Première lecture d'une communication par chaque compte franchisé |
| `pratiques_lectures` | Première fois qu'un compte franchisé voit une bonne pratique (identifiant de la pratique dans `bonnes_pratiques`), 0023. Aucun accès direct |
| `reunions_presences` | Réponse du franchisé (`present`/`absent`) et pointage de l'équipe pour chaque magasin invité à un événement, 0025. Aucun accès direct |
| `questions_eclair` | Sondages : de 1 à 5 questions (`questions`, chacune oui/non, choix ou note ; 0029), destinataires (`cible` : `franchises`, `equipe`, `tous` ; 0029), magasins visés (vide = tout le réseau), date de fin, anonymat, rôle de l'auteur, 0026. Aucun accès direct |
| `questions_participations` | Qui a répondu à un sondage (compte), sans la réponse ni l'heure, 0026. Aucun accès direct |
| `questions_reponses` | Réponses : une valeur par question (`valeurs`, 0029), rôle du répondant, régions ; nom et magasins seulement pour une question nominative ; identifiant tiré au hasard, 0026. Aucun accès direct |
| `pratiques_proposees` | Bonnes pratiques proposées par un franchisé (magasin, titre, texte), état (`proposee`, `publiee`, `refusee`) et pratique publiée, 0027. Aucun accès direct |
| `challenges` | Challenges du mois : indicateur (`ca`, `pm_cave`, `pm_bar`), mois, magasins en compétition, rang montré ou non aux franchisés, 0028. Aucun accès direct |
| `pratiques_pouces`, `pratiques_commentaires` | J'aime et commentaires des bonnes pratiques |
| `visites_pouces`, `visites_commentaires` | J'aime et commentaires des comptes rendus de visite, depuis le fil d'actualité (0022). Lus et écrits par `reactions_visites`, `basculer_pouce_visite`, `commenter_visite`, `supprimer_commentaire_visite`, seulement sur une visite que le compte voit (`visite_visible` : franchisé = ses magasins hors appels et points, Coach et RR = leurs magasins, Directeur = toutes) |

### Notifications sur le téléphone (aucun accès pour les comptes, 0016)

| Table | Contenu | Clé |
| --- | --- | --- |
| `abonnements_push` | Appareils où une personne a activé les notifications : adresse d'envoi du navigateur (`endpoint`), compte (`user_id`), clés de chiffrement de l'appareil | `endpoint` |
| `cles_push` | La paire de clés d'envoi, créée par la fonction « notifier » à son premier appel | `id` = 1 |

Le compte connecté s'abonne ou se désabonne par `abonner_appareil` / `desabonner_appareil`. Seule la fonction
Supabase « notifier » (`supabase/functions/notifier/index.ts`, clé `service_role` côté Supabase) lit ces tables et
appelle `notifications_a_envoyer` : destinataire d'un message privé de moins de 10 minutes écrit par l'appelant ;
groupe d'un magasin (0018) : franchisés (sauf « Équipe seule ») et Coach du magasin, plus le RR ou le Directeur s'ils sont cités ou ont déjà écrit dans le fil ; groupe libre : tous ses membres ;
franchisés du magasin pour un compte rendu de visite des 7 derniers jours saisi par l'équipe (pas les appels).
`notifications_tache` (0024) : porteurs d'une tâche non faite, créée aujourd'hui ou hier, par un auteur qui voit le
magasin ; chaque porteur doit voir le magasin (une tâche « Équipe seule » ne part jamais vers un franchisé).
`notifications_une` (0024) : franchisés des magasins visés par une communication encore à la une, quand l'appelant est
le Directeur ou le RR qui l'a écrite.
`notifications_animation` (0030) : un nouveau contenu, une seule fois (table `notifications_envoyees`, fermée ; les contenus
d'avant 0030 y sont notés), jamais à son auteur. Sondage de l'appelant encore ouvert : ses destinataires. Réunion ou
formation à venir avec invités, annoncée par le Directeur ou un RR (ses magasins seulement) : franchisés et Coachs des
magasins invités. Communication de l'appelant de moins d'un jour : franchisés, Coachs et RR des magasins visés, et le
Directeur. Bonne pratique existante : tout le réseau. Campagne pas terminée, du Directeur ou du RR qui la tient :
franchisés, Coachs et RR des magasins concernés envoyés par l'app, recoupés avec ceux de l'appelant.

| Table | Contenu | Clé |
| --- | --- | --- |
| `notifications_envoyees` | Contenus déjà notifiés (`genre` : sondage, evenement, communication, pratique, campagne ; `cle` : son identifiant), 0030 | `genre`, `cle` |

### Comptes des franchisés (fonction « comptes », 23/10/2026)

La fonction Supabase « comptes » (`supabase/functions/comptes/index.ts`, clé `service_role` côté Supabase seulement)
crée, réinitialise et supprime les comptes Auth des franchisés. Elle relit le rôle de l'appelant dans `auth.users`
(Directeur seul) et refuse tout compte de l'équipe. Un compte créé reçoit un mot de passe provisoire et
`user_metadata.mot_de_passe_provisoire = true` : l'app impose de le changer à la connexion. L'accès lui-même reste
ouvert par `ouvrir_acces_franchise` ; supprimer le compte efface sa ligne d'`acces_franchises` (`ON DELETE CASCADE`).
Aucun e-mail n'est envoyé par Supabase : le Directeur transmet les identifiants.

## Clés d'`app_config`

| Clé | Contenu | Forme |
| --- | --- | --- |
| `store_adds` | **Liste des magasins** (nom `n`, département, ouverture, adresse, position…) | tableau |
| `store_renames` | Renommages : ancien nom → nouveau nom | objet |
| `store_deletes` | Magasins retirés (fichier de base de l'ancienne app seulement) | tableau de noms |
| `drs_data` | Directeur (`directeur`), RR (`drs`), RR de chaque Coach (`cs_dr`) et ses changements datés (`dr_assigns`) | objet |
| `cs_deletes` | Coachs historiques supprimés | tableau de noms |
| `params` | Réglages de charge : durées, plafonds, poids, seuils | objet |
| `grille_ninebox` | Critères et pondération de la nine box | objet |
| `grilles_audit` | Grilles d'audit hygiène et excellence opérationnelle | objet |
| `bonnes_pratiques` | Bonnes pratiques du réseau (photos, photo d'en-tête `entete` choisie parmi elles, J'aime d'origine) | tableau |
| `campagnes` | Liste des campagnes nationales (constats dans `suivi_magasins`) | objet `{ liste }` |
| `deploiements` | Thématiques suivies (état par magasin dans `suivi_magasins`) | objet `{ thematiques }` |
| `derniere_sauvegarde` | Date de la dernière sauvegarde complète | texte |

Clés de l'ancienne app encore en base (constaté le 21/10/2026) mais plus lues : `contacts`, `col_state`,
`cs_arrivees`, `initial_reassign_done`, `initial_reassign_v2`.

## Fonctions

Toutes en `SECURITY DEFINER`, appelables par les seuls comptes connectés, et refusent si le rôle ne convient pas.

| Domaine | Fonctions | Migration |
| --- | --- | --- |
| Rôle du compte | `mon_role`, `est_equipe`, `est_directeur`, `mon_acces`, `mes_magasins`, `mon_rr`, `mon_nom`, `ma_cle` | 0004, 0005, 0006 |
| Périmètre | `magasins_visibles`, `maj_perimetre_equipe`, `magasins_messagerie`, `peut_ecrire_magasin`, `franchise_de_mes_magasins` | 0005, 0006, 0015 |
| Accès franchisés | `ouvrir_acces_franchise`, `maj_acces_franchise`, `couper_acces_franchise`, `liste_acces_franchises` | 0004 |
| Accès de l'équipe | `ouvrir_acces_equipe`, `couper_acces_equipe`, `renommer_acces_coach`, `liste_acces_equipe` | 0005 |
| Espace franchisé | `espace_franchise` (sans les tâches de l'équipe seule depuis 0019), `reperes_reseau` (interne : médiane, quart supérieur et, depuis 0020, quart inférieur `quartBas`), `reperes_equipe` | 0004, 0005, 0019, 0020 |
| Actions du franchisé | `franchise_du_magasin`, `ajouter_action_franchise`, `marquer_action_franchise` (tâche de l'équipe seule introuvable, 0019) | 0007, 0019 |
| Messagerie | `messagerie`, `envoyer_message`, `envoyer_a`, `marquer_lu`, `marquer_lu_personne`, `supprimer_message`, `renommer_magasin_messages`, `pieces_propres` | 0006 |
| Échanges en groupe | `peut_inviter`, `creer_groupe`, `modifier_groupe`, `supprimer_groupe`, `quitter_groupe`, `peut_ecrire_fil`, `envoyer_fil`, `marquer_lu_fil`, `compte_lit_magasin` (interne) ; `messagerie` renvoie aussi les groupes (version 4) | 0018 |
| Communications | `communications`, `communication_visible`, `publier_communication`, `supprimer_communication`, `basculer_pouce_communication`, `commenter_communication`, `supprimer_commentaire_communication` | 0008 |
| Lecture des communications | `lire_communications` (franchisé), `lectures_communications` (Directeur, Responsable Régional pour ses magasins) | 0013 |
| Communication à la une | `mettre_a_la_une` (auteur ou Directeur, date entre aujourd'hui et un an), `a_la_une` (communications visibles encore à la une) | 0014 |
| Bonnes pratiques | `reactions_pratiques`, `pratique_visible`, `basculer_pouce_pratique`, `commenter_pratique`, `supprimer_commentaire_pratique` | 0010 |
| Comptes rendus de visite | `reactions_visites`, `visite_visible`, `basculer_pouce_visite`, `commenter_visite`, `supprimer_commentaire_visite` | 0022 |
| « Vu par » des bonnes pratiques | `lire_pratiques` (franchisé, pratiques existantes seulement), `lectures_pratiques` (Directeur, Responsable Régional pour les franchisés de ses magasins), `pratiques_existantes` (interne) | 0023 |
| Réunions et formations | `reunions_franchise` (avec type, heure et contenu depuis 0030), `repondre_reunion` (franchisé, ses magasins invités, réponse jusqu'au dernier jour) ; `presences_reunions`, `pointer_presence` (équipe, ses magasins, pointage dès le premier jour) | 0025, 0030 |
| Sondages | `publier_sondage` (Directeur ; RR sur ses magasins), `supprimer_question`, `resultats_questions` (Directeur ; RR pour ses magasins et sa région, relance des franchisés, Coachs et RR) ; `questions_franchise` (franchisé), `questions_equipe` (Coach ; RR pour les sondages du Directeur), `repondre_sondage` (une réponse par compte, à toutes les questions) ; `publier_question`, `repondre_question` (anciennes écritures d'une question seule) ; `magasins_questions`, `nom_rr`, `destinataire_sondage`, `destinataires_sondage`, `sondages_pour_moi`, `question_valable`, `reponse_valable` (internes) | 0026, 0029 |
| Propositions de bonnes pratiques | `proposer_pratique`, `mes_propositions` (franchisé, ses magasins) ; `propositions_pratiques`, `traiter_proposition` (équipe, ses magasins ; Directeur, tous) | 0027 |
| Challenges | `creer_challenge`, `supprimer_challenge` (Directeur ; RR sur ses magasins) ; `challenges_equipe` (équipe, chiffre de ses seuls magasins) ; `challenges_franchise` (rang et podium sans chiffre) ; `classement_challenge` (interne) | 0028 |
| Campagnes régionales | `campagne_region_permise` | 0005 |
| Fichiers | `photo_visible`, `piece_visible` (fichiers d'une tâche de l'équipe seule refusés au franchisé, 0019) | 0004, 0009, 0019 |
| Notifications | `abonner_appareil`, `desabonner_appareil` (compte connecté) ; `comptes_de_cle`, `notifications_a_envoyer`, `notifications_tache`, `notifications_une`, `notifications_animation`, `comptes_concernes` (fonction « notifier » seule) | 0016, 0024, 0030 |
| Outil | `json_sur` (lit un texte JSON sans jamais échouer) | 0004 |

## Fichiers (Supabase Storage)

| Espace | Contenu | Limite | Lecture |
| --- | --- | --- | --- |
| `photos` | Photos des visites, audits et bonnes pratiques (JPEG) | 5 Mo | équipe ; franchisé pour ses visites et les bonnes pratiques |
| `pieces` | Fichiers joints aux messages, tâches et communications (JPEG, PDF, Office, texte, CSV), rangés sous `<identifiant du compte>/…` | 10 Mo | auteur et qui voit l'élément qui les cite |

Les deux espaces sont privés : l'app lit les fichiers par liens temporaires.

## Points connus

- La liste des magasins est un texte JSON (`store_adds`) complété par trois couches (`store_renames`,
  `store_deletes`, `store_overrides`) ; il n'existe pas de table des magasins avec un identifiant stable.
- Depuis `0015`, les fiches des personnes ne sont plus lisibles par toute l'équipe. Restent visibles de toute
  l'équipe : le nom, le téléphone et le courriel du franchisé recopiés sur chaque magasin (`store_overrides.resp`,
  `tel_resp`, `email_resp`), lus par la carte et la liste de tout le réseau.
- L'app sait encore lire le suivi rangé dans `app_config` si `0005` n'a pas été passée (`src/data/suivi.ts`).
