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

## Règles

- **Réexécutable** : chaque migration peut être rejouée sans effet de bord (`IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP POLICY IF EXISTS` avant `CREATE POLICY`).
- **Ordre** : 0001 → dernière. Rejouer toute la suite remet la base dans l'état voulu ; rejouer une migration
  seule ne rouvre jamais un accès (vérifié par le test).
- **Nouvelle migration** pour tout changement : on ne modifie plus une migration déjà passée en ligne, sauf
  correction de sécurité signalée dans son en-tête. Nom : `NNNN_sujet_en_minuscules.sql`.
- En-tête de chaque migration : objet, date et demande de fusion, migrations dont elle dépend, règles d'accès.
- Aucune donnée réelle : le dépôt est public. Les données de test sont fictives.

## Vérifier

```
npm run test:base
```

Crée un PostgreSQL vide en local, y ajoute le strict minimum de Supabase (`tests/supabase_minimal.sql`),
rejoue toutes les migrations deux fois, puis une fois dans l'ordre inverse, et contrôle les règles d'accès avec
des comptes fictifs (`tests/regles_acces.sql`) : Directeur, Coach, franchisé, compte sans rôle. Lancé aussi
par GitHub Actions avant chaque publication.

## Passer une migration en ligne

Supabase > SQL Editor > coller le fichier > Run. La dernière requête de certaines migrations affiche un contrôle.
Noter la migration passée dans le [journal](../CHANGELOG.md) (colonne « Base »).
