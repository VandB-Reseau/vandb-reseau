-- ════════════════════════════════════════════════════════════════
-- V and B — Fiches des personnes réservées (21/10/2026, lot L7)
-- Réexécutable. Suppose 0005 (périmètre de l'équipe) et 0012 (journal).
--
-- Condition posée par Joseph avant d'ouvrir les comptes Coach et RR : les fiches personnelles
-- (coordonnées, dates de naissance et d'arrivée) quittent app_config, lisible par toute l'équipe,
-- pour une table à part :
-- 1) Directeur de réseau : lit et écrit toutes les fiches.
-- 2) Coach et Responsable Régional : lisent les fiches de l'équipe (Directeur, RR, Coachs) et celles
--    des seuls franchisés de leurs magasins (franchisé inscrit sur le magasin, associé, ou compte
--    franchisé ouvert sur ce magasin). Aucune écriture.
-- 3) Franchisé et compte sans rôle : rien.
-- La clé reprend celle de l'app : 'directeur', 'rr:<identifiant>', 'coach:<nom>', 'franchise:<nom>'.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fiches_personnes (
  cle    text PRIMARY KEY CHECK (cle = 'directeur' OR cle ~ '^(rr|coach|franchise):.+'),
  fiche  jsonb NOT NULL DEFAULT '{}'::jsonb,
  maj_le timestamptz NOT NULL DEFAULT now()
);

-- Le franchisé p_nom tient-il un des magasins du Coach ou du RR connecté ?
CREATE OR REPLACE FUNCTION public.franchise_de_mes_magasins(p_nom text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH v AS (SELECT public.magasins_visibles() AS m)
  SELECT EXISTS (SELECT 1 FROM public.store_overrides s, v WHERE s.resp = p_nom AND s.store_name = ANY(v.m))
    OR EXISTS (SELECT 1 FROM public.app_config c, v, jsonb_array_elements(
                 CASE WHEN jsonb_typeof(public.json_sur(c.value)) = 'array' THEN public.json_sur(c.value) ELSE '[]'::jsonb END) e
               WHERE c.key = 'store_adds' AND e->>'resp' = p_nom AND e->>'n' = ANY(v.m))
    OR EXISTS (SELECT 1 FROM public.suivi_magasins a, v, jsonb_array_elements(
                 CASE WHEN jsonb_typeof(a.valeur) = 'array' THEN a.valeur ELSE '[]'::jsonb END) x
               WHERE a.cle = 'associes' AND a.store_name = ANY(v.m) AND x->>'nom' = p_nom)
    OR EXISTS (SELECT 1 FROM public.acces_franchises f, v WHERE f.franchise = p_nom AND f.magasins && v.m)
$$;

-- Reprise des fiches rangées dans app_config, puis retrait de la clé (plus lisible par toute l'équipe)
DO $$
DECLARE v jsonb;
BEGIN
  SELECT public.json_sur(c.value) INTO v FROM public.app_config c WHERE c.key = 'fiches_personnes';
  IF jsonb_typeof(v) = 'object' THEN
    INSERT INTO public.fiches_personnes (cle, fiche)
    SELECT k, f FROM jsonb_each(v) AS e(k, f)
    WHERE jsonb_typeof(f) = 'object' AND (k = 'directeur' OR k ~ '^(rr|coach|franchise):.+')
    ON CONFLICT (cle) DO NOTHING;
  END IF;
  DELETE FROM public.app_config WHERE key = 'fiches_personnes';
END $$;

-- Règles : toutes retirées puis recréées, pour ne jamais rouvrir l'accès si la migration est rejouée seule
ALTER TABLE public.fiches_personnes ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fiches_personnes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiches_personnes', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "fiches_lecture" ON public.fiches_personnes FOR SELECT TO authenticated USING (
  (SELECT public.est_directeur())
  OR ((SELECT public.est_equipe()) AND (cle = 'directeur' OR cle LIKE 'rr:%' OR cle LIKE 'coach:%'
      OR (cle LIKE 'franchise:%' AND public.franchise_de_mes_magasins(substr(cle, 11))))));
CREATE POLICY "directeur_ajout" ON public.fiches_personnes FOR INSERT TO authenticated WITH CHECK ((SELECT public.est_directeur()));
CREATE POLICY "directeur_modification" ON public.fiches_personnes FOR UPDATE TO authenticated USING ((SELECT public.est_directeur())) WITH CHECK ((SELECT public.est_directeur()));
CREATE POLICY "directeur_suppression" ON public.fiches_personnes FOR DELETE TO authenticated USING ((SELECT public.est_directeur()));

REVOKE ALL ON public.fiches_personnes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiches_personnes TO authenticated;
REVOKE ALL ON FUNCTION public.franchise_de_mes_magasins(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.franchise_de_mes_magasins(text) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0015', 'fiches_personnes')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : nombre de fiches reprises, clé retirée d'app_config
SELECT (SELECT count(*) FROM public.fiches_personnes) AS fiches,
       (SELECT count(*) FROM public.app_config WHERE key = 'fiches_personnes') AS restees_dans_app_config;
