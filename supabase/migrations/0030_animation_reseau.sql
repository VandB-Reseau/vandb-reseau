-- ════════════════════════════════════════════════════════════════
-- V and B — Animation du réseau : formations, notifications des nouveaux contenus (23/10/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0001 (events), 0004 (acces_franchises, json_sur), 0005 (perimetre_equipe,
-- campagnes_regions), 0008 et 0014 (communications), 0016 (abonnements_push), 0018 (compte_lit_magasin), 0023 (pratiques_existantes),
-- 0025 (events.invites, reunions_presences), 0029 (destinataires_sondage), 0012 (journal).
--
-- 1) Un événement de l'agenda a un type (event, reunion, formation), une heure facultative (HH:MM, heure de Paris)
--    et, pour une réunion ou une formation, un contenu mis en forme (colonne html, 200 000 caractères au plus,
--    reconstruit par l'app à partir d'une liste fermée de balises à chaque affichage, comme les communications).
-- 2) Le franchisé reçoit type, heure et contenu des réunions où ses magasins sont invités (reunions_franchise).
-- 3) Notifications sur le téléphone d'un nouveau sondage, d'une nouvelle réunion ou formation, d'une nouvelle communication,
--    d'une nouvelle bonne pratique et d'une nouvelle campagne, vers les personnes concernées (fonction « notifier » seule) :
--    - sondage : ses destinataires (franchisés, Coachs, RR) ;
--    - réunion ou formation : franchisés des magasins invités et leurs Coachs (un RR : ses magasins seulement) ;
--    - communication : franchisés, Coachs et RR des magasins visés, et le Directeur ;
--    - bonne pratique : tout le réseau ;
--    - campagne : franchisés, Coachs et RR des magasins concernés (un RR : ses magasins seulement).
--    Jamais l'auteur. Chaque contenu ne part qu'une fois (table notifications_envoyees, fermée) ;
--    les contenus d'avant cette migration sont notés comme déjà envoyés.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS html text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS heure text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_html_taille') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_html_taille CHECK (length(html) <= 200000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_heure_format') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_heure_format CHECK (heure ~ '^([01]\d|2[0-3]):[0-5]\d$');
  END IF;
END $$;

-- Franchisé : réunions et formations des 12 derniers mois et à venir où ses magasins sont invités (0025, plus type, heure, contenu)
CREATE OR REPLACE FUNCTION public.reunions_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.mes_magasins();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titre', e.title, 'type', coalesce(e.type, 'event'), 'debut', e.start_date, 'fin', coalesce(e.end_date, e.start_date),
      'heure', e.heure, 'notes', coalesce(e.notes, ''), 'html', e.html,
      'magasins', (SELECT to_jsonb(array_agg(m ORDER BY m)) FROM unnest(e.invites) m WHERE m = ANY(v_mag)),
      'reponse', (SELECT p.reponse FROM public.reunions_presences p WHERE p.event_id = e.id AND p.store_name = ANY(v_mag) AND p.reponse IS NOT NULL ORDER BY p.repondu_le DESC LIMIT 1),
      'present', (SELECT bool_or(p.present) FROM public.reunions_presences p WHERE p.event_id = e.id AND p.store_name = ANY(v_mag))
    ) ORDER BY e.start_date, e.id), '[]'::jsonb)
    FROM public.events e
    WHERE e.invites && v_mag AND coalesce(e.end_date, e.start_date) >= current_date - 365);
END $$;

-- Contenus déjà notifiés : une notification par contenu, jamais deux
CREATE TABLE IF NOT EXISTS public.notifications_envoyees (
  genre     text NOT NULL,
  cle       text NOT NULL,
  envoye_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (genre, cle)
);
ALTER TABLE public.notifications_envoyees ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications_envoyees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications_envoyees', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.notifications_envoyees FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT ON public.notifications_envoyees TO service_role;
  END IF;
END $$;

-- Ce qui existait avant cette migration ne part pas en notification
INSERT INTO public.notifications_envoyees (genre, cle)
SELECT 'sondage', id::text FROM public.questions_eclair
UNION ALL SELECT 'evenement', id::text FROM public.events
UNION ALL SELECT 'communication', id::text FROM public.communications
UNION ALL SELECT 'pratique', unnest(public.pratiques_existantes())
UNION ALL SELECT 'campagne', id FROM public.campagnes_regions
UNION ALL SELECT 'campagne', x->>'id' FROM public.app_config c,
  jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(c.value)->'liste') = 'array' THEN public.json_sur(c.value)->'liste' ELSE '[]'::jsonb END) x
  WHERE c.key = 'campagnes' AND coalesce(x->>'id', '') <> ''
ON CONFLICT DO NOTHING;

-- Comptes qui suivent ces magasins (tous les magasins si p_magasins est NULL) :
-- franchisés, Coachs, encadrement (RR des magasins et Directeur)
CREATE OR REPLACE FUNCTION public.comptes_concernes(p_magasins text[], p_franchises boolean, p_coachs boolean, p_encadrement boolean) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.user_id FROM public.acces_franchises a
  WHERE p_franchises AND (p_magasins IS NULL OR a.magasins && p_magasins)
  UNION
  SELECT u.id FROM auth.users u
  WHERE p_coachs AND u.raw_app_meta_data->>'role' = 'coach'
    AND EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE p.coach = u.raw_app_meta_data->>'coach' AND (p_magasins IS NULL OR p.store_name = ANY(p_magasins)))
  UNION
  SELECT u.id FROM auth.users u
  WHERE p_encadrement AND u.raw_app_meta_data->>'role' = 'rr'
    AND EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE (u.raw_app_meta_data->>'rr') = ANY(p.rrs) AND (p_magasins IS NULL OR p.store_name = ANY(p_magasins)))
  UNION
  SELECT u.id FROM auth.users u WHERE p_encadrement AND u.raw_app_meta_data->>'role' = 'directeur'
$$;

-- Notifications d'un nouveau contenu : p_genre sondage | evenement | communication | pratique | campagne, p_id son identifiant.
-- p_magasins : pour une campagne seulement, les magasins concernés calculés par l'app (recoupés avec ceux de l'auteur).
-- La première demande valable note le contenu comme envoyé ; les suivantes ne renvoient rien.
CREATE OR REPLACE FUNCTION public.notifications_animation(p_genre text, p_id text, p_magasins text[], p_auteur uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text; v_rr text; v_comptes uuid[]; v_titre text; v_texte text; v_lien_f text; v_lien_e text; v_mag text[]; v_n integer;
  q public.questions_eclair; e public.events; c public.communications; v_p jsonb; v_cp jsonb;
BEGIN
  SELECT u.raw_app_meta_data->>'role', u.raw_app_meta_data->>'rr' INTO v_role, v_rr FROM auth.users u WHERE u.id = p_auteur;
  IF v_role IS NULL OR v_role NOT IN ('directeur', 'rr', 'coach') OR coalesce(p_id, '') !~ '^[A-Za-z0-9_-]{1,64}$' THEN RETURN '[]'::jsonb; END IF;

  IF p_genre = 'sondage' AND p_id ~ '^\d{1,18}$' THEN
    SELECT * INTO q FROM public.questions_eclair WHERE id = p_id::bigint AND auteur = p_auteur AND jusqu_au >= current_date;
    IF q.id IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(DISTINCT d.user_id) INTO v_comptes FROM public.destinataires_sondage(q, NULL) d;
    v_titre := 'Nouveau sondage';
    v_texte := left(q.titre, 120) || ' · jusqu’au ' || to_char(q.jusqu_au, 'DD/MM');
    v_lien_f := '#/'; v_lien_e := '#/infos?vue=sondages';

  ELSIF p_genre = 'evenement' AND p_id ~ '^\d{1,18}$' AND v_role IN ('directeur', 'rr') THEN
    SELECT * INTO e FROM public.events WHERE id = p_id::bigint AND coalesce(end_date, start_date) >= current_date;
    IF e.id IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(m) INTO v_mag FROM unnest(e.invites) m WHERE v_role = 'directeur' OR public.compte_lit_magasin(p_auteur, m, true);
    IF v_mag IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(k) INTO v_comptes FROM public.comptes_concernes(v_mag, true, true, false) k;
    v_titre := CASE WHEN e.type = 'formation' THEN 'Nouvelle formation' ELSE 'Nouvelle réunion' END;
    v_texte := left(e.title, 120) || ' · ' || to_char(e.start_date, 'DD/MM') || coalesce(' à ' || replace(e.heure, ':', ' h '), '');
    v_lien_f := '#/'; v_lien_e := '#/plus/agenda?mois=' || to_char(e.start_date, 'YYYY-MM');

  ELSIF p_genre = 'communication' AND p_id ~ '^\d{1,18}$' AND v_role IN ('directeur', 'rr') THEN
    SELECT * INTO c FROM public.communications WHERE id = p_id::bigint AND auteur = p_auteur AND cree_le > now() - interval '1 day';
    IF c.id IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(k) INTO v_comptes FROM public.comptes_concernes(c.magasins, true, true, true) k;
    v_titre := CASE WHEN c.a_la_une >= current_date THEN 'À la une · Réseau V and B' ELSE 'Nouvelle communication' END;
    v_texte := left(c.titre, 140);
    v_lien_f := '#/echanges/reseau'; v_lien_e := '#/infos';

  ELSIF p_genre = 'pratique' THEN
    SELECT x INTO v_p FROM public.app_config k,
      jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(k.value)) = 'array' THEN public.json_sur(k.value) ELSE '[]'::jsonb END) x
    WHERE k.key = 'bonnes_pratiques' AND x->>'id' = p_id LIMIT 1;
    IF v_p IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(k) INTO v_comptes FROM public.comptes_concernes(NULL, true, true, true) k;
    v_titre := 'Nouvelle bonne pratique';
    v_texte := left(coalesce(v_p->>'titre', ''), 120) || coalesce(' · ' || nullif(v_p->>'magasin', ''), '');
    v_lien_f := '#/bonnes-pratiques'; v_lien_e := '#/infos?vue=pratiques';

  ELSIF p_genre = 'campagne' AND v_role IN ('directeur', 'rr') THEN
    -- Campagne nationale (Directeur) ou régionale (son RR, ou le Directeur)
    SELECT x INTO v_cp FROM public.app_config k,
      jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(k.value)->'liste') = 'array' THEN public.json_sur(k.value)->'liste' ELSE '[]'::jsonb END) x
    WHERE k.key = 'campagnes' AND x->>'id' = p_id AND v_role = 'directeur' LIMIT 1;
    IF v_cp IS NULL THEN
      SELECT r.valeur INTO v_cp FROM public.campagnes_regions r WHERE r.id = p_id AND (v_role = 'directeur' OR r.rr = v_rr);
    END IF;
    IF v_cp IS NULL OR coalesce(v_cp->>'fin', '') !~ '^\d{4}-\d{2}-\d{2}$' OR (v_cp->>'fin')::date < current_date THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(m) INTO v_mag FROM unnest(p_magasins[1:1000]) m WHERE v_role = 'directeur' OR public.compte_lit_magasin(p_auteur, m, true);
    IF v_mag IS NULL THEN RETURN '[]'::jsonb; END IF;
    SELECT array_agg(k) INTO v_comptes FROM public.comptes_concernes(v_mag, true, true, true) k;
    v_titre := 'Nouvelle campagne';
    v_texte := left(coalesce(v_cp->>'nom', ''), 120) || ' · du ' || to_char((v_cp->>'debut')::date, 'DD/MM') || ' au ' || to_char((v_cp->>'fin')::date, 'DD/MM');
    v_lien_f := '#/magasins'; v_lien_e := '#/plus/sante?vue=campagnes&campagne=' || p_id;

  ELSE
    RETURN '[]'::jsonb;
  END IF;

  INSERT INTO public.notifications_envoyees (genre, cle) VALUES (p_genre, p_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN '[]'::jsonb; END IF;

  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth, 'titre', v_titre, 'texte', v_texte,
      'lien', CASE WHEN EXISTS (SELECT 1 FROM public.acces_franchises f WHERE f.user_id = a.user_id) THEN v_lien_f ELSE v_lien_e END)), '[]'::jsonb)
    FROM public.abonnements_push a
    WHERE a.user_id = ANY(coalesce(v_comptes, '{}')) AND a.user_id <> p_auteur);
END $$;

REVOKE ALL ON FUNCTION public.comptes_concernes(text[], boolean, boolean, boolean), public.notifications_animation(text, text, text[], uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.comptes_concernes(text[], boolean, boolean, boolean), public.notifications_animation(text, text, text[], uuid) TO service_role;
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0030', 'animation_reseau')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : les colonnes et la fonction existent, la table reste sans accès direct
SELECT 'events.html et events.heure' AS element, count(*) AS present FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'events' AND column_name IN ('html', 'heure')
UNION ALL
SELECT 'notifications_animation', count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'notifications_animation'
UNION ALL
SELECT 'notifications_envoyees (accès direct)', (SELECT count(*) FROM information_schema.role_table_grants g
  WHERE g.table_name = 'notifications_envoyees' AND g.grantee IN ('anon', 'authenticated'));
