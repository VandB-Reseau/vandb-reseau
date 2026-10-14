# V and B Réseau — consignes pour Claude

Référence produit : `/mnt/project-files/cadrage/refonte_app_cadrage.md` (vision, décisions de Joseph, plan de sprints). La lire avant tout chantier.

## Pile
React 19 + TypeScript + MUI 9 (thème `src/theme/theme.ts`), react-router (HashRouter, compatible GitHub Pages), Supabase, Playwright.

## Règles
- Français partout dans l'interface. Vocabulaire : Coach, RR / Responsable Régional, Directeur de réseau, magasin, Franchisé (remplace « Responsable magasin » depuis le 14/10/2026 ; « Responsable du magasin » seulement pour un magasin intégré). Plus d'adjoint ni de plateforme logistique à l'écran (données conservées en base). Pas d'abréviation non expliquée, jamais « CS » ni « DR ».
- Aucun texte sous 12 px, zones tactiles ≥ 48 px sur téléphone (vérifié par les tests).
- Icônes `@mui/icons-material` uniquement, pas d'emojis.
- Pas de texte d'explication de l'outil dans l'interface (choix de Joseph, 14/10/2026) : ni mode d'emploi, ni « clique sur… ».
- Aucune erreur technique à l'écran : messages humains, états vides qui expliquent et proposent l'action.
- Aucune ressource externe bloquante (polices et icônes embarquées).
- PC = usage principal (menu latéral, tableaux complets) ; téléphone soigné (barre basse).
- Rôles prévus (`src/auth/roles.ts`) : directeur, rr, coach. Aujourd'hui seul Joseph (directeur) a un compte.
- Chaque fonctionnalité livrée a ses tests Playwright sur les projets `pc` et `telephone`, avec Supabase simulé (`tests/supabase-simule.ts`).

- Dépôt **public** (choix de Joseph, 14/10/2026) : aucune donnée réelle ni clé dans le dépôt. Tests avec données fictives uniquement. Clé Supabase fournie par le secret GitHub `VITE_SUPABASE_ANON_KEY`.

- Charte graphique officielle V and B : `/mnt/project-files/charte/V_and_B_Guideline_charte.pdf` (hors dépôt).

## Commandes
- `npm run dev` : développement
- `npm run build` : vérification TypeScript + construction
- `npm test` : tests navigateur (PC + téléphone), captures dans `captures/`
