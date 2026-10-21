-- ════════════════════════════════════════════════════════════════
-- V and B — Préparation des visites (notes et heure de la prochaine visite)
-- 20/10/2026 (PR #65). Réexécutable. Suppose 0005.
--
-- Une ligne par magasin dans suivi_magasins, rubrique « preparation » :
-- même cloisonnement que le journal (un Coach ou un RR ne lit et n'écrit que ses magasins),
-- jamais renvoyée au franchisé (espace_franchise() ne lit pas suivi_magasins).
-- ════════════════════════════════════════════════════════════════

-- Retire l'ancienne liste des rubriques, quel que soit le nom donné à la contrainte
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation'));
