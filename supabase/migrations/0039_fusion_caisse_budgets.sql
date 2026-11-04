-- ════════════════════════════════════════════════════════════════
-- V and B — Le CA vient de la caisse (fusion avec le pilotage, Joseph 03/11/2026, décision 1)
-- Réexécutable. Suppose 0001 (store_finance), 0004 (mon_role, est_directeur), 0005 (magasins_visibles),
-- 0020 (reperes_reseau), 0028 (classement_challenge), 0038 (espace_franchise). Lit le schéma pilotage s'il existe
-- (tables reel_mensuel et reel_tickets du dépôt vandb-pilotage) ; sans lui, rien ne change.
--
-- 1) chiffres_mensuels_internes(magasins) : une ligne par magasin et par mois, au format de store_finance.
--    Un mois importé de la caisse prend les chiffres de la caisse : CA HT par univers (cave, bar, extérieur),
--    tickets, panier = CA ÷ tickets, marge = marge HT ÷ CA HT (marge théorique de la caisse ; la marge saisie
--    à la main sert seulement si la caisse n'en a pas). Un mois sans caisse garde les chiffres saisis.
--    store_finance n'est ni modifiée ni vidée : son retrait viendra après archive et feu vert de Joseph.
--    Fonction interne : aucun compte ne l'appelle directement.
-- 2) chiffres_mensuels() : la même chose pour l'équipe, limitée à ses magasins (tous pour le Directeur).
--    Le franchisé et un compte sans rôle n'y lisent rien (ses chiffres passent par espace_franchise()).
-- 3) reperes_reseau, classement_challenge et espace_franchise lisent ces chiffres au lieu de store_finance.
-- 4) notifications_budget(ids, auteur) : un commentaire posé sur un budget (pilotage.echanges_budget) part en
--    notification vers les comptes du magasin (franchisé, Coach, RR, Directeur), sauf son auteur. Fonction « notifier » seule ;
--    redéployer ensuite la fonction Supabase « notifier » (supabase/functions/notifier/index.ts).
-- 5) Une seule liste de tâches : les actions du plan d'action du budget (pilotage.actions) sont reprises en tâches du
--    réseau avec leur mesure, puis la table n'est plus écrite par l'app (lecture gardée).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.chiffres_mensuels_internes(p_magasins text[] DEFAULT NULL)
RETURNS TABLE (store_name text, month date, ca_cave numeric, ca_bar numeric, ca_ext numeric, pm_cave numeric, flux_cave numeric,
  pm_bar numeric, flux_bar numeric, freq numeric, panier numeric, marge numeric, updated_at timestamptz, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF to_regclass('pilotage.reel_mensuel') IS NULL OR to_regclass('pilotage.reel_tickets') IS NULL THEN
    RETURN QUERY
      SELECT s.store_name, date_trunc('month', s.month)::date, s.ca_cave, s.ca_bar, s.ca_ext, s.pm_cave, s.flux_cave,
        s.pm_bar, s.flux_bar, s.freq, s.panier, s.marge, s.updated_at, 'saisie'::text
      FROM public.store_finance s WHERE p_magasins IS NULL OR s.store_name = ANY(p_magasins);
    RETURN;
  END IF;
  -- Requête dynamique : le schéma pilotage n'existe pas forcément quand la fonction est créée
  RETURN QUERY EXECUTE $q$
    WITH c AS (
      SELECT r.store_name, r.mois AS month,
        sum(r.ca_ht) FILTER (WHERE r.univers = 'cave') AS ca_cave,
        sum(r.ca_ht) FILTER (WHERE r.univers = 'bar') AS ca_bar,
        sum(r.ca_ht) FILTER (WHERE r.univers = 'exterieur') AS ca_ext,
        sum(r.marge_ht) AS marge_ht, sum(r.ca_ht) FILTER (WHERE r.marge_ht IS NOT NULL) AS ca_marge,
        max(r.importe_le) AS importe_le
      FROM pilotage.reel_mensuel r WHERE $1 IS NULL OR r.store_name = ANY($1)
      GROUP BY r.store_name, r.mois),
    t AS (
      SELECT k.store_name, k.mois AS month,
        sum(k.tickets) FILTER (WHERE k.univers = 'cave')::numeric AS flux_cave,
        sum(k.tickets) FILTER (WHERE k.univers = 'bar')::numeric AS flux_bar
      FROM pilotage.reel_tickets k WHERE $1 IS NULL OR k.store_name = ANY($1)
      GROUP BY k.store_name, k.mois),
    caisse AS (
      SELECT c.*, t.flux_cave, t.flux_bar FROM c LEFT JOIN t ON t.store_name = c.store_name AND t.month = c.month),
    s AS (
      SELECT f.store_name, date_trunc('month', f.month)::date AS month, f.ca_cave, f.ca_bar, f.ca_ext, f.pm_cave, f.flux_cave,
        f.pm_bar, f.flux_bar, f.freq, f.panier, f.marge, f.updated_at
      FROM public.store_finance f WHERE $1 IS NULL OR f.store_name = ANY($1))
    SELECT coalesce(k.store_name, s.store_name), coalesce(k.month, s.month),
      CASE WHEN k.store_name IS NULL THEN s.ca_cave ELSE k.ca_cave END,
      CASE WHEN k.store_name IS NULL THEN s.ca_bar ELSE k.ca_bar END,
      CASE WHEN k.store_name IS NULL THEN s.ca_ext ELSE k.ca_ext END,
      CASE WHEN k.store_name IS NULL THEN s.pm_cave ELSE round(k.ca_cave / nullif(k.flux_cave, 0), 2) END,
      CASE WHEN k.store_name IS NULL THEN s.flux_cave ELSE k.flux_cave END,
      CASE WHEN k.store_name IS NULL THEN s.pm_bar ELSE round(k.ca_bar / nullif(k.flux_bar, 0), 2) END,
      CASE WHEN k.store_name IS NULL THEN s.flux_bar ELSE k.flux_bar END,
      CASE WHEN k.store_name IS NULL THEN s.freq
           WHEN k.flux_cave IS NULL AND k.flux_bar IS NULL THEN NULL ELSE coalesce(k.flux_cave, 0) + coalesce(k.flux_bar, 0) END,
      CASE WHEN k.store_name IS NULL THEN s.panier
           ELSE round((coalesce(k.ca_cave, 0) + coalesce(k.ca_bar, 0)) / nullif(coalesce(k.flux_cave, 0) + coalesce(k.flux_bar, 0), 0), 2) END,
      CASE WHEN k.store_name IS NULL THEN s.marge ELSE coalesce(round(k.marge_ht / nullif(k.ca_marge, 0) * 100, 1), s.marge) END,
      CASE WHEN k.store_name IS NULL THEN s.updated_at ELSE k.importe_le END,
      CASE WHEN k.store_name IS NULL THEN 'saisie' ELSE 'caisse' END
    FROM caisse k FULL JOIN s ON s.store_name = k.store_name AND s.month = k.month
  $q$ USING p_magasins;
END $$;
REVOKE ALL ON FUNCTION public.chiffres_mensuels_internes(text[]) FROM PUBLIC, anon, authenticated;

-- Pour l'équipe : ses magasins seulement, tous pour le Directeur ; rien pour les autres comptes
CREATE OR REPLACE FUNCTION public.chiffres_mensuels()
RETURNS TABLE (store_name text, month date, ca_cave numeric, ca_bar numeric, ca_ext numeric, pm_cave numeric, flux_cave numeric,
  pm_bar numeric, flux_bar numeric, freq numeric, panier numeric, marge numeric, updated_at timestamptz, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.est_directeur() THEN
    RETURN QUERY SELECT * FROM public.chiffres_mensuels_internes(NULL) c ORDER BY c.month, c.store_name;
  ELSIF public.mon_role() IN ('coach', 'rr') THEN
    RETURN QUERY SELECT * FROM public.chiffres_mensuels_internes(public.magasins_visibles()) c ORDER BY c.month, c.store_name;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.chiffres_mensuels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chiffres_mensuels() TO authenticated;

-- Repères du réseau (0020) : mêmes calculs, sur les chiffres de la caisse
CREATE OR REPLACE FUNCTION public.reperes_reseau(p_magasins text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH f AS (
    SELECT s.store_name, s.month AS mois, s.pm_cave, s.pm_bar, s.flux_cave, s.flux_bar, s.panier, s.marge,
      CASE WHEN s.ca_cave IS NULL AND s.ca_bar IS NULL AND s.ca_ext IS NULL THEN NULL ELSE coalesce(s.ca_cave, 0) + coalesce(s.ca_bar, 0) + coalesce(s.ca_ext, 0) END AS ca
    FROM public.chiffres_mensuels_internes(NULL) s
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
    SELECT ind, count(*) AS n, percentile_cont(0.25) WITHIN GROUP (ORDER BY v) AS qb, percentile_cont(0.5) WITHIN GROUP (ORDER BY v) AS med,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY v) AS q
    FROM valeurs GROUP BY ind HAVING count(*) >= 5
  )
  SELECT CASE WHEN (SELECT mois FROM m) IS NULL THEN NULL ELSE jsonb_build_object(
    'mois', to_char((SELECT mois FROM m), 'YYYY-MM'),
    'indicateurs', coalesce((SELECT jsonb_object_agg(ind, jsonb_build_object('n', n, 'quartBas', round(qb::numeric, 2), 'mediane', round(med::numeric, 2), 'quartHaut', round(q::numeric, 2))) FROM stats), '{}'::jsonb)) END
$$;
REVOKE ALL ON FUNCTION public.reperes_reseau(text[]) FROM PUBLIC, anon, authenticated;

-- Classement d'un challenge (0028) : mêmes règles, sur les chiffres de la caisse
CREATE OR REPLACE FUNCTION public.classement_challenge(p_id bigint) RETURNS TABLE (magasin text, valeur numeric, rang integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH c AS (SELECT * FROM public.challenges WHERE id = p_id),
  v AS (
    SELECT f.store_name, f.month,
      CASE c.indicateur WHEN 'ca' THEN coalesce(f.ca_cave, 0) + coalesce(f.ca_bar, 0) + coalesce(f.ca_ext, 0)
                        WHEN 'pm_cave' THEN f.pm_cave ELSE f.pm_bar END AS x
    FROM c CROSS JOIN LATERAL public.chiffres_mensuels_internes(c.magasins) f
    WHERE f.month IN (c.mois, (c.mois - interval '1 year')::date)),
  p AS (
    SELECT n.store_name, round((n.x - a.x) / a.x * 100, 1) AS valeur
    FROM c JOIN v n ON n.month = c.mois JOIN v a ON a.store_name = n.store_name AND a.month = (c.mois - interval '1 year')::date
    WHERE a.x > 0 AND n.x > 0)
  SELECT store_name, valeur, (rank() OVER (ORDER BY valeur DESC))::integer FROM p
$$;
REVOKE ALL ON FUNCTION public.classement_challenge(bigint) FROM PUBLIC, anon, authenticated;

-- Espace du franchisé (0038) : identique, ses chiffres mensuels viennent de la caisse
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
    'store_finance', (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.month), '[]'::jsonb) FROM public.chiffres_mensuels_internes(v_mag) f),
    'reperes', public.reperes_reseau(v_mag));
END $$;
REVOKE ALL ON FUNCTION public.espace_franchise(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.espace_franchise(text, text[]) TO authenticated;

-- Notifications d'un commentaire de budget (fonction « notifier » seule) : commentaire de moins d'un jour, de cet auteur
CREATE OR REPLACE FUNCTION public.notifications_budget(p_ids bigint[], p_auteur uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('pilotage.echanges_budget') IS NULL THEN RETURN v; END IF;
  EXECUTE $q$
    WITH e AS (
      SELECT b.id, b.store_name, b.texte, coalesce(nullif(b.auteur_nom, ''), 'Budget') AS nom
      FROM pilotage.echanges_budget b
      WHERE b.id = ANY($1[1:20]) AND b.auteur = $2 AND b.cree_le > now() - interval '1 day'
        AND (public.compte_lit_magasin($2, b.store_name, false) OR public.compte_lit_magasin($2, b.store_name, true))),
    d AS (
      SELECT DISTINCT e.id, k AS user_id FROM e, LATERAL public.comptes_concernes(ARRAY[e.store_name], true, true, true) k
      WHERE k <> $2 AND public.compte_lit_magasin(k, e.store_name, false))
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', 'Budget · ' || e.store_name,
        'texte', e.nom || ' : ' || left(e.texte, 120),
        'lien', '#/magasins/' || replace(e.store_name, ' ', '%20') || '?vue=budget')), '[]'::jsonb)
    FROM e JOIN d ON d.id = e.id JOIN public.abonnements_push a ON a.user_id = d.user_id
  $q$ INTO v USING p_ids, p_auteur;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.notifications_budget(bigint[], uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.notifications_budget(bigint[], uuid) TO service_role;
  END IF;
END $$;

-- ── 5) Une seule liste de tâches (Joseph, 04/11/2026, « Tâche réseau avec la mesure ») ──
-- Les actions du plan d'action du budget deviennent des tâches du réseau (suivi_magasins, rubrique « actions ») qui gardent
-- leur mesure dans « budget » (type d'alerte, année, responsable, valeur de départ). Reprise ci-dessous, une fois par action
-- (id « b_<numéro> », budget.origine = numéro) ; rejouée, elle ne recopie rien. Porteur : le franchisé inscrit sur le magasin,
-- son Coach du jour, le RR de ce Coach ou le Directeur, selon le responsable. Ensuite pilotage.actions n'est plus écrite.
DO $$
BEGIN
  IF to_regclass('pilotage.actions') IS NULL THEN RETURN; END IF;
  EXECUTE $q$
    WITH cfg AS (
      SELECT public.json_sur(c.value) AS d FROM public.app_config c WHERE c.key = 'drs_data'),
    a AS (
      SELECT x.*,
        (SELECT r.cs FROM public.reassigns r WHERE r.store = x.store_name AND r.date <= to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD')
          ORDER BY r.date DESC, r.id DESC LIMIT 1) AS coach,
        (SELECT o.resp FROM public.store_overrides o WHERE o.store_name = x.store_name) AS resp
      FROM pilotage.actions x),
    t AS (
      SELECT a.store_name, a.id, jsonb_strip_nulls(jsonb_build_object(
        'id', 'b_' || a.id,
        'action', a.intitule,
        'porteur', coalesce(CASE a.responsable
          WHEN 'franchise' THEN a.resp
          WHEN 'coach' THEN a.coach
          WHEN 'rr' THEN (SELECT r->>'name' FROM cfg, jsonb_array_elements(CASE WHEN jsonb_typeof(cfg.d->'drs') = 'array' THEN cfg.d->'drs' ELSE '[]'::jsonb END) r
                          WHERE r->>'id' = cfg.d->'cs_dr'->>a.coach LIMIT 1)
          WHEN 'directeur' THEN (SELECT cfg.d->'directeur'->>'name' FROM cfg) END, ''),
        'echeance', coalesce(to_char(a.echeance, 'YYYY-MM-DD'), ''),
        'creeLe', to_char(a.cree_le AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD'),
        'auteur', nullif(a.cree_par_nom, ''),
        'faite', CASE WHEN a.statut <> 'a_faire' THEN to_char(coalesce(a.faite_le, a.maj_le) AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') END,
        'budget', jsonb_strip_nulls(jsonb_build_object(
          'type', a.type_alerte, 'annee', a.annee, 'responsable', a.responsable, 'origine', a.id, 'role', a.cree_par_role,
          'abandonnee', CASE WHEN a.statut = 'abandonnee' THEN true END,
          'depart', CASE WHEN a.depart IS NOT NULL THEN jsonb_build_object('valeur', a.depart, 'mois', a.mois_depart) END)))) AS tache
      FROM a
      WHERE NOT EXISTS (
        SELECT 1 FROM public.suivi_magasins s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) e
        WHERE s.store_name = a.store_name AND s.cle = 'actions' AND (e->>'id' = 'b_' || a.id OR e->'budget'->>'origine' = a.id::text))),
    n AS (SELECT store_name, jsonb_agg(tache ORDER BY id) AS liste FROM t GROUP BY store_name)
    INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur, maj_le)
    SELECT n.store_name, 'actions', n.liste, now() FROM n
    ON CONFLICT (store_name, cle) DO UPDATE
      SET valeur = (CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) || EXCLUDED.valeur, maj_le = now()
  $q$;
  -- Liste fermée : lue encore (actions pas reprises si l'app est en avance), plus jamais écrite depuis l'app
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON pilotage.actions FROM PUBLIC, anon, authenticated';
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0039', 'fusion_caisse_budgets')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
