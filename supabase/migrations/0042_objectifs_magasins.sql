-- ════════════════════════════════════════════════════════════════
-- V and B — Objectifs chiffrés par magasin (10/11/2026, refonte vague 3, 26A)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0005 (suivi_magasins) et 0038 (rubriques « concurrence » et
-- « mot_franchise »).
--
-- Une rubrique de plus dans suivi_magasins : « objectifs », une ligne par magasin, liste de
--   { id, indicateur (pmCave, fluxCave, caCave, pmBar, fluxBar, caBar, caExt, marge), mode (valeur | evolution),
--     depart, moisDepart (AAAA-MM), cible, echeance (AAAA-MM), taches (clés des tâches rattachées), par, creeLe,
--     visite, clos }
-- L'avancement n'est pas rangé : l'app le lit dans les chiffres de la caisse (chiffres_mensuels()).
-- Même cloisonnement que le reste du suivi : le Directeur partout, un Coach ou un RR sur ses magasins ; jamais
-- renvoyée au franchisé (espace_franchise() ne lit pas cette rubrique). Notée dans historique_modifications.
-- ════════════════════════════════════════════════════════════════

-- Retire l'ancienne liste des rubriques, quel que soit le nom donné à la contrainte
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise', 'objectifs'));

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0042', 'objectifs_magasins')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
