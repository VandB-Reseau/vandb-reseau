-- ════════════════════════════════════════════════════════════════
-- V and B — Compte rendu de visite : 10 parties + plan d'action (15/10/2026)
-- Réexécutable.
-- Règles d'accès des visites : 0004 puis 0005 (périmètre des Coachs et des RR).
-- La règle « visits_all » (tout compte connecté) posée par la première version
-- de ce script a été retirée le 21/10/2026 : rejouée après 0004, elle rouvrait
-- toutes les visites aux comptes franchisés.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS sections    jsonb;                    -- 10 textes, "" si partie non abordée
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS action_plan jsonb DEFAULT '[]'::jsonb; -- [{action, porteur, echeance, faite…}]
DROP POLICY IF EXISTS "visits_all" ON public.visits;
