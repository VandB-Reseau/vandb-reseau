-- ════════════════════════════════════════════════════════════════
-- V and B — Blason de ville : figure au centre (23/10/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0001 (store_overrides), 0012 (journal) et 0031.
--
-- Au centre du blason, une figure représente un élément local de la ville (charte graphique V and B).
-- Vide : l'app la propose selon le département. Écrite par le Directeur seul, comme le reste de la fiche
-- (règles de store_overrides inchangées) ; le franchisé la reçoit déjà avec ses magasins par
-- espace_franchise() (ligne complète de store_overrides).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS figure text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_overrides_figure') THEN
    ALTER TABLE public.store_overrides ADD CONSTRAINT store_overrides_figure CHECK (figure IN (
      'voile', 'phare', 'ancre', 'poisson', 'coquillage', 'hermine', 'sommet', 'sapin', 'epi', 'feuille',
      'arbre', 'clocher', 'chateau', 'beffroi', 'pont', 'soleil', 'lavande', 'olivier', 'etoile', 'fleur'));
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0032', 'figure_blason')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
