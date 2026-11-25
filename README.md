# V and B Réseau

Application web de pilotage du réseau V and B (franchise cave-bar, environ 280 magasins) : magasins, équipe, visites,
santé du parc, échanges avec les franchisés, et pilotage financier (budgets, réel de caisse, trésorerie, simulateurs).
Utilisée par le Directeur de réseau, les Responsables Régionaux (RR), les Coachs et les franchisés, surtout sur PC,
aussi sur téléphone.

En ligne : https://vandb-reseau.github.io/vandb-reseau/ (publiée à chaque fusion dans `main`).

Depuis le 25/11/2026, ce dépôt contient **tout** le projet : l'ancien dépôt `VandB-Reseau/vandb-pilotage` n'est plus
qu'une page de renvoi (son ancienne adresse mène à la même page ici) et ses migrations sont dans
`supabase/migrations/pilotage/`.

## Démarrer en 10 minutes

Prérequis : Node 22, PostgreSQL 16 (pour le contrôle de la base), un navigateur Chromium (Playwright l'installe).

```
npm ci
cp .env.example .env.local   # URL et clé publique Supabase (la clé « anon », publique par conception)
npm run dev                  # développement, http://localhost:5173/
npm run build                # vérification TypeScript + construction
npm run test:base            # migrations rejouées sur un PostgreSQL local, règles d'accès contrôlées (≈ 30 s)
npx playwright test --project=moteur    # moteur de calcul du budget (quelques secondes)
npm test                     # tous les écrans, PC + téléphone, base simulée (long : lancer les fichiers touchés)
```

## Pile

React 19, TypeScript, MUI 9, react-router (HashRouter), Supabase (PostgreSQL, Auth, Storage, Edge Functions),
Playwright. Site statique sur GitHub Pages : pas de serveur à nous, toute la sécurité est dans les règles de la base.

## Où trouver quoi

| Dossier | Contenu |
| --- | --- |
| `src/pages/`, `src/components/`, `src/data/` | App du réseau : écrans, composants, accès aux données |
| `src/pilotage/` | Pilotage financier : budgets, suivi, saisies, imports, simulateurs ; moteur de calcul pur dans `src/pilotage/moteur/` |
| `supabase/migrations/` | Série unique des migrations (prochaine libre : **0055**) ; `pilotage/` = historique figé du schéma `pilotage` |
| `supabase/functions/` | Fonctions Supabase (notifications, comptes des franchisés, agenda) |
| `supabase/tests/` | Contrôle de la base (`verifier.sh`) |
| `tests/` | Tests Playwright (`tests/pilotage/` pour le pilotage financier) |
| `docs/` | Documentation (ci-dessous) |

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Pile, dossiers, flux des données, rôles, comment ajouter un écran ou une donnée |
| [docs/regles-metier.md](docs/regles-metier.md) | Décisions métier à respecter (rôles, CA, budget, trésorerie, simulateurs, écrans) |
| [docs/base-de-donnees.md](docs/base-de-donnees.md) | Schéma `public` : tables, clés d'`app_config`, fonctions, fichiers, règles d'accès |
| [docs/base-pilotage.md](docs/base-pilotage.md) | Schéma `pilotage` : budgets, réel, frais, équipe, formats des hypothèses |
| [docs/import-caisse.md](docs/import-caisse.md) | Format des fichiers de caisse importés chaque mois |
| [supabase/README.md](supabase/README.md) | Liste des migrations, règles d'écriture, fonctions Supabase |
| [docs/deploiement.md](docs/deploiement.md) | Mise en ligne, passage d'une migration, réglages GitHub et Supabase, retour arrière |
| [docs/tests-et-ci.md](docs/tests-et-ci.md) | Les trois familles de tests et ce que fait la CI |
| [CHANGELOG.md](CHANGELOG.md) | Journal des versions, avec les migrations à passer |
| [CLAUDE.md](CLAUDE.md) | Conventions de l'interface et du code (lues aussi par l'assistant de code) |

## Travailler sur le projet

1. Une branche par lot, une demande de fusion vers `main` (modèle de description fourni).
2. Dans la même demande : la ligne du `CHANGELOG.md` (section « À venir »), les tests `pc` et `telephone`, et pour
   un changement de base une **nouvelle** migration réexécutable + `docs/base-*.md` à jour + contrôle d'accès si un
   accès change.
3. La CI doit être verte ; après fusion, l'app est en ligne en 2 minutes. La migration éventuelle se passe à la main
   dans Supabase ([docs/deploiement.md](docs/deploiement.md)).

Le Directeur de réseau (Joseph Perreau) décide du produit : les choix sont datés dans `CLAUDE.md`,
`docs/regles-metier.md` et le `CHANGELOG.md`.

## Données

Dépôt **public** : aucune donnée réelle (chiffres de magasins, Excel prévisionnels, exports de caisse) ni clé secrète.
Les tests utilisent un réseau fictif. La clé Supabase publique est fournie à la publication par le secret GitHub
`VITE_SUPABASE_ANON_KEY`.
