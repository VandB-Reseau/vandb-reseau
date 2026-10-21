-- ════════════════════════════════════════════════════════════════
-- V and B — Visite prévue, visite faite (21/10/2026, lot L1)
-- Réexécutable. Suppose 0001 (visits) et 0012 (journal). Aucun accès changé.
--
-- visits.prevue : vraie tant qu'une visite planifiée n'est pas faite (compte rendu enregistré ou « Faite »).
-- Une visite prévue ne compte pas dans le rythme de visite ni dans « pas vu depuis ».
-- Reprise : les visites déjà en base à une date passée restent faites ; celles à venir sans compte rendu
-- sont des visites planifiées.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS prevue boolean NOT NULL DEFAULT false;

UPDATE public.visits SET prevue = true
WHERE NOT prevue AND visit_date > current_date
  AND coalesce(type, 'terrain') NOT IN ('appel', 'point')
  AND coalesce(notes, '') = '' AND sections IS NULL;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0017', 'visites_prevues')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : visites prévues et faites
SELECT prevue, count(*) FROM public.visits GROUP BY prevue ORDER BY prevue;
