# Tests et intégration continue

## Les trois familles de tests

| Commande | Ce qu'elle vérifie | Durée locale |
| --- | --- | --- |
| `npm run test:base` | Toutes les migrations (`supabase/migrations/` et `supabase/migrations/pilotage/`) rejouées sur un PostgreSQL local vide, puis les règles d'accès avec des comptes fictifs | ≈ 30 s |
| `npx playwright test --project=moteur` | Le moteur de calcul du budget (`src/pilotage/moteur/`), sur un magasin fictif dont chaque résultat a été vérifié à la main (`tests/pilotage/moteur/`) | quelques secondes |
| `npm test` | Tous les écrans dans un vrai navigateur, sur PC (1440 × 900) et téléphone (Pixel 7), avec une base Supabase simulée | 20 à 40 min |

Pendant un développement, on lance seulement les fichiers touchés :

```
npx playwright test tests/budgets.spec.ts --project=pc --project=telephone
CHROMIUM=/chemin/vers/chrome npx playwright test …   # navigateur déjà installé, sans téléchargement
```

### Contrôle de la base (`supabase/tests/verifier.sh`)

Il monte trois bases locales :

1. **app seule** : les migrations de `supabase/migrations/`, deux fois (elles doivent être réexécutables), après
   reproduction de l'incident du 21/10/2026 (un ancien script qui rouvrait tout, `ancien_verrouillage.sql`), puis
   chacune seule dans l'ordre inverse (rien ne doit se rouvrir) ; enfin les contrôles de `regles_acces.sql` ;
2. **pilotage seul** : les fonctions de l'app dont il dépend (`pilotage/dependances_reseau.sql`), l'historique
   `supabase/migrations/pilotage/`, puis les contrôles de `pilotage/regles_acces.sql` ;
3. **les deux ensemble**, dans l'ordre de passage en ligne (app jusqu'à 0038, pilotage, app 0039 et suivantes) : prouve
   que les deux séries cohabitent dans la même base.

Il faut PostgreSQL 16 installé localement (`PG_BIN` pour indiquer son dossier). Aucun accès réseau.

Un nouvel accès ou une nouvelle règle = un contrôle ajouté dans `regles_acces.sql` (schéma public) ou
`pilotage/regles_acces.sql` (schéma `pilotage`), avec la fonction `pg_temp.attendre(libellé, obtenu, attendu)`.

### Tests navigateur

- `tests/supabase-simule.ts` remplace la base : chaque test pose ses données fictives (`tests/donnees-fictives.ts`)
  et un rôle. Le pilotage a la sienne (`tests/pilotage/supabase-simule.ts`, `simulerPilotage` après `simulerSupabase`).
- Date figée au **27/10/2026 à 10 h** (`tests/horloge.ts`), dans le test comme dans la page : les données fictives ne
  vieillissent pas.
- Chaque fonctionnalité a ses tests sur `pc` **et** `telephone`. Contrôles transverses vérifiés partout : aucun texte
  sous 12 px, zones tactiles ≥ 48 px sur téléphone, aucune erreur technique affichée.
- Les captures d'écran vont dans `captures/` (ignoré par Git), seulement quand un test les demande.

## Intégration continue (`.github/workflows/publier.yml`)

| Événement | Ce qui tourne | Mise en ligne |
| --- | --- | --- |
| Demande de fusion (pull request) | base, construction, **toute** la suite Playwright | non |
| Fusion dans `main` | base et construction seulement (la suite complète a déjà tourné sur la demande de fusion, choix du 16/11/2026) | oui, environ 2 min après la fusion |
| Lancement manuel (Actions › Tester et publier › Run workflow) | base, construction, et seulement les tests indiqués dans le champ « tests » (vide = toute la suite) | oui si lancé sur `main` |

Points à connaître :

- Une demande de fusion en conflit avec `main` (souvent `CHANGELOG.md`) ne lance pas sa CI : régler le conflit d'abord.
- Quelques tests téléphone sont connus pour être instables (zones tactiles mesurées pendant une animation, notamment
  `refonte-saas-3` 24A). Relancer le seul test en échec avant de chercher plus loin ; s'il échoue deux fois, c'est un
  vrai problème.
- Le secret `VITE_SUPABASE_ANON_KEY` (clé publique Supabase) est fourni à la construction ; les tests n'appellent
  jamais la vraie base.
