-- ════════════════════════════════════════════════════════════════
-- V and B — Fermetures et cessions des magasins (24/10/2026, sprint 24, F3)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0001 (store_overrides) et 0012 (journal).
--
-- Un magasin qui ferme, ou qui est cédé hors réseau (il quitte V and B), garde sa ligne : date, type,
-- motif court et repreneur pour une cession. À cette date, l'app le retire des listes, de la carte, du
-- rythme de visite et des repères ; sa fiche et son historique restent consultables. Écrit par le
-- Directeur seul, comme le reste de la fiche (règles de store_overrides inchangées) ; le franchisé le
-- reçoit déjà avec ses magasins par espace_franchise() (ligne complète de store_overrides).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS ferme_le date;
ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS fermeture text;
ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS fermeture_motif text;
ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS repreneur text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_overrides_fermeture') THEN
    -- Type présent si et seulement si la date l'est ; textes courts
    ALTER TABLE public.store_overrides ADD CONSTRAINT store_overrides_fermeture CHECK (
      (ferme_le IS NULL AND fermeture IS NULL OR ferme_le IS NOT NULL AND fermeture IN ('fermeture', 'cession'))
      AND (fermeture_motif IS NULL OR length(fermeture_motif) <= 200)
      AND (repreneur IS NULL OR length(repreneur) <= 120));
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0033', 'fermetures_magasins')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
