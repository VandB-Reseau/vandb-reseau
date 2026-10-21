# V and B Réseau

Application web de pilotage du réseau V and B : magasins, équipe, visites, santé du parc, échanges avec les
franchisés. Utilisée par le Directeur de réseau, les Responsables Régionaux, les Coachs et les franchisés,
sur PC et sur téléphone.

En ligne : https://vandb-reseau.github.io/vandb-reseau/ (publiée à chaque modification de `main`,
seulement si tous les tests passent).

## Démarrer

```
npm ci
cp .env.example .env.local   # URL et clé publique Supabase
npm run dev                  # développement
npm run build                # vérification TypeScript + construction
npm test                     # tests navigateur PC + téléphone, Supabase simulé, captures dans captures/
npm run test:base            # migrations rejouées sur un PostgreSQL local, règles d'accès contrôlées
```

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Pile, dossiers, flux des données, rôles, comment ajouter un écran ou une donnée |
| [docs/base-de-donnees.md](docs/base-de-donnees.md) | Tables, clés d'`app_config`, fonctions, fichiers, règles d'accès |
| [supabase/README.md](supabase/README.md) | Migrations : liste, règles d'écriture, vérification, mise en ligne |
| [CHANGELOG.md](CHANGELOG.md) | Journal des versions, sprint par sprint |
| [CLAUDE.md](CLAUDE.md) | Conventions de l'interface et du code |

## Données

Dépôt public : aucune donnée réelle ni clé secrète. Les tests utilisent un réseau fictif. La clé Supabase
publique est fournie à la publication par le secret GitHub `VITE_SUPABASE_ANON_KEY`.
