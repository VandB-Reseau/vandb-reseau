-- ════════════════════════════════════════════════════════════════
-- V and B — Espace franchisé : cloisonnement réel des données
-- Sprint 11 (19/10/2026). Réexécutable.
--
-- 1) Le rôle de chaque compte est lu dans la base (auth.users), jamais
--    seulement dans le jeton de connexion.
-- 2) Les tables ne sont lisibles et modifiables que par l'équipe
--    (Directeur de réseau, Responsables Régionaux, Coachs).
-- 3) Un franchisé ne lit rien directement : la fonction espace_franchise()
--    lui renvoie uniquement ses magasins et des repères réseau anonymes.
-- 4) Un compte sans rôle n'a plus accès à rien tant que le Directeur
--    ne l'a pas rattaché à un franchisé.
-- 5) Depuis le 21/10/2026, ce script ne touche plus aux règles déjà posées par 0005
--    (périmètre des Coachs et des RR) ni à espace_franchise(), définie par 0005 :
--    le rejouer seul ne rouvre plus rien.
-- ════════════════════════════════════════════════════════════════

-- ── 0) Premier passage : les comptes existants sans rôle deviennent Directeur
--       (Joseph et le compte de travail de Claude). Ne se rejoue jamais ensuite,
--       pour ne pas donner tous les droits à un compte franchisé créé plus tard.
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"directeur"}'::jsonb
WHERE coalesce(raw_app_meta_data->>'role', '') = ''
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.raw_app_meta_data->>'role' = 'directeur');

-- ── 1) Rôle et droits du compte connecté
CREATE OR REPLACE FUNCTION public.mon_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT u.raw_app_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()), '')
$$;

CREATE OR REPLACE FUNCTION public.est_equipe() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() IN ('directeur', 'rr', 'coach')
$$;

CREATE OR REPLACE FUNCTION public.est_directeur() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() = 'directeur'
$$;

-- Lecture d'une valeur JSON d'app_config sans jamais échouer
CREATE OR REPLACE FUNCTION public.json_sur(t text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- ── 2) Règles des tables de base : l'équipe seulement (remplace « connectes_seulement »)
--       Une table déjà réglée par 0005 (règle « perimetre » ou « equipe_lecture ») est laissée telle quelle.
DO $$
DECLARE t record; p record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
           AND tablename IN ('app_config', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits', 'visits', 'store_finance', 'events', 'leaves')
           AND NOT EXISTS (SELECT 1 FROM pg_policies x WHERE x.schemaname = 'public' AND x.tablename = pg_tables.tablename AND x.policyname IN ('perimetre', 'equipe_lecture')) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.tablename);
    END LOOP;
    EXECUTE format('CREATE POLICY "equipe_seulement" ON public.%I FOR ALL TO authenticated USING ((SELECT public.est_equipe())) WITH CHECK ((SELECT public.est_equipe()))', t.tablename);
  END LOOP;
END $$;

-- ── 3) Accès des franchisés : compte → franchisé → ses magasins (écrit par le Directeur seul)
CREATE TABLE IF NOT EXISTS public.acces_franchises (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  franchise  text NOT NULL,
  magasins   text[] NOT NULL DEFAULT '{}',
  ouvert_le  timestamptz NOT NULL DEFAULT now(),
  maj_le     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acces_franchises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "directeur_lecture" ON public.acces_franchises;
CREATE POLICY "directeur_lecture" ON public.acces_franchises FOR SELECT TO authenticated USING ((SELECT public.est_directeur()));
-- Aucune règle d'écriture : on n'écrit que par les fonctions ci-dessous
REVOKE ALL ON public.acces_franchises FROM anon, authenticated;
GRANT SELECT ON public.acces_franchises TO authenticated;

CREATE OR REPLACE FUNCTION public.mes_magasins() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.mon_role() = 'franchise'
    THEN coalesce((SELECT a.magasins FROM public.acces_franchises a WHERE a.user_id = auth.uid()), '{}')
    ELSE '{}'::text[] END
$$;

-- Rôle, franchisé et périmètre du compte connecté (lu par l'app à la connexion)
CREATE OR REPLACE FUNCTION public.mon_acces() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'role', public.mon_role(),
    'coach', (SELECT u.raw_app_meta_data->>'coach' FROM auth.users u WHERE u.id = auth.uid()),
    'rr', (SELECT u.raw_app_meta_data->>'rr' FROM auth.users u WHERE u.id = auth.uid()),
    'franchise', (SELECT a.franchise FROM public.acces_franchises a WHERE a.user_id = auth.uid() AND public.mon_role() = 'franchise'),
    'magasins', to_jsonb(public.mes_magasins())
  )
$$;

-- ── 4) Gestion des accès, par le Directeur de réseau
CREATE OR REPLACE FUNCTION public.ouvrir_acces_franchise(p_email text, p_franchise text, p_magasins text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_role text; v_email text;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(trim(p_franchise), '') = '' OR coalesce(array_length(p_magasins, 1), 0) = 0 THEN RAISE EXCEPTION 'sans_magasin'; END IF;
  SELECT u.id, coalesce(u.raw_app_meta_data->>'role', ''), u.email INTO v_id, v_role, v_email
  FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_id IS NULL THEN RAISE EXCEPTION 'compte_introuvable'; END IF;
  IF v_id = auth.uid() OR v_role IN ('directeur', 'rr', 'coach') THEN RAISE EXCEPTION 'compte_equipe'; END IF;
  IF EXISTS (SELECT 1 FROM public.acces_franchises a WHERE a.user_id = v_id AND a.franchise <> p_franchise) THEN RAISE EXCEPTION 'compte_deja_pris'; END IF;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'coach' - 'rr') || jsonb_build_object('role', 'franchise', 'franchise', p_franchise)
  WHERE id = v_id;
  INSERT INTO public.acces_franchises (user_id, email, franchise, magasins)
  VALUES (v_id, v_email, p_franchise, p_magasins)
  ON CONFLICT (user_id) DO UPDATE SET franchise = excluded.franchise, magasins = excluded.magasins, email = excluded.email, maj_le = now();
  RETURN jsonb_build_object('user_id', v_id, 'email', v_email);
END $$;

-- Magasins (et nom) d'un franchisé déjà ouvert : après un changement d'associé ou un renommage
CREATE OR REPLACE FUNCTION public.maj_acces_franchise(p_user uuid, p_franchise text, p_magasins text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.acces_franchises SET franchise = p_franchise, magasins = coalesce(p_magasins, '{}'), maj_le = now() WHERE user_id = p_user;
  UPDATE auth.users SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('franchise', p_franchise)
  WHERE id = p_user AND raw_app_meta_data->>'role' = 'franchise';
END $$;

-- Couper l'accès : le compte reste, mais ne voit plus rien (rôle « sans_acces »)
CREATE OR REPLACE FUNCTION public.couper_acces_franchise(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.acces_franchises WHERE user_id = p_user;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'franchise') || '{"role":"sans_acces"}'::jsonb
  WHERE id = p_user AND raw_app_meta_data->>'role' = 'franchise';
END $$;

CREATE OR REPLACE FUNCTION public.liste_acces_franchises() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.est_directeur() THEN coalesce(jsonb_agg(jsonb_build_object(
    'user_id', a.user_id, 'email', a.email, 'franchise', a.franchise, 'magasins', to_jsonb(a.magasins),
    'ouvert_le', a.ouvert_le, 'derniere_connexion', u.last_sign_in_at) ORDER BY a.franchise), '[]'::jsonb) END
  FROM public.acces_franchises a LEFT JOIN auth.users u ON u.id = a.user_id
$$;

-- ── 5) Repères réseau anonymes du dernier mois connu de ces magasins
--       (médiane et quart supérieur, seulement si au moins 5 magasins ont le chiffre)
CREATE OR REPLACE FUNCTION public.reperes_reseau(p_magasins text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH f AS (
    SELECT s.store_name, date_trunc('month', s.month)::date AS mois, s.pm_cave, s.pm_bar, s.flux_cave, s.flux_bar, s.panier, s.marge,
      CASE WHEN s.ca_cave IS NULL AND s.ca_bar IS NULL AND s.ca_ext IS NULL THEN NULL ELSE coalesce(s.ca_cave, 0) + coalesce(s.ca_bar, 0) + coalesce(s.ca_ext, 0) END AS ca
    FROM public.store_finance s
  ),
  m AS (SELECT max(mois) AS mois FROM f WHERE store_name = ANY(p_magasins) AND ca IS NOT NULL),
  valeurs AS (
    SELECT x.ind, x.v FROM f CROSS JOIN m
    CROSS JOIN LATERAL (VALUES ('pmCave', f.pm_cave), ('pmBar', f.pm_bar), ('fluxCave', f.flux_cave), ('fluxBar', f.flux_bar), ('panier', f.panier), ('marge', f.marge)) AS x(ind, v)
    WHERE f.mois = m.mois AND x.v IS NOT NULL
    UNION ALL
    SELECT 'evolution', (c.ca - r.ca) / r.ca * 100 FROM f c CROSS JOIN m
    JOIN f r ON r.store_name = c.store_name AND r.mois = (m.mois - interval '12 months')::date
    WHERE c.mois = m.mois AND c.ca IS NOT NULL AND r.ca > 0
  ),
  stats AS (
    SELECT ind, count(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY v) AS med, percentile_cont(0.75) WITHIN GROUP (ORDER BY v) AS q
    FROM valeurs GROUP BY ind HAVING count(*) >= 5
  )
  SELECT CASE WHEN (SELECT mois FROM m) IS NULL THEN NULL ELSE jsonb_build_object(
    'mois', to_char((SELECT mois FROM m), 'YYYY-MM'),
    'indicateurs', coalesce((SELECT jsonb_object_agg(ind, jsonb_build_object('n', n, 'mediane', round(med::numeric, 2), 'quartHaut', round(q::numeric, 2))) FROM stats), '{}'::jsonb)) END
$$;

-- ── 6) L'espace du franchisé : fonction espace_franchise(), définie par 0005

-- ── 7) Photos : l'équipe comme avant ; un franchisé voit celles de ses visites et des bonnes pratiques
CREATE OR REPLACE FUNCTION public.photo_visible(p_chemin text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() = 'franchise' AND (
    EXISTS (SELECT 1 FROM public.visits v WHERE v.store = ANY(public.mes_magasins()) AND v.docs @> jsonb_build_array(jsonb_build_object('chemin', p_chemin)))
    OR EXISTS (SELECT 1 FROM public.app_config c, jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(c.value)) = 'array' THEN public.json_sur(c.value) ELSE '[]'::jsonb END) x
               WHERE c.key = 'bonnes_pratiques' AND x->'photos' @> jsonb_build_array(jsonb_build_object('chemin', p_chemin))))
$$;

DROP POLICY IF EXISTS "photos_lecture" ON storage.objects;
DROP POLICY IF EXISTS "photos_ajout" ON storage.objects;
DROP POLICY IF EXISTS "photos_suppression" ON storage.objects;
CREATE POLICY "photos_lecture" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos' AND ((SELECT public.est_equipe()) OR public.photo_visible(name)));
CREATE POLICY "photos_ajout" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos' AND (SELECT public.est_equipe()));
CREATE POLICY "photos_suppression" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos' AND (SELECT public.est_equipe()));

-- ── 8) Droits d'appel des fonctions : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['mon_role()', 'est_equipe()', 'est_directeur()', 'mes_magasins()', 'mon_acces()',
    'ouvrir_acces_franchise(text, text, text[])', 'maj_acces_franchise(uuid, text, text[])', 'couper_acces_franchise(uuid)',
    'liste_acces_franchises()', 'reperes_reseau(text[])', 'photo_visible(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
-- reperes_reseau prend une liste de magasins : réservé à espace_franchise et à l'équipe
REVOKE EXECUTE ON FUNCTION public.reperes_reseau(text[]) FROM authenticated;

-- Vérification : règles des tables et rôle de chaque compte
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
SELECT email, raw_app_meta_data->>'role' AS role FROM auth.users ORDER BY email;
