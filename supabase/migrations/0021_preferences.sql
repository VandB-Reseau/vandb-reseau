-- ════════════════════════════════════════════════════════════════
-- V and B — Préférences de chaque compte de l'équipe (22/10/2026)
-- Réexécutable. Suppose 0004 (est_equipe) et 0012 (journal_migrations).
--
-- Favoris, fiches récentes, vues enregistrées de Magasins et dernière ouverture du canal « Réseau V and B » :
-- une ligne par compte, pour les retrouver sur le PC comme sur le téléphone.
-- Chaque compte de l'équipe (Directeur, RR, Coach) lit et écrit sa seule ligne ; personne ne lit celle d'un autre.
-- Le franchisé n'y a pas accès (il ne lit aucune table) : ces réglages restent sur son appareil.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.preferences (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  valeur   jsonb NOT NULL DEFAULT '{}'::jsonb,
  maj_le   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "preferences_lecture" ON public.preferences;
DROP POLICY IF EXISTS "preferences_ajout" ON public.preferences;
DROP POLICY IF EXISTS "preferences_modification" ON public.preferences;
DROP POLICY IF EXISTS "preferences_suppression" ON public.preferences;
CREATE POLICY "preferences_lecture" ON public.preferences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.est_equipe()));
CREATE POLICY "preferences_ajout" ON public.preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.est_equipe()));
CREATE POLICY "preferences_modification" ON public.preferences FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.est_equipe()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.est_equipe()));
CREATE POLICY "preferences_suppression" ON public.preferences FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.preferences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferences TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0021', 'preferences')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
