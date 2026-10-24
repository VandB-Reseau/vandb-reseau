-- ════════════════════════════════════════════════════════════════
-- V and B — Situation des magasins (24/10/2026, sprint 24, F3)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0001 (store_overrides) et 0012 (journal).
--
-- Une seule colonne : la liste datée des changements de situation d'un magasin, saisie par le Directeur
-- depuis la fiche. Chaque élément : { date, type, fin?, sortie?, motif?, repreneur? } où type vaut
--   travaux      fermeture provisoire (travaux, lifting…) du « date » au « fin », le magasin reste au réseau
--   integre      passage en magasin intégré à cette date
--   franchise    passage en magasin franchisé à cette date
--   sortie       sortie du réseau ; « sortie » vaut fermeture, liquidation, enseigne (tombée d'enseigne)
--                ou cession (cession hors réseau, avec « repreneur »)
--   inauguration soirée d'inauguration (agenda)
-- À la date d'une sortie, l'app retire le magasin des listes, de la carte, du rythme et des repères ; sa
-- fiche reste consultable. Une reprise par un autre franchisé se gère avec les associés et leurs mandats.
-- Règles de store_overrides inchangées (Directeur seul en écriture) ; le franchisé reçoit déjà la ligne
-- complète de ses magasins par espace_franchise().
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.store_overrides ADD COLUMN IF NOT EXISTS situations jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_overrides_situations') THEN
    -- Une liste, de taille raisonnable
    ALTER TABLE public.store_overrides ADD CONSTRAINT store_overrides_situations CHECK (
      situations IS NULL OR jsonb_typeof(situations) = 'array' AND jsonb_array_length(situations) <= 100);
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0033', 'situations_magasins')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
