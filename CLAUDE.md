# V and B Réseau — consignes pour Claude

Référence produit : `/mnt/project-files/cadrage/refonte_app_cadrage.md` (vision, décisions de Joseph, plan de sprints). La lire avant tout chantier.

## Pile
React 19 + TypeScript + MUI 9 (thème `src/theme/theme.ts`), react-router (HashRouter, compatible GitHub Pages), Supabase, Playwright.

## Règles
- Français partout dans l'interface. Vocabulaire : Coach, RR / Responsable Régional, Directeur de réseau, magasin, Franchisé (remplace « Responsable magasin » depuis le 14/10/2026 ; plus de « Responsable du magasin » depuis le 26/10/2026 : un intégré a ses Associés). Plus d'adjoint ni de plateforme logistique à l'écran (données conservées en base). Pas d'abréviation non expliquée, jamais « CS » ni « DR ».
- Aucun texte sous 12 px, zones tactiles ≥ 48 px sur téléphone (vérifié par les tests).
- Icônes `@mui/icons-material` uniquement, pas d'emojis.
- Pas de texte d'explication de l'outil dans l'interface (choix de Joseph, 14/10/2026) : ni mode d'emploi, ni « clique sur… ».
- Aucune erreur technique à l'écran : messages humains, états vides qui expliquent et proposent l'action.
- Aucune ressource externe bloquante (polices et icônes embarquées).
- PC = usage principal (menu latéral, tableaux complets) ; téléphone soigné (barre basse).
- Rôles (`src/auth/roles.ts`) : directeur, rr, coach (l'équipe) et franchise. Le rôle est lu dans la base (`mon_acces`), pas seulement dans le jeton. Un franchisé ne lit aucune table : la fonction `espace_franchise()` lui renvoie ses magasins (migrations `0004_acces_franchises.sql` et `0005_cloisonnement_equipe.sql`). Tout nouvel écran de l'équipe reste invisible au franchisé ; toute nouvelle donnée à lui montrer passe par cette fonction.
- Coach et RR : la base ne leur renvoie que les visites, chiffres et suivi de leurs magasins (table `perimetre_equipe` tenue par l'app du Directeur, script `supabase/migrations/0005_cloisonnement_equipe.sql`). Toute nouvelle donnée rangée par magasin va dans `suivi_magasins` (une ligne par magasin et par rubrique), jamais dans une clé d'`app_config`. Pas de Paramètres pour eux.
- Référentiels (liste des magasins, affectations, équipe, fiches des personnes, campagnes, thématiques, grilles, réglages) : écrits par le Directeur seul, en base comme à l'écran (`useDroits().referentiels`, `src/auth/Droits.tsx`). Le Coach et le RR écrivent visites, chiffres, suivi de leurs magasins (santé comprise), bonnes pratiques, agenda et messages. Accès de l'équipe ouverts depuis la fiche du Coach ou du RR ; « Voir comme » reprend le profil de la personne (`ProfilVu`).
- Base de données : tout changement (table, colonne, règle, fonction, rubrique de `suivi_magasins`) = une **nouvelle** migration `supabase/migrations/NNNN_sujet.sql`, réexécutable, sans jamais rouvrir un accès si elle est rejouée seule ; on ne modifie pas une migration déjà passée en ligne. Dans la même demande de fusion : `docs/base-de-donnees.md` à jour, contrôle ajouté dans `supabase/tests/regles_acces.sql` si un accès change, `npm run test:base` vert. Aucune règle « tout compte connecté » (`USING (true)`). Chaque migration ajoute sa ligne dans `journal_migrations`. Ne jamais faire repasser les anciens scripts hors dépôt (« Setup COMPLET », « verrouillage »).
- Journal : chaque demande de fusion ajoute sa ligne dans `CHANGELOG.md` (section « À venir », puis rangée sous son sprint), avec la migration à passer s'il y en a une.
- Chaque fonctionnalité livrée a ses tests Playwright sur les projets `pc` et `telephone`, avec Supabase simulé (`tests/supabase-simule.ts`).
- Date des tests figée au 27/10/2026 à 10 h (`tests/horloge.ts`), côté test et dans la page : les données fictives ne vieillissent plus. Une date posée par `addInitScript` se calcule côté test et se passe en argument.

- Dépôt **public** (choix de Joseph, 14/10/2026) : aucune donnée réelle ni clé dans le dépôt. Tests avec données fictives uniquement. Clé Supabase fournie par le secret GitHub `VITE_SUPABASE_ANON_KEY`.

- Charte graphique officielle V and B : `/mnt/project-files/charte/V_and_B_Guideline_charte.pdf` (hors dépôt).

## Pilotage financier (`src/pilotage/`, fusion du 03/11/2026)
- Venu de l'app « V and B Pilotage » (dépôt `VandB-Reseau/vandb-pilotage`, figé à la fusion). Menu « Budgets », onglet
  « Budget » de la fiche magasin (équipe et franchisé), espace du contrôle de gestion. Ses données sont dans le schéma
  `pilotage` de la même base ; ses migrations restent pour l'instant dans le dépôt du pilotage (`supabase/migrations/`).
- Règles propres : montants HT dans tous les calculs (TTC pour la trésorerie et les paniers saisis) ; redevance 2 % et
  publicité 1 % du CA HT, au-dessus de l'EBE ; tout calcul financier passe par le moteur pur `src/pilotage/moteur/`,
  testé dans `tests/pilotage/moteur/` (projet Playwright `moteur`). L'aide s'ouvre seulement par l'icône (i)
  (`src/pilotage/components/Aide.tsx`, textes dans `src/pilotage/lib/aide.ts`).
- Accès du franchisé (exception écrite à la règle d'`espace_franchise()`) : dans le schéma `pilotage`, il lit et écrit
  les lignes de ses magasins (`pilotage.mes_magasins()`), chaque règle contrôlée dans les tests de la base du pilotage ;
  médianes et comparaisons du réseau ne lui arrivent jamais (`budgets_du_compte()` les retire).
- Une seule liste de tâches (04/11/2026) : le plan d'action du budget lit et crée des tâches du réseau (`suivi_magasins`,
  rubrique `actions`, champ `budget` pour la mesure), via `src/pilotage/data/taches.ts` ; `pilotage.actions` n'est plus écrite.
- « Voir comme » ne montre pas le budget (les chiffres viendraient des droits du Directeur) : écran « pas en aperçu ».
- Tests navigateur dans `tests/pilotage/` : `simulerPilotage` (schéma `pilotage`) s'appelle après `simulerSupabase`.

## Documentation
- `docs/architecture.md` (pile, dossiers, flux, rôles), `docs/base-de-donnees.md` (schéma), `supabase/README.md` (migrations), `CHANGELOG.md` (sprints). Les lire avant de toucher à la base.

## Commandes
- `npm run dev` : développement
- `npm run build` : vérification TypeScript + construction
- `npm test` : tests navigateur (PC + téléphone), captures dans `captures/`
- `npm run test:base` : migrations rejouées sur un PostgreSQL local, règles d'accès contrôlées
