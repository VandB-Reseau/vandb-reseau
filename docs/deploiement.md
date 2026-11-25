# Mise en ligne et migrations

Il n'y a pas de serveur à administrer : l'app est un site statique sur GitHub Pages qui parle directement à Supabase.
Mettre en ligne, c'est fusionner dans `main` ; changer la base, c'est passer une migration à la main dans Supabase.

## Où vit quoi

| Élément | Où |
| --- | --- |
| Code de l'app (réseau + pilotage financier) | ce dépôt, `VandB-Reseau/vandb-reseau` |
| App en ligne | https://vandb-reseau.github.io/vandb-reseau/ (GitHub Pages, publiée par Actions) |
| Base, comptes, fichiers, fonctions | projet Supabase `aipodcpbakywbrrilaud` (schémas `public` et `pilotage`) |
| Ancienne adresse du pilotage | https://vandb-reseau.github.io/vandb-pilotage/ : page de renvoi vers la même page de l'app, publiée par le dépôt `VandB-Reseau/vandb-pilotage` (réduit à ce renvoi le 25/11/2026) |
| Données réelles (Excel prévisionnels, exports de caisse, charte) | hors dépôt, dans le dossier partagé du projet : le dépôt est public |

## Mettre en ligne une modification

1. Une branche, une demande de fusion vers `main`. Le modèle de description (`.github/pull_request_template.md`) rappelle
   les points à cocher : `CHANGELOG.md` (section « À venir »), migration éventuelle, tests `pc` et `telephone`.
2. La CI repasse la base, la construction et toute la suite de tests ([tests-et-ci.md](tests-et-ci.md)).
3. Après fusion, la publication part seule (environ 2 min). Elle n'a lieu que si la base et la construction passent.
4. **S'il y a une migration**, la passer dans Supabase (ci-dessous) au moment de la fusion : avant si la nouvelle version
   de l'app en a besoin pour s'ouvrir, sinon juste après. Le `CHANGELOG.md` dit laquelle passer.

Revenir en arrière : « Revert » de la demande de fusion sur GitHub, puis fusionner ce retour (la publication repart). Une
migration ne se défait pas par un retour de code : écrire une nouvelle migration qui corrige.

## Passer une migration

1. Supabase › SQL Editor › New query : coller **tout** le fichier `supabase/migrations/NNNN_sujet.sql`, Run.
2. La dernière requête affiche parfois un contrôle. En cas d'erreur, s'arrêter et lire l'en-tête de la migration avant
   de relancer.
3. Vérifier : `SELECT * FROM public.journal_migrations ORDER BY numero DESC LIMIT 5;`
4. Noter dans le fil du projet la migration passée et l'heure.

Règles :

- Toujours dans l'ordre des numéros. Les migrations sont réexécutables : en repasser une ne casse rien et ne rouvre
  jamais un accès.
- **Ne jamais repasser** les anciens scripts hors dépôt (« Setup COMPLET », « verrouillage ») : ils rouvraient tout.
- Historique du pilotage (`supabase/migrations/pilotage/0001` à `0038`) : déjà passé en ligne, à ne repasser que pour
  reconstruire une base vide (après la série de l'app jusqu'à 0038, avant 0039). Son journal est `pilotage.journal_migrations`.
- Si une migration ajoute une fonction appelée par une fonction Supabase (notifications), redéployer cette fonction.

## Fonctions Supabase (Edge Functions)

Dans `supabase/functions/` : `notifier` (notifications sur le téléphone), `comptes` (comptes des franchisés, Directeur
seul), `agenda` (agenda .ics lu par Google Agenda). Déployer : Supabase › Edge Functions › la fonction › coller
`index.ts` › Deploy. « Verify JWT » reste coché, sauf pour `agenda`. Détail : [supabase/README.md](../supabase/README.md).

## Réglages faits une fois (à refaire seulement pour un nouveau projet)

- GitHub › Settings › Pages : source « GitHub Actions » ; branche par défaut `main`.
- GitHub › Settings › Secrets and variables › Actions : `VITE_SUPABASE_ANON_KEY` (clé « anon » publique du projet
  Supabase ; la sécurité repose sur la connexion et les règles de la base, jamais sur cette clé).
- Supabase › Integrations › Data API › Exposed schemas : `public` et `pilotage`.
- Supabase › Authentication : inscriptions fermées (les comptes sont créés depuis l'app par le Directeur).
- Fonction `notifier` : clés d'envoi des notifications rangées dans la table fermée `cles_push` (voir 0016).

## Développer en local

```
npm ci
cp .env.example .env.local   # URL du projet + clé « anon »
npm run dev
```

L'app locale lit la vraie base avec le compte avec lequel on se connecte : utiliser un compte de test, jamais un compte
de franchisé réel pour essayer une écriture.
