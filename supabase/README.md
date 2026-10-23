# Base Supabase : migrations

Tout le schéma (tables, règles d'accès, fonctions, espaces de fichiers) est dans `migrations/`, une migration par
changement, numérotée dans l'ordre où elle s'applique. Carte du schéma : [docs/base-de-donnees.md](../docs/base-de-donnees.md).

| Migration | Contenu | Date |
| --- | --- | --- |
| `0001_tables_de_base` | 9 tables héritées de l'ancienne app (magasins, affectations, Coachs, visites, chiffres, agenda) | 14/10/2026 |
| `0002_visites_compte_rendu` | Compte rendu en parties et plan d'action des visites | 15/10/2026 |
| `0003_photos_audits` | Espace de fichiers `photos` | 15/10/2026 |
| `0004_acces_franchises` | Rôle lu en base, tables réservées à l'équipe, accès des franchisés | 19/10/2026 |
| `0005_cloisonnement_equipe` | Périmètre des Coachs et RR, `suivi_magasins`, référentiels au Directeur, accès de l'équipe, campagnes régionales, `espace_franchise()` | 19-20/10/2026 |
| `0006_messagerie` | Messagerie, échanges à deux, notifications | 19-20/10/2026 |
| `0007_actions_franchise` | Actions cochées et ajoutées par le franchisé | 20/10/2026 |
| `0008_communications` | Communications du réseau aux franchisés | 20/10/2026 |
| `0009_pieces_jointes` | Espace de fichiers `pieces` et qui peut lire quoi | 20/10/2026 |
| `0010_pratiques_reactions` | J'aime et commentaires des bonnes pratiques | 20/10/2026 |
| `0011_preparation_visites` | Rubrique `preparation` du suivi | 20/10/2026 |
| `0012_garde_fous_et_journal` | Retire toute règle « tout compte connecté », refuse de finir s'il en reste ; table `journal_migrations` | 21/10/2026 |
| `0013_lectures_communications` | Lecture des communications par les franchisés : table `communications_lectures`, fonctions `lire_communications` et `lectures_communications` | 21/10/2026 |
| `0014_communications_a_la_une` | Communication à la une : colonne `communications.a_la_une`, fonctions `mettre_a_la_une` et `a_la_une` | 21/10/2026 |
| `0015_fiches_personnes` | Fiches des personnes dans leur table : Directeur tout, Coach et RR l'équipe et les franchisés de leurs magasins ; reprise depuis `app_config`, clé retirée | 21/10/2026 |
| `0016_notifications_telephone` | Notifications sur le téléphone : tables `abonnements_push` et `cles_push` fermées, fonctions `abonner_appareil`, `desabonner_appareil`, `notifications_a_envoyer` ; puis déployer la fonction Supabase `notifier` (`supabase/functions/notifier/index.ts`) | 21/10/2026 |
| `0017_visites_prevues` | Colonne `visits.prevue` : une visite planifiée ne compte qu'une fois faite ; reprise : visites passées faites, visites à venir sans compte rendu prévues | 21/10/2026 |
| `0018_echanges_groupes` | Échanges en groupe : table `groupes` fermée, colonne `messages.groupe`, deux fils par magasin (« Avec le franchisé », « Équipe seule »), fonctions `creer_groupe`, `modifier_groupe`, `quitter_groupe`, `supprimer_groupe`, `envoyer_fil`, `marquer_lu_fil` ; `messagerie` et `notifications_a_envoyer` réécrites | 21/10/2026 |
| `0019_taches_equipe` | Tâche née dans « Équipe seule » (`fil` = `equipe`) cachée au franchisé : `espace_franchise`, `marquer_action_franchise`, `piece_visible` réécrites ; correction reportée dans 0005, 0007 et 0009 | 22/10/2026 |
| `0020_reperes_quartiles` | `reperes_reseau` renvoie aussi le quart inférieur (`quartBas`) de chaque indicateur, pour les leviers du CA | 22/10/2026 |
| `0021_preferences` | Table `preferences` : favoris, fiches récentes, vues enregistrées et canal Réseau de chaque compte de l'équipe ; chacun sa seule ligne, franchisé exclu | 22/10/2026 |
| `0022_reactions_visites` | Tables `visites_pouces` et `visites_commentaires` sans accès direct ; J'aime et commentaires des comptes rendus par fonctions, chacun sur les visites qu'il voit | 22/10/2026 |
| `0023_lectures_pratiques` | « Vu par » des bonnes pratiques : table `pratiques_lectures` sans accès direct, fonctions `lire_pratiques` (franchisé) et `lectures_pratiques` (Directeur, RR pour ses magasins) | 22/10/2026 |
| `0024_notifications_taches_une` | Notifications sur le téléphone d'une tâche confiée et d'une communication mise à la une : fonctions `notifications_tache` et `notifications_une` (fonction « notifier » seule) ; puis redéployer la fonction Supabase `notifier` | 23/10/2026 |
| `0025_reunions` | Réunions et formations : colonne `events.invites` (Directeur et RR seulement), table `reunions_presences` fermée, fonctions `reunions_franchise`, `repondre_reunion`, `presences_reunions`, `pointer_presence` | 23/10/2026 |
| `0026_questions_eclair` | Questions éclair : tables `questions_eclair`, `questions_participations`, `questions_reponses` fermées (anonymat en base), fonctions `publier_question`, `supprimer_question`, `resultats_questions`, `questions_franchise`, `repondre_question` | 23/10/2026 |
| `0027_pratiques_proposees` | Bonnes pratiques proposées par les franchisés : table `pratiques_proposees` fermée, fonctions `proposer_pratique`, `mes_propositions`, `propositions_pratiques`, `traiter_proposition` | 23/10/2026 |
| `0028_challenges` | Challenge du mois : table `challenges` fermée, classement calculé par la base (`classement_challenge`), fonctions `creer_challenge`, `supprimer_challenge`, `challenges_equipe`, `challenges_franchise` | 23/10/2026 |

## Règles

- **Réexécutable** : chaque migration peut être rejouée sans effet de bord (`IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP POLICY IF EXISTS` avant `CREATE POLICY`).
- **Ordre** : 0001 → dernière. Rejouer toute la suite remet la base dans l'état voulu ; rejouer une migration
  seule ne rouvre jamais un accès (vérifié par le test).
- **Nouvelle migration** pour tout changement : on ne modifie plus une migration déjà passée en ligne, sauf
  correction de sécurité signalée dans son en-tête. Nom : `NNNN_sujet_en_minuscules.sql`.
- **Journal** : chaque nouvelle migration se termine par l'ajout de sa ligne dans `journal_migrations`
  (`INSERT … ON CONFLICT (numero) DO UPDATE SET passee_le = now()`), pour savoir ce qui est passé en ligne.
- En-tête de chaque migration : objet, date et demande de fusion, migrations dont elle dépend, règles d'accès.
- Aucune donnée réelle : le dépôt est public. Les données de test sont fictives.

## Vérifier

```
npm run test:base
```

Crée un PostgreSQL vide en local, y ajoute le strict minimum de Supabase (`tests/supabase_minimal.sql`),
rejoue toutes les migrations deux fois, puis après avoir reproduit l'incident du 21/10/2026 (un ancien script
qui rouvrait tout), puis une fois dans l'ordre inverse, et contrôle les règles d'accès avec
des comptes fictifs (`tests/regles_acces.sql`) : Directeur, Coach, franchisé, compte sans rôle. Lancé aussi
par GitHub Actions avant chaque publication.

## Fonctions Supabase (Edge Functions)

| Fonction | Rôle | Déployer |
| --- | --- | --- |
| `notifier` | Notifications sur le téléphone | Après 0016 ; redéployer après 0024 |
| `comptes` | Comptes des franchisés créés, réinitialisés et supprimés depuis l'app (Directeur seul) | Sans migration (23/10/2026) |

Supabase > Edge Functions > Deploy a new function > Via Editor : nommer la fonction, coller `supabase/functions/<nom>/index.ts`,
Deploy. Laisser « Verify JWT » activé. La clé `service_role` est fournie par Supabase à la fonction, jamais à l'app.

## Passer une migration en ligne

Ne jamais repasser les anciens scripts hors dépôt (« Setup COMPLET », « verrouillage ») : ils remplacent toutes
les règles par « tout compte connecté ». Ils sont archivés dans le dossier du projet.


Supabase > SQL Editor > coller le fichier > Run. La dernière requête de certaines migrations affiche un contrôle.
Noter la migration passée dans le [journal](../CHANGELOG.md) (colonne « Base »).
