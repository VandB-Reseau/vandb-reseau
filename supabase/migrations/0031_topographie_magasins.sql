-- ════════════════════════════════════════════════════════════════
-- V and B — Blason de ville : topographie de chaque magasin (23/10/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0001 (store_overrides) et 0012 (journal).
--
-- Le blason d'un magasin (charte graphique V and B) prend une forme selon la topographie de sa ville :
-- littoral, montagne ou terres. Vide : l'app la déduit du département. Écrite par le Directeur seul,
-- comme le reste de la fiche (règles de store_overrides inchangées) ; le franchisé la reçoit déjà
-- avec ses magasins par espace_franchise() (ligne complète de store_overrides).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS topographie text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_overrides_topographie') THEN
    ALTER TABLE public.store_overrides ADD CONSTRAINT store_overrides_topographie CHECK (topographie IN ('littoral', 'montagne', 'terres'));
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0031', 'topographie_magasins')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
