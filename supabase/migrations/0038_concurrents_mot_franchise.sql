-- ════════════════════════════════════════════════════════════════
-- V and B — Concurrents autour du magasin et mot du franchisé avant la visite (26/10/2026, sprint 27, F3 et F4)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0005 (suivi_magasins), 0007 (franchise_du_magasin), 0019
-- (espace_franchise) et 0035 (rubrique « ouverture »).
--
-- 1) Deux rubriques de plus dans suivi_magasins :
--    « concurrence » : { ajoutes: [{ id, nom, detail, note, par, le }], masques: [id OpenStreetMap], notes: { id: texte } }
--      Écrite par l'équipe, comme le reste du suivi (Directeur partout, Coach et RR sur leurs magasins) ; jamais
--      renvoyée au franchisé. Les commerces eux-mêmes sont lus par l'app sur OpenStreetMap, rien n'est copié ici.
--    « mot_franchise » : mots du franchisé avant une visite prévue, les 12 derniers :
--      [{ visite, date, marche, bloque, besoin, par, le }]
-- 2) Le mot du franchisé ne s'écrit que par ecrire_mot_franchise() (le franchisé, sur une visite à venir de son
--    magasin ; son nom et l'heure posés par la base) : l'équipe le lit sans pouvoir l'écrire ni l'effacer, le
--    Directeur garde la main (renommage d'un magasin).
-- 3) espace_franchise() renvoie au franchisé ses mots (clé « mots_franchise »).
-- ════════════════════════════════════════════════════════════════

-- 1) Rubriques : retire l'ancienne liste, quel que soit le nom donné à la contrainte
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise'));

-- 2) Garde : un compte autre que le Directeur n'écrit ni n'efface directement un mot du franchisé.
-- ecrire_mot_franchise() s'exécute sous son propriétaire : elle passe.
CREATE OR REPLACE FUNCTION public.garde_mot_franchise() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.est_directeur()
     AND ((TG_OP <> 'INSERT' AND OLD.cle = 'mot_franchise') OR (TG_OP <> 'DELETE' AND NEW.cle = 'mot_franchise')) THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS garde_mot_franchise ON public.suivi_magasins;
CREATE TRIGGER garde_mot_franchise BEFORE INSERT OR UPDATE OR DELETE ON public.suivi_magasins
  FOR EACH ROW EXECUTE FUNCTION public.garde_mot_franchise();

-- Le franchisé écrit (ou retire, tout vide) son mot avant une visite à venir de son magasin
CREATE OR REPLACE FUNCTION public.ecrire_mot_franchise(p_store text, p_visite bigint, p_marche text DEFAULT '', p_bloque text DEFAULT '', p_besoin text DEFAULT '') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_jour date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_date date;
  v_marche text := left(btrim(coalesce(p_marche, '')), 2000);
  v_bloque text := left(btrim(coalesce(p_bloque, '')), 2000);
  v_besoin text := left(btrim(coalesce(p_besoin, '')), 2000);
  v_l jsonb;
BEGIN
  SELECT v.visit_date INTO v_date FROM public.visits v
  WHERE v.id = p_visite AND v.store = p_store AND coalesce(v.type, 'terrain') NOT IN ('appel', 'point') AND v.visit_date >= v_jour;
  IF v_date IS NULL THEN RAISE EXCEPTION 'visite_introuvable'; END IF;
  SELECT s.valeur INTO v_l FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'mot_franchise' FOR UPDATE;
  SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) INTO v_l
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_l) = 'array' THEN v_l ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, o)
  WHERE jsonb_typeof(e) = 'object' AND (e->>'visite') IS DISTINCT FROM p_visite::text;
  IF v_marche <> '' OR v_bloque <> '' OR v_besoin <> '' THEN
    v_l := v_l || jsonb_build_array(jsonb_build_object('visite', p_visite, 'date', to_char(v_date, 'YYYY-MM-DD'),
      'marche', v_marche, 'bloque', v_bloque, 'besoin', v_besoin, 'par', v_fr,
      'le', to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI')));
  END IF;
  -- Les 12 derniers seulement
  SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) INTO v_l
  FROM jsonb_array_elements(v_l) WITH ORDINALITY AS t(e, o) WHERE o > jsonb_array_length(v_l) - 12;
  INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'mot_franchise', v_l)
  ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur, maj_le = now();
END $$;

-- 3) Espace du franchisé : celui de 0019, avec ses mots
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
    jsonb_build_object('key', 'campagnes', 'value', v_camp),
    -- Mots du franchisé avant ses visites (0038)
    jsonb_build_object('key', 'mots_franchise', 'value', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s WHERE s.cle = 'mot_franchise' AND s.store_name = ANY(v_mag))));

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

REVOKE ALL ON FUNCTION public.ecrire_mot_franchise(text, bigint, text, text, text), public.espace_franchise(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_mot_franchise(text, bigint, text, text, text), public.espace_franchise(text, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.garde_mot_franchise() FROM PUBLIC, anon, authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0038', 'concurrents_mot_franchise')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
