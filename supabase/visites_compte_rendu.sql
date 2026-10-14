-- ════════════════════════════════════════════════════════════════
-- V and B — Compte rendu de visite : 10 parties + plan d'action
-- À exécuter une fois dans Supabase > SQL Editor. Réexécutable.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE visits ADD COLUMN IF NOT EXISTS sections    jsonb;                    -- 10 textes, "" si partie non abordée
ALTER TABLE visits ADD COLUMN IF NOT EXISTS action_plan jsonb DEFAULT '[]'::jsonb; -- [{action, porteur, echeance}]

-- Règles d'accès inchangées : comptes connectés uniquement
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visits_all" ON visits;
CREATE POLICY "visits_all" ON visits FOR ALL TO authenticated USING (true) WITH CHECK (true);
