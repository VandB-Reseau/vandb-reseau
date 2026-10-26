# Architecture

## Vue d'ensemble

```
Navigateur (PC, téléphone)
  └─ App React publiée sur GitHub Pages (fichiers statiques, HashRouter)
       └─ Supabase (aipodcpbakywbrrilaud)
            ├─ Auth : comptes connectés seulement, inscriptions fermées
            ├─ PostgreSQL : tables + règles d'accès + fonctions (supabase/migrations/)
            ├─ Storage : espaces privés « photos » et « pieces »
            ├─ Edge Function « notifier » : envoi des notifications sur le téléphone (supabase/functions/)
            └─ Edge Function « comptes » : création et suppression des comptes des franchisés, Directeur seul
```

Pas de serveur à nous (hormis les petites fonctions « notifier » et « comptes » hébergées par Supabase) : l'app parle directement à Supabase avec la clé publique (« anon »). La sécurité repose
entièrement sur la connexion et les règles de la base, jamais sur l'écran. Voir [base-de-donnees.md](base-de-donnees.md).

Services externes appelés depuis le navigateur, tous gratuits : Google Maps intégré (fiche magasin),
itinéraires routiers OSRM (charge des Coachs, tournées), géocodage geo.api.gouv.fr, dictée du navigateur.

## Pile

| Élément | Choix |
| --- | --- |
| Interface | React 19, TypeScript, MUI 9 (thème V and B : `src/theme/theme.ts`), icônes `@mui/icons-material` |
| Navigation | react-router en `HashRouter` (compatible GitHub Pages) |
| Carte | Leaflet |
| Fichiers Excel | ExcelJS (import / export des référentiels, sauvegarde) |
| Base | `@supabase/supabase-js` |
| Tests | Playwright (projets `pc` et `telephone`, Supabase simulé) + PostgreSQL local pour les migrations |
| Publication | GitHub Actions → GitHub Pages, seulement si tous les tests passent |

## Dossiers

| Dossier | Rôle |
| --- | --- |
| `src/pages/` | Un écran par fichier (Accueil, Magasins, FicheMagasin, Visites, SanteParc, Equipe…) |
| `src/components/` | Composants partagés (dialogues, listes, barres de filtres, états vides…) |
| `src/layout/AppShell.tsx` | Cadre : menu latéral sur PC, barre du bas sur téléphone, en-tête |
| `src/navigation/` | Destinations du menu, retour en haut de page |
| `src/auth/` | Connexion, rôles (`roles.ts`), droits d'écriture (`Droits.tsx`), « Voir comme » (`Apercu.tsx`) |
| `src/data/` | Accès aux données et règles métier (voir ci-dessous) |
| `src/lib/` | Outils techniques : client Supabase, photos, pièces jointes, dictée, cache, formats |
| `supabase/migrations/` | Schéma de la base, une migration numérotée par changement |
| `supabase/functions/notifier/` | Fonction Supabase d'envoi des notifications, à coller dans Edge Functions |
| `supabase/functions/comptes/` | Fonction Supabase de création, réinitialisation et suppression des comptes des franchisés (Directeur seul) |
| `supabase/functions/agenda/` | Fonction Supabase publique (sans « Verify JWT ») : agenda .ics relu par Google Agenda, lu par lien secret |
| `public/sw.js` | Service worker : affiche les notifications reçues et ouvre l'écran visé (aucun cache) |
| `supabase/tests/` | Rejoue les migrations sur un PostgreSQL vide et contrôle les règles d'accès |
| `tests/` | Tests Playwright ; `supabase-simule.ts` simule la base, `donnees-fictives.ts` le réseau de test |
| `docs/` | Cette documentation |

## Flux des données

1. **Connexion** (`src/auth/AuthContext.tsx`) : Supabase Auth, puis `mon_acces()` donne le rôle lu en base.
2. **Chargement** (`src/data/chargement.ts`, `chargerReseau`) : toutes les tables de l'équipe en une fois,
   lues avec les droits du compte (un Coach ne reçoit que ses magasins). Un franchisé reçoit à la place le
   résultat d'`espace_franchise()` (`src/data/espaceFranchise.ts`), au même format.
3. **Assemblage** (`assemblerReseau`, `src/data/construction.ts`) : les lignes brutes deviennent le modèle
   `Reseau` (`src/data/modele.ts`) : magasins avec renommages et fiches appliqués, Coach et RR à date, visites,
   chiffres, santé, suivi.
4. **Écrans** : lisent le réseau via `ReseauContext` ; le périmètre affiché suit le profil
   (`src/data/perimetre.ts`).
5. **Écritures** : fonctions de `chargement.ts` (une par geste) ; celles d'`app_config` et du suivi passent une par
   une pour qu'une saisie rapide n'en écrase pas une autre. Messagerie, communications, réactions et actions du franchisé passent
   par des fonctions de la base.

## Rôles

| Rôle | Voit | Écrit |
| --- | --- | --- |
| Directeur de réseau | tout | tout, dont les référentiels et Paramètres |
| Responsable Régional | carte et référentiels de tout le réseau ; visites, chiffres, suivi des magasins de ses Coachs et de ceux qu'il gère en direct | visites, chiffres, suivi de ses magasins, campagnes régionales, communications à ses magasins, agenda, messages |
| Coach | idem, pour ses magasins | visites, chiffres, suivi de ses magasins, bonnes pratiques, agenda, messages |
| Franchisé | ses magasins seulement, par `espace_franchise()` | ses actions, messages à l'équipe, J'aime et commentaires |

## Ajouter quelque chose

- **Un écran** : une page dans `src/pages/`, une destination dans `src/navigation/destinations.tsx`, les tests
  Playwright `pc` et `telephone`. Invisible au franchisé par défaut.
- **Une donnée par magasin** : une rubrique de `suivi_magasins` (migration qui élargit la contrainte), jamais
  une nouvelle clé d'`app_config`.
- **Une donnée à montrer au franchisé** : à ajouter dans `espace_franchise()` (nouvelle migration).
- **Une table ou une colonne** : nouvelle migration numérotée (voir [supabase/README.md](../supabase/README.md)),
  mise à jour de [base-de-donnees.md](base-de-donnees.md) et du [journal](../CHANGELOG.md), dans la même demande de fusion.
