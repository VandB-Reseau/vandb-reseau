-- ════════════════════════════════════════════════════════════════
-- V and B — Bonnes pratiques proposées par les franchisés (sprint 22, A4, 23/10/2026)
-- Réexécutable. Suppose 0004 (mon_role, est_equipe, est_directeur, mes_magasins, acces_franchises), 0005 (magasins_visibles), 0012 (journal).
--
-- 1) Le franchisé propose une bonne pratique pour un de ses magasins (titre, texte), par une fonction seulement.
-- 2) L'équipe qui suit le magasin (le Directeur pour tous) relit : elle la publie dans les bonnes pratiques
--    (écriture habituelle de l'équipe), puis la note « publiée » ; ou la note « non retenue ».
-- 3) Le franchisé suit l'état de ses propositions. Personne ne lit ni n'écrit la table directement.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pratiques_proposees (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  franchise  text NOT NULL,
  magasin    text NOT NULL,
  titre      text NOT NULL CHECK (length(titre) BETWEEN 1 AND 200),
  texte      text NOT NULL DEFAULT '' CHECK (length(texte) <= 4000),
  propose_le timestamptz NOT NULL DEFAULT now(),
  statut     text NOT NULL DEFAULT 'proposee' CHECK (statut IN ('proposee', 'publiee', 'refusee')),
  pratique   text,                 -- identifiant de la bonne pratique publiée
  traite_le  timestamptz,
  traite_par text
);
ALTER TABLE public.pratiques_proposees ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pratiques_proposees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pratiques_proposees', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.pratiques_proposees FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.proposer_pratique(p_magasin text, p_titre text, p_texte text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint; v_fr text;
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' OR NOT p_magasin = ANY(public.mes_magasins()) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(btrim(p_titre), '') = '' THEN RAISE EXCEPTION 'format'; END IF;
  -- Garde-fou : dix propositions en attente au plus par compte
  IF (SELECT count(*) FROM public.pratiques_proposees WHERE user_id = auth.uid() AND statut = 'proposee') >= 10 THEN RAISE EXCEPTION 'trop'; END IF;
  SELECT a.franchise INTO v_fr FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  INSERT INTO public.pratiques_proposees (user_id, franchise, magasin, titre, texte)
  VALUES (auth.uid(), v_fr, p_magasin, left(btrim(p_titre), 200), left(coalesce(btrim(p_texte), ''), 4000))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Franchisé : ses propositions des 12 derniers mois
CREATE OR REPLACE FUNCTION public.mes_propositions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'magasin', p.magasin, 'titre', p.titre, 'texte', p.texte, 'propose_le', p.propose_le,
      'statut', p.statut, 'pratique', p.pratique, 'traite_le', p.traite_le) ORDER BY p.propose_le DESC), '[]'::jsonb)
    FROM public.pratiques_proposees p WHERE p.user_id = auth.uid() AND p.propose_le > now() - interval '12 months');
END $$;

-- Équipe : propositions à relire sur les magasins qu'elle suit
CREATE OR REPLACE FUNCTION public.propositions_pratiques() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := CASE WHEN public.est_directeur() THEN NULL ELSE public.magasins_visibles() END;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'franchise', p.franchise, 'magasin', p.magasin, 'titre', p.titre, 'texte', p.texte,
      'propose_le', p.propose_le) ORDER BY p.propose_le), '[]'::jsonb)
    FROM public.pratiques_proposees p WHERE p.statut = 'proposee' AND (v_mag IS NULL OR p.magasin = ANY(v_mag)));
END $$;

-- Équipe : publiée (avec l'identifiant de la bonne pratique) ou non retenue
CREATE OR REPLACE FUNCTION public.traiter_proposition(p_id bigint, p_statut text, p_pratique text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_statut NOT IN ('publiee', 'refusee') OR (p_statut = 'publiee' AND coalesce(p_pratique, '') = '') THEN RAISE EXCEPTION 'format'; END IF;
  UPDATE public.pratiques_proposees p SET statut = p_statut, pratique = CASE WHEN p_statut = 'publiee' THEN p_pratique END, traite_le = now(), traite_par = public.mon_nom()
  WHERE p.id = p_id AND p.statut = 'proposee' AND (public.est_directeur() OR p.magasin = ANY(public.magasins_visibles()))
  RETURNING p.id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['proposer_pratique(text, text, text)', 'mes_propositions()', 'propositions_pratiques()', 'traiter_proposition(bigint, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0027', 'pratiques_proposees')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la table existe, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'pratiques_proposees';
