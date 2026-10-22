-- ════════════════════════════════════════════════════════════════
-- V and B — Tâches de l'équipe cachées au franchisé (22/10/2026)
-- Réexécutable. Suppose 0005 (espace_franchise), 0007 (tâches du franchisé), 0009 (pièces jointes), 0018 (Échanges).
--
-- Une tâche créée depuis un message du fil « Équipe seule » porte fil = equipe dans la rubrique « actions »
-- de suivi_magasins. Elle reste à l'équipe :
-- 1) espace_franchise() ne la renvoie plus (ni au franchisé, ni à l'aperçu du Directeur) ;
-- 2) marquer_action_franchise() la dit introuvable ;
-- 3) piece_visible() refuse ses photos et fichiers au franchisé.
-- Les mêmes corrections sont reportées dans 0005, 0007 et 0009 : rejouer l'une d'elles seule ne rouvre rien.
-- ════════════════════════════════════════════════════════════════

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
    -- Tâches hors visite, sauf celles nées dans « Équipe seule » (fil = equipe)
    jsonb_build_object('key', 'actions', 'value', (SELECT coalesce(jsonb_object_agg(s.store_name, (
      SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, o)
      WHERE coalesce(e->>'fil', '') <> 'equipe')), '{}'::jsonb) FROM public.suivi_magasins s WHERE s.cle = 'actions' AND s.store_name = ANY(v_mag))),
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

CREATE OR REPLACE FUNCTION public.marquer_action_franchise(p_store text, p_faite boolean, p_libre text DEFAULT NULL, p_visite bigint DEFAULT NULL, p_index integer DEFAULT NULL, p_texte text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_jour text := to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD');
  v_l jsonb; v_e jsonb;
BEGIN
  IF p_libre IS NOT NULL THEN
    SELECT s.valeur INTO v_l FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'actions' FOR UPDATE;
    IF jsonb_typeof(v_l) IS DISTINCT FROM 'array' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_l) e WHERE e->>'id' = p_libre AND coalesce(e->>'fil', '') <> 'equipe') THEN
      RAISE EXCEPTION 'action_introuvable';
    END IF;
    SELECT jsonb_agg(CASE WHEN e->>'id' = p_libre
      THEN CASE WHEN p_faite THEN e || jsonb_build_object('faite', v_jour, 'faitePar', v_fr) ELSE e - 'faite' - 'faitePar' END
      ELSE e END ORDER BY o) INTO v_l
    FROM jsonb_array_elements(v_l) WITH ORDINALITY AS t(e, o);
    UPDATE public.suivi_magasins SET valeur = v_l, maj_le = now() WHERE store_name = p_store AND cle = 'actions';
    RETURN;
  END IF;

  IF p_visite IS NULL OR p_index IS NULL OR p_index < 0 THEN RAISE EXCEPTION 'action_introuvable'; END IF;
  SELECT v.action_plan INTO v_l FROM public.visits v
  WHERE v.id = p_visite AND v.store = p_store AND coalesce(v.type, 'terrain') NOT IN ('appel', 'point') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'action_introuvable'; END IF;
  SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) INTO v_l
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_l) = 'array' THEN v_l ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, o)
  WHERE jsonb_typeof(e) = 'object' AND btrim(coalesce(e->>'action', '')) <> '';
  v_e := v_l -> p_index;
  IF v_e IS NULL OR (p_texte IS NOT NULL AND v_e->>'action' IS DISTINCT FROM p_texte) THEN RAISE EXCEPTION 'action_introuvable'; END IF;
  v_e := CASE WHEN p_faite THEN v_e || jsonb_build_object('faite', v_jour, 'faitePar', v_fr) ELSE v_e - 'faite' - 'faitePar' END;
  UPDATE public.visits SET action_plan = jsonb_set(v_l, ARRAY[p_index::text], v_e) WHERE id = p_visite;
END $$;

CREATE OR REPLACE FUNCTION public.piece_visible(p_chemin text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text := public.mon_role();
  v_cle text;
  v_mag text[];
  v_ref jsonb := jsonb_build_array(jsonb_build_object('chemin', p_chemin));
  v_vu boolean;
BEGIN
  IF auth.uid() IS NULL OR coalesce(p_chemin, '') = '' THEN RETURN false; END IF;
  IF NOT (public.est_equipe() OR v_role = 'franchise') THEN RETURN false; END IF;
  IF split_part(p_chemin, '/', 1) = auth.uid()::text THEN RETURN true; END IF;

  -- Échange à deux qui le cite
  v_cle := public.ma_cle();
  IF EXISTS (SELECT 1 FROM public.messages m
    WHERE m.pieces @> v_ref AND m.destinataire IS NOT NULL AND (m.auteur = auth.uid() OR m.destinataire = v_cle)) THEN
    RETURN true;
  END IF;

  -- Communication du réseau visible par le compte (0008)
  IF to_regclass('public.communications') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.communications c WHERE c.pieces @> $1 AND public.communication_visible(c.id))' INTO v_vu USING v_ref;
    IF v_vu THEN RETURN true; END IF;
  END IF;

  -- Tâche d'un magasin visible (hors visite, ou plan d'action d'une visite)
  v_mag := public.magasins_messagerie();
  IF EXISTS (SELECT 1 FROM public.suivi_magasins s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) e
    WHERE s.cle = 'actions' AND (v_mag IS NULL OR s.store_name = ANY(v_mag)) AND jsonb_typeof(e) = 'object' AND e->'pieces' @> v_ref
      AND (v_role <> 'franchise' OR coalesce(e->>'fil', '') <> 'equipe')) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.visits v, jsonb_array_elements(CASE WHEN jsonb_typeof(v.action_plan) = 'array' THEN v.action_plan ELSE '[]'::jsonb END) e
    WHERE (v_mag IS NULL OR v.store = ANY(v_mag)) AND jsonb_typeof(e) = 'object' AND e->'pieces' @> v_ref);
END $$;

REVOKE ALL ON FUNCTION public.espace_franchise(text, text[]), public.marquer_action_franchise(text, boolean, text, bigint, integer, text), public.piece_visible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.espace_franchise(text, text[]), public.marquer_action_franchise(text, boolean, text, bigint, integer, text), public.piece_visible(text) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0019', 'taches_equipe')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
