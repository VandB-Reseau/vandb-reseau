# Base de données

Base Supabase (PostgreSQL) du projet `aipodcpbakywbrrilaud`. Le schéma est entièrement décrit par les
migrations de [`supabase/migrations/`](../supabase/migrations) ; ce document en donne la carte.
Mode d'emploi des migrations : [`supabase/README.md`](../supabase/README.md).

Mis à jour le 21/10/2026 (migration `0013`).

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

### Données par magasin (Directeur : tout ; Coach et RR : leurs magasins)

| Table | Contenu | Clé |
| --- | --- | --- |
| `visits` | Visites, appels, audits. `visitor` = participants séparés par « , » ; `sections` = compte rendu en 10 parties ; `action_plan` = plan d'action ; `docs` = photos et liens ; `group_id` relie une tournée | `id` |
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
| `actions` | Actions hors visite | `actions` |
| `deploiements` | État et journal des thématiques déployées | `deploiements` (partie magasin) |
| `constats` | Constats de campagne | `campagnes` (partie constats) |
| `preparation` | Prochaine visite : date, heure, notes | `preparations_visites` |

Ajouter une rubrique = une migration qui remplace la contrainte (modèle : `0011_preparation_visites.sql`).

### Agenda (toute l'équipe lit et écrit)

| Table | Contenu |
| --- | --- |
| `events` | Événements : réunions, séminaires |
| `leaves` | Congés d'un Coach (`role` = `cs`) ou d'un RR (`dr`) |

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
| `messages` | Messages : à deux (`destinataire`), ou anciens messages par magasin (`store`, `lot`, `equipe`) ; `pieces` = fichiers joints |
| `messages_lus` | Dernière lecture de chaque compte, par magasin ou personne et par sujet |
| `communications` | Communications du réseau ; `magasins` vide = tout le réseau ; `html` = version mise en forme |
| `communications_pouces`, `communications_commentaires` | J'aime et commentaires des communications |
| `communications_lectures` | Première lecture d'une communication par chaque compte franchisé |
| `pratiques_pouces`, `pratiques_commentaires` | J'aime et commentaires des bonnes pratiques |

## Clés d'`app_config`

| Clé | Contenu | Forme |
| --- | --- | --- |
| `store_adds` | **Liste des magasins** (nom `n`, département, ouverture, adresse, position…) | tableau |
| `store_renames` | Renommages : ancien nom → nouveau nom | objet |
| `store_deletes` | Magasins retirés (fichier de base de l'ancienne app seulement) | tableau de noms |
| `drs_data` | Directeur (`directeur`), RR (`drs`), RR de chaque Coach (`cs_dr`) et ses changements datés (`dr_assigns`) | objet |
| `cs_deletes` | Coachs historiques supprimés | tableau de noms |
| `fiches_personnes` | Fiches personnelles (Directeur, RR, Coachs, franchisés) : coordonnées, dates | objet |
| `params` | Réglages de charge : durées, plafonds, poids, seuils | objet |
| `grille_ninebox` | Critères et pondération de la nine box | objet |
| `grilles_audit` | Grilles d'audit hygiène et excellence opérationnelle | objet |
| `bonnes_pratiques` | Bonnes pratiques du réseau (photos, J'aime d'origine) | tableau |
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
| Périmètre | `magasins_visibles`, `maj_perimetre_equipe`, `magasins_messagerie`, `peut_ecrire_magasin` | 0005, 0006 |
| Accès franchisés | `ouvrir_acces_franchise`, `maj_acces_franchise`, `couper_acces_franchise`, `liste_acces_franchises` | 0004 |
| Accès de l'équipe | `ouvrir_acces_equipe`, `couper_acces_equipe`, `renommer_acces_coach`, `liste_acces_equipe` | 0005 |
| Espace franchisé | `espace_franchise`, `reperes_reseau` (interne), `reperes_equipe` | 0004, 0005 |
| Actions du franchisé | `franchise_du_magasin`, `ajouter_action_franchise`, `marquer_action_franchise` | 0007 |
| Messagerie | `messagerie`, `envoyer_message`, `envoyer_a`, `marquer_lu`, `marquer_lu_personne`, `supprimer_message`, `renommer_magasin_messages`, `pieces_propres` | 0006 |
| Communications | `communications`, `communication_visible`, `publier_communication`, `supprimer_communication`, `basculer_pouce_communication`, `commenter_communication`, `supprimer_commentaire_communication` | 0008 |
| Lecture des communications | `lire_communications` (franchisé), `lectures_communications` (Directeur, Responsable Régional pour ses magasins) | 0013 |
| Bonnes pratiques | `reactions_pratiques`, `pratique_visible`, `basculer_pouce_pratique`, `commenter_pratique`, `supprimer_commentaire_pratique` | 0010 |
| Campagnes régionales | `campagne_region_permise` | 0005 |
| Fichiers | `photo_visible`, `piece_visible` | 0004, 0009 |
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
- `fiches_personnes` (coordonnées des franchisés comprises) est lisible par toute l'équipe.
- L'app sait encore lire le suivi rangé dans `app_config` si `0005` n'a pas été passée (`src/data/suivi.ts`).
