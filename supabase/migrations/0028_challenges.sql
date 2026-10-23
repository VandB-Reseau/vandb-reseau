-- ════════════════════════════════════════════════════════════════
-- V and B — Challenge du mois entre magasins (sprint 22, A6, 23/10/2026)
-- Réexécutable. Suppose 0001 (store_finance), 0004 (mon_role, est_equipe, est_directeur, mes_magasins), 0005 (magasins_visibles),
-- 0006 (mon_nom), 0012 (journal).
--
-- 1) Le Directeur (tout le réseau, une région, une liste) ou un RR (ses magasins) crée un challenge sur un mois :
--    progression face au même mois de l'an dernier du CA, du panier moyen cave ou du panier moyen bar.
-- 2) Le classement est calculé par la base, sur les chiffres mensuels (store_finance).
-- 3) Équipe : rang de chaque magasin ; la progression seulement pour les magasins qu'elle suit (cloisonnement).
-- 4) Franchisé (si le challenge le prévoit) : son rang et le podium, sans aucun chiffre.
-- 5) Personne ne lit ni n'écrit la table directement.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.challenges (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titre       text NOT NULL CHECK (length(titre) BETWEEN 1 AND 200),
  indicateur  text NOT NULL CHECK (indicateur IN ('ca', 'pm_cave', 'pm_bar')),
  mois        date NOT NULL CHECK (extract(day FROM mois) = 1),
  magasins    text[] NOT NULL,
  franchises  boolean NOT NULL DEFAULT true,   -- rang et podium montrés aux franchisés
  auteur      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom  text NOT NULL DEFAULT '',
  cree_le     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenges' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.challenges', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.challenges FROM anon, authenticated;

-- Classement d'un challenge : progression en % face au même mois N-1 ; magasins sans les deux mois écartés
CREATE OR REPLACE FUNCTION public.classement_challenge(p_id bigint) RETURNS TABLE (magasin text, valeur numeric, rang integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH c AS (SELECT * FROM public.challenges WHERE id = p_id),
  v AS (
    SELECT f.store_name, f.month,
      CASE c.indicateur WHEN 'ca' THEN coalesce(f.ca_cave, 0) + coalesce(f.ca_bar, 0) + coalesce(f.ca_ext, 0)
                        WHEN 'pm_cave' THEN f.pm_cave ELSE f.pm_bar END AS x
    FROM c JOIN public.store_finance f ON f.store_name = ANY(c.magasins) AND f.month IN (c.mois, (c.mois - interval '1 year')::date)),
  p AS (
    SELECT n.store_name, round((n.x - a.x) / a.x * 100, 1) AS valeur
    FROM c JOIN v n ON n.month = c.mois JOIN v a ON a.store_name = n.store_name AND a.month = (c.mois - interval '1 year')::date
    WHERE a.x > 0 AND n.x > 0)
  SELECT store_name, valeur, (rank() OVER (ORDER BY valeur DESC))::integer FROM p
$$;

CREATE OR REPLACE FUNCTION public.creer_challenge(p_titre text, p_indicateur text, p_mois date, p_magasins text[], p_franchises boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint; v_mag text[];
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(btrim(p_titre), '') = '' OR p_indicateur NOT IN ('ca', 'pm_cave', 'pm_bar') OR p_mois IS NULL THEN RAISE EXCEPTION 'format'; END IF;
  IF date_trunc('month', p_mois) < date_trunc('month', current_date) - interval '12 months'
     OR date_trunc('month', p_mois) > date_trunc('month', current_date) + interval '3 months' THEN RAISE EXCEPTION 'date_invalide'; END IF;
  SELECT coalesce(array_agg(DISTINCT m), '{}') INTO v_mag FROM unnest(coalesce(p_magasins, '{}')) m
  WHERE m <> '' AND (public.est_directeur() OR m = ANY(public.magasins_visibles()));
  IF cardinality(v_mag) < 2 THEN RAISE EXCEPTION 'format'; END IF;
  INSERT INTO public.challenges (titre, indicateur, mois, magasins, franchises, auteur, auteur_nom)
  VALUES (left(btrim(p_titre), 200), p_indicateur, date_trunc('month', p_mois)::date, v_mag, coalesce(p_franchises, true), auth.uid(), coalesce(public.mon_nom(), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.supprimer_challenge(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.challenges WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur());
END $$;

-- Équipe : challenges qui touchent ses magasins (tous pour le Directeur), classement complet,
-- progression seulement pour les magasins qu'elle suit
CREATE OR REPLACE FUNCTION public.challenges_equipe() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := CASE WHEN public.est_directeur() THEN NULL ELSE public.magasins_visibles() END;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'titre', c.titre, 'indicateur', c.indicateur, 'mois', c.mois, 'magasins', to_jsonb(c.magasins),
      'franchises', c.franchises, 'auteur', c.auteur, 'auteur_nom', c.auteur_nom,
      'classement', (SELECT coalesce(jsonb_agg(jsonb_build_object('magasin', k.magasin, 'rang', k.rang,
                       'valeur', CASE WHEN v_mag IS NULL OR k.magasin = ANY(v_mag) THEN k.valeur END) ORDER BY k.rang, k.magasin), '[]'::jsonb)
                     FROM public.classement_challenge(c.id) k)
    ) ORDER BY c.mois DESC, c.id DESC), '[]'::jsonb)
    FROM public.challenges c
    WHERE c.mois > current_date - interval '13 months' AND (v_mag IS NULL OR c.auteur = auth.uid() OR c.magasins && v_mag));
END $$;

-- Franchisé : challenges ouverts aux franchisés où ses magasins concourent ; son rang et le podium, sans chiffre
CREATE OR REPLACE FUNCTION public.challenges_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.mes_magasins();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'titre', c.titre, 'indicateur', c.indicateur, 'mois', c.mois,
      'participants', cardinality(c.magasins),
      'classes', (SELECT count(*) FROM public.classement_challenge(c.id)),
      'podium', (SELECT coalesce(jsonb_agg(jsonb_build_object('magasin', k.magasin, 'rang', k.rang) ORDER BY k.rang, k.magasin), '[]'::jsonb)
                 FROM public.classement_challenge(c.id) k WHERE k.rang <= 3),
      'mes_rangs', (SELECT coalesce(jsonb_agg(jsonb_build_object('magasin', k.magasin, 'rang', k.rang) ORDER BY k.rang), '[]'::jsonb)
                 FROM public.classement_challenge(c.id) k WHERE k.magasin = ANY(v_mag))
    ) ORDER BY c.mois DESC, c.id DESC), '[]'::jsonb)
    FROM public.challenges c
    WHERE c.franchises AND c.magasins && v_mag AND c.mois > current_date - interval '3 months');
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['creer_challenge(text, text, date, text[], boolean)', 'supprimer_challenge(bigint)', 'challenges_equipe()', 'challenges_franchise()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.classement_challenge(bigint) FROM PUBLIC, anon, authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0028', 'challenges')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la table existe, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'challenges';
