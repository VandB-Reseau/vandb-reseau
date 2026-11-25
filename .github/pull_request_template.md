## Ce qui change

<!-- En deux ou trois phrases, ce que l'utilisateur voit de nouveau, et la demande d'origine (date, numéros de propositions). -->

## Base de données

<!-- « Sans migration », ou le fichier à passer dans Supabase (supabase/migrations/NNNN_sujet.sql) et quand :
     avant ou après la fusion. Voir docs/deploiement.md. -->

## À vérifier

- [ ] Ligne ajoutée dans `CHANGELOG.md` (« À venir »), avec la migration s'il y en a une
- [ ] Tests Playwright sur `pc` et `telephone` pour ce qui change
- [ ] Migration nouvelle, réexécutable, ligne dans `public.journal_migrations`, `docs/base-*.md` à jour, `npm run test:base` vert
- [ ] Contrôle d'accès ajouté si un accès change
- [ ] Décision métier nouvelle notée dans `docs/regles-metier.md`
- [ ] Aucune donnée réelle ni clé
