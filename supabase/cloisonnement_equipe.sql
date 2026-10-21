-- ════════════════════════════════════════════════════════════════
-- V and B — Coachs et Responsables Régionaux : cloisonnement réel des données
-- À exécuter dans Supabase > SQL Editor, APRÈS acces_franchises.sql
-- (et à rejouer après tout nouveau passage de acces_franchises.sql). Réexécutable.
--
-- 1) Le périmètre de chaque magasin (son Coach, les RR qui le suivent) est
--    tenu à jour par l'app du Directeur de réseau dans perimetre_equipe.
-- 2) Le suivi rangé par magasin (santé, journal, audits, associés, actions,
--    déploiements, constats de campagne) quitte app_config pour la table
--    suivi_magasins, une ligne par magasin et par rubrique.
-- 3) Visites, chiffres et suivi : le Directeur voit tout ; un Coach ou un RR
--    ne lit et n'écrit que les lignes de ses magasins.
-- 4) Restent lisibles par toute l'équipe : la liste des magasins (carte),
--    les affectations, les bonnes pratiques, l'agenda et les réglages.
-- 5) Référentiels (liste des magasins, affectations, équipe, réglages, campagnes,
--    grilles) : seul le Directeur de réseau les modifie. L'équipe garde l'écriture
--    des bonnes pratiques, de l'agenda et des absences.
-- 6) Accès des Coachs et des RR, ouverts par le Directeur depuis leur fiche.
-- 3 bis) Campagnes régionales : créées et tenues par chaque Responsable Régional
--    pour ses magasins, ou exceptionnellement tout le réseau (table campagnes_regions) ; le Directeur les voit et les modifie toutes.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Périmètre de chaque magasin, écrit par l'app du Directeur
CREATE TABLE IF NOT EXISTS public.perimetre_equipe (
  store_name text PRIMARY KEY,
  coach      text,
  rrs        text[] NOT NULL DEFAULT '{}',
  maj_le     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.perimetre_equipe ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'perimetre_equipe' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.perimetre_equipe', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "directeur_lecture" ON public.perimetre_equipe FOR SELECT TO authenticated USING ((SELECT public.est_directeur()));
REVOKE ALL ON public.perimetre_equipe FROM anon, authenticated;
GRANT SELECT ON public.perimetre_equipe TO authenticated;

-- Magasins du compte connecté : ceux de son Coach, ou ceux que suit son RR
CREATE OR REPLACE FUNCTION public.magasins_visibles() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT array_agg(p.store_name) FROM public.perimetre_equipe p, auth.users u
    WHERE u.id = auth.uid() AND (
      (u.raw_app_meta_data->>'role' = 'coach' AND p.coach = u.raw_app_meta_data->>'coach')
      OR (u.raw_app_meta_data->>'role' = 'rr' AND (u.raw_app_meta_data->>'rr') = ANY(p.rrs)))
  ), '{}'::text[])
$$;

-- Remplace tout le périmètre : [{ "magasin": "...", "coach": "...", "rrs": ["rr1"] }, …]
CREATE OR REPLACE FUNCTION public.maj_perimetre_equipe(p_lignes jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF jsonb_typeof(p_lignes) <> 'array' THEN RAISE EXCEPTION 'format'; END IF;
  WITH recu AS (
    SELECT DISTINCT ON (l->>'magasin') l->>'magasin' AS store_name, nullif(l->>'coach', '') AS coach,
      coalesce((SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(l->'rrs') = 'array' THEN l->'rrs' ELSE '[]'::jsonb END) x), '{}') AS rrs
    FROM jsonb_array_elements(p_lignes) l WHERE coalesce(l->>'magasin', '') <> ''),
  retires AS (DELETE FROM public.perimetre_equipe p WHERE NOT EXISTS (SELECT 1 FROM recu r WHERE r.store_name = p.store_name))
  INSERT INTO public.perimetre_equipe AS p (store_name, coach, rrs)
  SELECT store_name, coach, rrs FROM recu
  ON CONFLICT (store_name) DO UPDATE SET coach = excluded.coach, rrs = excluded.rrs, maj_le = now()
  WHERE p.coach IS DISTINCT FROM excluded.coach OR p.rrs IS DISTINCT FROM excluded.rrs;
  SELECT count(*) INTO n FROM public.perimetre_equipe;
  RETURN n;
END $$;

-- ── 2) Suivi rangé par magasin
CREATE TABLE IF NOT EXISTS public.suivi_magasins (
  store_name text NOT NULL,
  cle        text NOT NULL CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation')),
  valeur     jsonb NOT NULL,
  maj_le     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_name, cle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suivi_magasins TO authenticated;
REVOKE ALL ON public.suivi_magasins FROM anon;

-- Copie de ce qui était dans app_config avant le premier passage (Directeur seul)
CREATE TABLE IF NOT EXISTS public.sauvegarde_cloisonnement (
  key   text PRIMARY KEY,
  value text,
  le    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sauvegarde_cloisonnement ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sauvegarde_cloisonnement' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sauvegarde_cloisonnement', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "directeur_lecture" ON public.sauvegarde_cloisonnement FOR SELECT TO authenticated USING ((SELECT public.est_directeur()));
REVOKE ALL ON public.sauvegarde_cloisonnement FROM anon, authenticated;
GRANT SELECT ON public.sauvegarde_cloisonnement TO authenticated;

INSERT INTO public.sauvegarde_cloisonnement (key, value)
SELECT c.key, c.value FROM public.app_config c
WHERE c.key IN ('sante_parc', 'sante_parc_sauvegarde', 'notes_magasins', 'audits', 'associes', 'actions', 'deploiements', 'campagnes')
ON CONFLICT (key) DO NOTHING;

-- Rubriques simples : { magasin: valeur }
INSERT INTO public.suivi_magasins (store_name, cle, valeur)
SELECT e.key, m.cle, e.value
FROM (VALUES ('sante_parc', 'sante'), ('sante_parc_sauvegarde', 'sante_sauvegarde'), ('notes_magasins', 'notes'), ('audits', 'audits'), ('associes', 'associes'), ('actions', 'actions')) AS m(k, cle)
JOIN public.app_config c ON c.key = m.k
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(public.json_sur(c.value)) = 'object' THEN public.json_sur(c.value) ELSE '{}'::jsonb END) e
WHERE e.key <> ''
ON CONFLICT (store_name, cle) DO NOTHING;
DELETE FROM public.app_config WHERE key IN ('sante_parc', 'sante_parc_sauvegarde', 'notes_magasins', 'audits', 'associes', 'actions');

-- Déploiements : les thématiques restent dans app_config, l'état et le journal passent par magasin
WITH d AS (SELECT public.json_sur(value) AS v FROM public.app_config WHERE key = 'deploiements'),
     mags AS (
       SELECT k FROM d, jsonb_object_keys(CASE WHEN jsonb_typeof(d.v->'valeurs') = 'object' THEN d.v->'valeurs' ELSE '{}'::jsonb END) k
       UNION SELECT k FROM d, jsonb_object_keys(CASE WHEN jsonb_typeof(d.v->'journal') = 'object' THEN d.v->'journal' ELSE '{}'::jsonb END) k)
INSERT INTO public.suivi_magasins (store_name, cle, valeur)
SELECT mags.k, 'deploiements', jsonb_build_object('valeurs', coalesce(d.v->'valeurs'->mags.k, '{}'::jsonb), 'journal', coalesce(d.v->'journal'->mags.k, '[]'::jsonb))
FROM d, mags WHERE mags.k <> ''
ON CONFLICT (store_name, cle) DO NOTHING;
UPDATE public.app_config SET value = jsonb_build_object('thematiques', coalesce(public.json_sur(value)->'thematiques', '[]'::jsonb))::text
WHERE key = 'deploiements' AND (public.json_sur(value) ? 'valeurs' OR public.json_sur(value) ? 'journal');

-- Campagnes : la liste reste dans app_config, les constats passent par magasin ({ campagne: { point: constat } })
WITH c AS (SELECT public.json_sur(value) AS v FROM public.app_config WHERE key = 'campagnes'),
     k AS (
       SELECT camp.key AS campagne, mag.key AS magasin, mag.value AS constats
       FROM c, jsonb_each(CASE WHEN jsonb_typeof(c.v->'constats') = 'object' THEN c.v->'constats' ELSE '{}'::jsonb END) camp,
            jsonb_each(CASE WHEN jsonb_typeof(camp.value) = 'object' THEN camp.value ELSE '{}'::jsonb END) mag)
INSERT INTO public.suivi_magasins (store_name, cle, valeur)
SELECT magasin, 'constats', jsonb_object_agg(campagne, constats) FROM k WHERE magasin <> '' GROUP BY magasin
ON CONFLICT (store_name, cle) DO NOTHING;
UPDATE public.app_config SET value = jsonb_build_object('liste', coalesce(public.json_sur(value)->'liste', '[]'::jsonb))::text
WHERE key = 'campagnes' AND public.json_sur(value) ? 'constats';

-- ── 3) Règles : Directeur partout ; Coach et RR sur leurs magasins
DO $$
DECLARE t record; p record;
BEGIN
  FOR t IN SELECT * FROM (VALUES ('visits', 'store'), ('store_finance', 'store_name'), ('suivi_magasins', 'store_name')) AS x(nom, col)
           WHERE EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = x.nom) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.nom);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.nom LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.nom);
    END LOOP;
    EXECUTE format('CREATE POLICY "perimetre" ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT public.est_directeur()) OR %I = ANY((SELECT public.magasins_visibles())::text[])) '
      'WITH CHECK ((SELECT public.est_directeur()) OR %I = ANY((SELECT public.magasins_visibles())::text[]))', t.nom, t.col, t.col);
  END LOOP;
END $$;

-- ── 3 bis) Campagnes régionales, une ligne par campagne, tenues par leur Responsable Régional
CREATE TABLE IF NOT EXISTS public.campagnes_regions (
  id     text PRIMARY KEY,
  rr     text NOT NULL,
  valeur jsonb NOT NULL,
  maj_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campagnes_regions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campagnes_regions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campagnes_regions', p.policyname);
  END LOOP;
END $$;

-- Identifiant du Responsable Régional connecté (null pour tout autre compte)
CREATE OR REPLACE FUNCTION public.mon_rr() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.mon_role() = 'rr' THEN (SELECT nullif(u.raw_app_meta_data->>'rr', '') FROM auth.users u WHERE u.id = auth.uid()) END
$$;

-- Un RR n'écrit que ses campagnes : sa région entière, des magasins qu'il suit, ou exceptionnellement tout le réseau
CREATE OR REPLACE FUNCTION public.campagne_region_permise(p_rr text, p_valeur jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.est_directeur() OR (
    p_rr = public.mon_rr() AND jsonb_typeof(p_valeur) = 'object' AND p_valeur->>'rr' = p_rr AND (
      p_valeur->>'perimetre' IN ('region', 'tous')
      OR (p_valeur->>'perimetre' = 'choix' AND jsonb_typeof(p_valeur->'magasins') = 'array' AND jsonb_array_length(p_valeur->'magasins') > 0
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_valeur->'magasins') m WHERE NOT m = ANY(public.magasins_visibles())))))
$$;

CREATE POLICY "equipe_lecture" ON public.campagnes_regions FOR SELECT TO authenticated USING ((SELECT public.est_equipe()));
CREATE POLICY "rr_ajout" ON public.campagnes_regions FOR INSERT TO authenticated WITH CHECK (public.campagne_region_permise(rr, valeur));
CREATE POLICY "rr_modification" ON public.campagnes_regions FOR UPDATE TO authenticated
  USING ((SELECT public.est_directeur()) OR rr = (SELECT public.mon_rr())) WITH CHECK (public.campagne_region_permise(rr, valeur));
CREATE POLICY "rr_suppression" ON public.campagnes_regions FOR DELETE TO authenticated USING ((SELECT public.est_directeur()) OR rr = (SELECT public.mon_rr()));
REVOKE ALL ON public.campagnes_regions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campagnes_regions TO authenticated;

-- ── 4) Espace franchisé : associés, actions, audits et constats lus dans suivi_magasins
CREATE OR REPLACE FUNCTION public.espace_franchise(p_franchise text DEFAULT NULL, p_magasins text[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_mag text[]; v_fr text; v_cfg jsonb := '{}'::jsonb; v_renames jsonb; v_adds jsonb; v_noms text[];
  v_coachs text[]; v_drs jsonb; v_camp jsonb; v_config jsonb;
BEGIN
  IF p_magasins IS NOT NULL THEN
    IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
    v_mag := p_magasins; v_fr := p_franchise;
  ELSE
    IF public.mon_role() <> 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
    SELECT a.magasins, a.franchise INTO v_mag, v_fr FROM public.acces_franchises a WHERE a.user_id = auth.uid();
    IF v_fr IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  END IF;

  SELECT coalesce(jsonb_object_agg(c.key, public.json_sur(c.value)), '{}'::jsonb) INTO v_cfg FROM public.app_config c
  WHERE c.key IN ('store_adds', 'store_renames', 'drs_data', 'params', 'grilles_audit', 'bonnes_pratiques', 'campagnes');

  -- Magasins (avec les renommages, appliqués comme dans l'app)
  v_renames := CASE WHEN jsonb_typeof(v_cfg->'store_renames') = 'object' THEN v_cfg->'store_renames' ELSE '{}'::jsonb END;
  SELECT coalesce(jsonb_agg(e), '[]'::jsonb), coalesce(array_agg(e->>'n'), '{}') INTO v_adds, v_noms
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_cfg->'store_adds') = 'array' THEN v_cfg->'store_adds' ELSE '[]'::jsonb END) e
  WHERE e->>'n' = ANY(v_mag) OR v_renames->>(e->>'n') = ANY(v_mag) OR v_renames->>(v_renames->>(e->>'n')) = ANY(v_mag);
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_renames FROM jsonb_each(v_renames) AS r(k, v)
  WHERE k = ANY(v_noms) OR k IN (SELECT v_renames->>n FROM unnest(v_noms) n);

  -- Coachs de ces magasins, Responsables Régionaux (coordonnées professionnelles seulement)
  SELECT coalesce(array_agg(DISTINCT r.cs), '{}') INTO v_coachs FROM public.reassigns r WHERE r.store = ANY(v_mag) AND r.cs IS NOT NULL;
  v_drs := jsonb_build_object(
    'directeur', (SELECT jsonb_build_object('name', d->>'name', 'titre', d->>'titre', 'tel', d->>'tel', 'email', d->>'email') FROM (SELECT v_cfg->'drs_data'->'directeur' AS d) x WHERE d IS NOT NULL),
    'drs', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', d->>'id', 'name', d->>'name', 'tel', d->>'tel', 'email', d->>'email', 'color', d->>'color', 'role', d->>'role')), '[]'::jsonb)
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_cfg->'drs_data'->'drs') = 'array' THEN v_cfg->'drs_data'->'drs' ELSE '[]'::jsonb END) d),
    'cs_dr', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(CASE WHEN jsonb_typeof(v_cfg->'drs_data'->'cs_dr') = 'object' THEN v_cfg->'drs_data'->'cs_dr' ELSE '{}'::jsonb END) AS c(k, v) WHERE k = ANY(v_coachs)),
    'dr_assigns', (SELECT coalesce(jsonb_agg(jsonb_build_object('cs', a->>'cs', 'dr', a->>'dr', 'date', a->>'date')), '[]'::jsonb)
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_cfg->'drs_data'->'dr_assigns') = 'array' THEN v_cfg->'drs_data'->'dr_assigns' ELSE '[]'::jsonb END) a WHERE a->>'cs' = ANY(v_coachs)));

  -- Campagnes qui concernent ces magasins, avec leurs seuls constats
  SELECT jsonb_build_object(
    'liste', coalesce(jsonb_agg(jsonb_set(c, '{magasins}', coalesce((SELECT jsonb_agg(m) FROM jsonb_array_elements_text(coalesce(c->'magasins', '[]'::jsonb)) m WHERE m = ANY(v_mag)), '[]'::jsonb))), '[]'::jsonb),
    'constats', coalesce((
      SELECT jsonb_object_agg(campagne, parMagasin) FROM (
        SELECT x.key AS campagne, jsonb_object_agg(s.store_name, x.value) AS parMagasin
        FROM public.suivi_magasins s, jsonb_each(s.valeur) x
        WHERE s.cle = 'constats' AND s.store_name = ANY(v_mag) AND jsonb_typeof(s.valeur) = 'object'
        GROUP BY x.key) y), '{}'::jsonb)) INTO v_camp
  FROM (
    SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_cfg->'campagnes'->'liste') = 'array' THEN v_cfg->'campagnes'->'liste' ELSE '[]'::jsonb END) x
    UNION ALL
    -- Campagnes régionales : la région devient la liste de ses magasins
    SELECT CASE WHEN r.valeur->>'perimetre' = 'region'
      THEN jsonb_set(jsonb_set(r.valeur, '{perimetre}', '"choix"'), '{magasins}', coalesce((SELECT jsonb_agg(p.store_name) FROM public.perimetre_equipe p WHERE r.rr = ANY(p.rrs)), '[]'::jsonb))
      ELSE r.valeur END
    FROM public.campagnes_regions r WHERE jsonb_typeof(r.valeur) = 'object') AS l(c)
  WHERE coalesce(c->>'perimetre', 'tous') <> 'choix' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(coalesce(c->'magasins', '[]'::jsonb)) m WHERE m = ANY(v_mag));

  v_config := jsonb_build_array(
    jsonb_build_object('key', 'store_adds', 'value', v_adds),
    jsonb_build_object('key', 'store_renames', 'value', v_renames),
    jsonb_build_object('key', 'drs_data', 'value', v_drs),
    jsonb_build_object('key', 'params', 'value', coalesce(v_cfg->'params', '{}'::jsonb)),
    jsonb_build_object('key', 'associes', 'value', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s WHERE s.cle = 'associes' AND s.store_name = ANY(v_mag))),
    jsonb_build_object('key', 'actions', 'value', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s WHERE s.cle = 'actions' AND s.store_name = ANY(v_mag))),
    jsonb_build_object('key', 'audits', 'value', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s WHERE s.cle = 'audits' AND s.store_name = ANY(v_mag))),
    jsonb_build_object('key', 'grilles_audit', 'value', coalesce(v_cfg->'grilles_audit', '{}'::jsonb)),
    jsonb_build_object('key', 'bonnes_pratiques', 'value', coalesce(v_cfg->'bonnes_pratiques', '[]'::jsonb)),
    jsonb_build_object('key', 'campagnes', 'value', v_camp));

  RETURN jsonb_build_object(
    'franchise', v_fr,
    'magasins', to_jsonb(v_mag),
    'app_config', v_config,
    'store_overrides', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.store_overrides s WHERE s.store_name = ANY(v_mag)),
    'reassigns', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'store', r.store, 'cs', r.cs, 'date', r.date, 'note', '', 'type', r.type) ORDER BY r.date, r.id), '[]'::jsonb) FROM public.reassigns r WHERE r.store = ANY(v_mag)),
    'cs_overrides', (SELECT coalesce(jsonb_agg(jsonb_build_object('cs_name', c.cs_name, 'tel', c.tel, 'email', c.email, 'color', c.color)), '[]'::jsonb) FROM public.cs_overrides c WHERE c.cs_name = ANY(v_coachs) AND NOT coalesce(c.tech, false)),
    -- Visites et comptes rendus complets, hors appels et points téléphoniques
    'visits', (SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.visit_date DESC), '[]'::jsonb) FROM public.visits v WHERE v.store = ANY(v_mag) AND coalesce(v.type, 'terrain') NOT IN ('appel', 'point')),
    'store_finance', (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.month), '[]'::jsonb) FROM public.store_finance f WHERE f.store_name = ANY(v_mag)),
    'reperes', public.reperes_reseau(v_mag));
END $$;

-- ── 5) Référentiels : lus par toute l'équipe, modifiés par le Directeur de réseau seul
--       (app_config garde l'écriture des bonnes pratiques pour toute l'équipe)
DO $$
DECLARE t text; p record; v_ecrire text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_config', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    v_ecrire := CASE WHEN t = 'app_config'
      THEN '(SELECT public.est_directeur()) OR ((SELECT public.est_equipe()) AND key = ''bonnes_pratiques'')'
      ELSE '(SELECT public.est_directeur())' END;
    EXECUTE format('CREATE POLICY "equipe_lecture" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.est_equipe()))', t);
    EXECUTE format('CREATE POLICY "directeur_ajout" ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t, v_ecrire);
    EXECUTE format('CREATE POLICY "directeur_modification" ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t, v_ecrire, v_ecrire);
    EXECUTE format('CREATE POLICY "directeur_suppression" ON public.%I FOR DELETE TO authenticated USING (%s)', t, v_ecrire);
  END LOOP;
END $$;

-- ── 6) Accès des Coachs et des Responsables Régionaux, ouverts par le Directeur de réseau
--       p_role 'coach' : p_nom = nom du Coach ; p_role 'rr' : p_nom = identifiant du RR.
--       Une personne = un compte : un autre compte déjà rattaché à la même personne est coupé.
CREATE OR REPLACE FUNCTION public.ouvrir_acces_equipe(p_email text, p_role text, p_nom text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_role text; v_email text;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_role NOT IN ('coach', 'rr') OR coalesce(trim(p_nom), '') = '' THEN RAISE EXCEPTION 'format'; END IF;
  SELECT u.id, coalesce(u.raw_app_meta_data->>'role', ''), u.email INTO v_id, v_role, v_email
  FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_id IS NULL THEN RAISE EXCEPTION 'compte_introuvable'; END IF;
  IF v_id = auth.uid() OR v_role = 'directeur' THEN RAISE EXCEPTION 'compte_directeur'; END IF;
  IF v_role = 'franchise' OR EXISTS (SELECT 1 FROM public.acces_franchises a WHERE a.user_id = v_id) THEN RAISE EXCEPTION 'compte_franchise'; END IF;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'coach' - 'rr') || '{"role":"sans_acces"}'::jsonb
  WHERE id <> v_id AND raw_app_meta_data->>'role' = p_role AND raw_app_meta_data->>p_role = p_nom;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'coach' - 'rr' - 'franchise') || jsonb_build_object('role', p_role, p_role, p_nom)
  WHERE id = v_id;
  RETURN jsonb_build_object('user_id', v_id, 'email', v_email);
END $$;

-- Couper l'accès : le compte reste, mais ne voit plus rien (rôle « sans_acces »)
CREATE OR REPLACE FUNCTION public.couper_acces_equipe(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'coach' - 'rr') || '{"role":"sans_acces"}'::jsonb
  WHERE id = p_user AND raw_app_meta_data->>'role' IN ('coach', 'rr');
END $$;

-- Coach renommé : son compte le suit
CREATE OR REPLACE FUNCTION public.renommer_acces_coach(p_ancien text, p_nouveau text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(trim(p_nouveau), '') = '' THEN RAISE EXCEPTION 'format'; END IF;
  UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('coach', p_nouveau)
  WHERE raw_app_meta_data->>'role' = 'coach' AND raw_app_meta_data->>'coach' = p_ancien;
END $$;

CREATE OR REPLACE FUNCTION public.liste_acces_equipe() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.est_directeur() THEN coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id, 'email', u.email, 'role', u.raw_app_meta_data->>'role',
    'nom', u.raw_app_meta_data->>(u.raw_app_meta_data->>'role'), 'derniere_connexion', u.last_sign_in_at) ORDER BY u.email), '[]'::jsonb) END
  FROM auth.users u WHERE u.raw_app_meta_data->>'role' IN ('coach', 'rr')
$$;

-- Repères réseau anonymes (médiane, quart supérieur) d'un magasin, pour la fiche avant visite de l'équipe
CREATE OR REPLACE FUNCTION public.reperes_equipe(p_magasins text[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN public.reperes_reseau(p_magasins);
END $$;

-- ── 7) Droits d'appel des fonctions : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['magasins_visibles()', 'maj_perimetre_equipe(jsonb)', 'espace_franchise(text, text[])',
    'ouvrir_acces_equipe(text, text, text)', 'couper_acces_equipe(uuid)', 'renommer_acces_coach(text, text)', 'liste_acces_equipe()', 'reperes_equipe(text[])',
    'mon_rr()', 'campagne_region_permise(text, jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vérification : règles des tables cloisonnées, et ce qui a été déplacé
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('visits', 'store_finance', 'suivi_magasins', 'perimetre_equipe', 'sauvegarde_cloisonnement', 'app_config', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits', 'campagnes_regions') ORDER BY tablename, policyname;
SELECT cle, count(*) AS magasins FROM public.suivi_magasins GROUP BY cle ORDER BY cle;
