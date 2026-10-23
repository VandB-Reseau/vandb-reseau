-- ════════════════════════════════════════════════════════════════
-- V and B — Sondages de 1 à 5 questions, aussi pour l'équipe (23/10/2026, suite du sprint 22 A3)
-- Réexécutable. Suppose 0026 (questions_eclair, questions_participations, questions_reponses, magasins_questions),
-- 0004 (mon_role, est_directeur, mes_magasins, acces_franchises), 0005 (magasins_visibles, perimetre_equipe), 0006 (mon_nom), 0012 (journal).
--
-- 1) Un sondage porte de 1 à 5 questions (colonne questions) ; les questions éclair d'avant restent un sondage d'une question.
-- 2) Destinataires (colonne cible) : les franchisés, l'équipe ou les deux. L'équipe = les Coachs des magasins visés ;
--    les Responsables Régionaux aussi quand le Directeur pose le sondage. Personne ne répond à son propre sondage.
-- 3) On répond à toutes les questions d'un coup (repondre_sondage), une seule fois ; l'anonymat reste tenu par la base :
--    réponse rangée sans nom ni magasin, la participation à part et sans heure.
-- 4) Le Directeur et le RR lisent les résultats (un RR : réponses de sa région seulement), relance comprise pour l'équipe.
-- 5) Personne ne lit ni n'écrit les tables directement (inchangé).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.questions_eclair ADD COLUMN IF NOT EXISTS questions jsonb;
ALTER TABLE public.questions_eclair ADD COLUMN IF NOT EXISTS cible text NOT NULL DEFAULT 'franchises';
ALTER TABLE public.questions_eclair ADD COLUMN IF NOT EXISTS auteur_role text NOT NULL DEFAULT '';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_eclair_cible_check') THEN
    ALTER TABLE public.questions_eclair ADD CONSTRAINT questions_eclair_cible_check CHECK (cible IN ('franchises', 'equipe', 'tous'));
  END IF;
END $$;
-- Les questions éclair déjà posées deviennent des sondages d'une question
UPDATE public.questions_eclair
SET questions = jsonb_build_array(jsonb_build_object('titre', titre, 'genre', genre, 'choix', to_jsonb(choix)))
WHERE questions IS NULL;

ALTER TABLE public.questions_reponses ADD COLUMN IF NOT EXISTS valeurs text[];
ALTER TABLE public.questions_reponses ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'franchise';
ALTER TABLE public.questions_reponses ALTER COLUMN valeur DROP NOT NULL;
UPDATE public.questions_reponses SET valeurs = ARRAY[valeur] WHERE valeurs IS NULL;

-- Nom d'un Responsable Régional d'après son identifiant (référentiel de l'équipe)
CREATE OR REPLACE FUNCTION public.nom_rr(p_id text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT x->>'name' FROM public.app_config c,
      jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(c.value)->'drs') = 'array' THEN public.json_sur(c.value)->'drs' ELSE '[]'::jsonb END) x
    WHERE c.key = 'drs_data' AND x->>'id' = p_id LIMIT 1), p_id)
$$;

-- Le compte connecté est-il destinataire de ce sondage ?
CREATE OR REPLACE FUNCTION public.destinataire_sondage(q public.questions_eclair) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT q.auteur IS DISTINCT FROM auth.uid() AND CASE public.mon_role()
    WHEN 'franchise' THEN q.cible IN ('franchises', 'tous') AND (q.magasins IS NULL OR q.magasins && public.mes_magasins())
    WHEN 'coach' THEN q.cible IN ('equipe', 'tous') AND (q.magasins IS NULL OR q.magasins && public.magasins_visibles())
    WHEN 'rr' THEN q.cible IN ('equipe', 'tous') AND q.auteur_role = 'directeur' AND (q.magasins IS NULL OR q.magasins && public.magasins_visibles())
    ELSE false END
$$;

-- Une question est valable : un intitulé, un type, de 2 à 6 choix pour un choix
CREATE OR REPLACE FUNCTION public.question_valable(x jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(x) = 'object' AND coalesce(btrim(x->>'titre'), '') <> '' AND length(x->>'titre') <= 300
    AND x->>'genre' IN ('oui_non', 'choix', 'note')
    AND (x->>'genre' <> 'choix' OR (jsonb_typeof(x->'choix') = 'array' AND jsonb_array_length(x->'choix') BETWEEN 2 AND 6))
$$;

-- Une réponse est valable pour une question
CREATE OR REPLACE FUNCTION public.reponse_valable(x jsonb, v text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE x->>'genre'
    WHEN 'oui_non' THEN v IN ('oui', 'non')
    WHEN 'note' THEN v IN ('1', '2', '3', '4', '5')
    WHEN 'choix' THEN v IN (SELECT jsonb_array_elements_text(x->'choix'))
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.publier_sondage(p_titre text, p_questions jsonb, p_cible text, p_anonyme boolean, p_magasins text[], p_jusqu_au date) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint; v_mag text[]; v_q jsonb;
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_cible NOT IN ('franchises', 'equipe', 'tous') OR jsonb_typeof(p_questions) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_questions) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'format'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_questions) x WHERE NOT public.question_valable(x)) THEN RAISE EXCEPTION 'format'; END IF;
  IF p_jusqu_au IS NULL OR p_jusqu_au < current_date OR p_jusqu_au > current_date + 90 THEN RAISE EXCEPTION 'date_invalide'; END IF;
  -- Questions remises au propre : intitulé coupé, choix sans doublon ni vide
  SELECT jsonb_agg(jsonb_build_object('titre', left(btrim(x->>'titre'), 300), 'genre', x->>'genre',
           'choix', CASE WHEN x->>'genre' = 'choix' THEN (SELECT coalesce(jsonb_agg(DISTINCT left(btrim(c), 80)), '[]'::jsonb) FROM jsonb_array_elements_text(x->'choix') c WHERE btrim(c) <> '') ELSE '[]'::jsonb END)
         ORDER BY n)
  INTO v_q FROM jsonb_array_elements(p_questions) WITH ORDINALITY t(x, n);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_q) x WHERE x->>'genre' = 'choix' AND jsonb_array_length(x->'choix') < 2) THEN RAISE EXCEPTION 'format'; END IF;
  v_mag := p_magasins;
  IF public.mon_role() = 'rr' THEN
    -- Un RR interroge ses magasins seulement (leurs franchisés et leurs Coachs)
    v_mag := CASE WHEN p_magasins IS NULL THEN public.magasins_visibles()
                  ELSE (SELECT coalesce(array_agg(m), '{}') FROM unnest(p_magasins) m WHERE m = ANY(public.magasins_visibles())) END;
    IF cardinality(v_mag) = 0 THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  END IF;
  INSERT INTO public.questions_eclair (titre, genre, choix, questions, cible, anonyme, magasins, jusqu_au, auteur, auteur_nom, auteur_role)
  VALUES (left(coalesce(nullif(btrim(p_titre), ''), v_q->0->>'titre'), 300), v_q->0->>'genre',
          ARRAY(SELECT jsonb_array_elements_text(v_q->0->'choix')), v_q, p_cible, coalesce(p_anonyme, false), v_mag, p_jusqu_au,
          auth.uid(), coalesce(public.mon_nom(), ''), public.mon_role())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Ancienne écriture d'une question seule : un sondage d'une question pour les franchisés
CREATE OR REPLACE FUNCTION public.publier_question(p_titre text, p_genre text, p_choix text[], p_anonyme boolean, p_magasins text[], p_jusqu_au date) RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.publier_sondage(p_titre, jsonb_build_array(jsonb_build_object('titre', p_titre, 'genre', p_genre, 'choix', to_jsonb(coalesce(p_choix, '{}')))),
    'franchises', p_anonyme, p_magasins, p_jusqu_au)
$$;

-- Sondages ouverts dont le compte connecté est destinataire, et s'il a déjà répondu
CREATE OR REPLACE FUNCTION public.sondages_pour_moi() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'titre', q.titre, 'genre', q.genre, 'choix', to_jsonb(q.choix), 'questions', q.questions,
      'anonyme', q.anonyme, 'jusqu_au', q.jusqu_au, 'auteur_nom', q.auteur_nom,
      'repondu', EXISTS (SELECT 1 FROM public.questions_participations p WHERE p.question = q.id AND p.user_id = auth.uid()))
    ORDER BY q.cree_le DESC), '[]'::jsonb)
  FROM public.questions_eclair q
  WHERE q.jusqu_au >= current_date AND public.destinataire_sondage(q)
$$;

CREATE OR REPLACE FUNCTION public.questions_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN public.sondages_pour_moi();
END $$;

CREATE OR REPLACE FUNCTION public.questions_equipe() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr', 'coach') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN public.sondages_pour_moi();
END $$;

-- Répondre à tout le sondage d'un coup, une seule fois
CREATE OR REPLACE FUNCTION public.repondre_sondage(p_id bigint, p_valeurs text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q public.questions_eclair; v_role text := public.mon_role(); v_mag text[]; v_nom text; v_concernes text[]; v_regions text[];
BEGIN
  SELECT * INTO q FROM public.questions_eclair WHERE id = p_id AND jusqu_au >= current_date;
  IF q.id IS NULL OR NOT public.destinataire_sondage(q) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF cardinality(coalesce(p_valeurs, '{}')) <> jsonb_array_length(q.questions)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(q.questions) WITH ORDINALITY t(x, n) WHERE NOT public.reponse_valable(x, p_valeurs[n])) THEN
    RAISE EXCEPTION 'format';
  END IF;
  INSERT INTO public.questions_participations (question, user_id) VALUES (p_id, auth.uid());  -- une seule fois (clé primaire)
  IF v_role = 'franchise' THEN
    SELECT a.magasins, a.franchise INTO v_mag, v_nom FROM public.acces_franchises a WHERE a.user_id = auth.uid();
    v_concernes := CASE WHEN q.magasins IS NULL THEN v_mag ELSE (SELECT coalesce(array_agg(m), '{}') FROM unnest(v_mag) m WHERE m = ANY(q.magasins)) END;
    SELECT coalesce(array_agg(DISTINCT r), '{}') INTO v_regions FROM public.perimetre_equipe p, unnest(p.rrs) r WHERE p.store_name = ANY(v_concernes);
  ELSIF v_role = 'rr' THEN
    v_nom := public.mon_nom(); v_concernes := '{}';
    SELECT ARRAY[u.raw_app_meta_data->>'rr'] INTO v_regions FROM auth.users u WHERE u.id = auth.uid();
  ELSE
    v_nom := public.mon_nom(); v_concernes := '{}';
    SELECT coalesce(array_agg(DISTINCT r), '{}') INTO v_regions FROM public.perimetre_equipe p, unnest(p.rrs) r WHERE p.store_name = ANY(public.magasins_visibles());
  END IF;
  INSERT INTO public.questions_reponses (question, valeur, valeurs, role, franchise, magasins, regions)
  VALUES (p_id, p_valeurs[1], p_valeurs, v_role, CASE WHEN q.anonyme THEN NULL ELSE v_nom END,
          CASE WHEN q.anonyme THEN '{}' ELSE v_concernes END, coalesce(v_regions, '{}'));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'deja_repondu';
END $$;

-- Ancienne réponse à une question seule
CREATE OR REPLACE FUNCTION public.repondre_question(p_id bigint, p_valeur text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.repondre_sondage(p_id, ARRAY[p_valeur])
$$;

-- Destinataires d'un sondage (comptes et noms), vus par le Directeur (tous) ou un RR (ses magasins, sans les autres RR)
CREATE OR REPLACE FUNCTION public.destinataires_sondage(q public.questions_eclair, v_mag text[]) RETURNS TABLE (user_id uuid, nom text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.user_id, a.franchise FROM public.acces_franchises a
  WHERE q.cible IN ('franchises', 'tous') AND (q.magasins IS NULL OR a.magasins && q.magasins) AND (v_mag IS NULL OR a.magasins && v_mag)
  UNION ALL
  SELECT u.id, u.raw_app_meta_data->>'coach' FROM auth.users u
  WHERE q.cible IN ('equipe', 'tous') AND u.raw_app_meta_data->>'role' = 'coach' AND u.id IS DISTINCT FROM q.auteur
    AND EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE p.coach = u.raw_app_meta_data->>'coach'
                AND (q.magasins IS NULL OR p.store_name = ANY(q.magasins)) AND (v_mag IS NULL OR p.store_name = ANY(v_mag)))
  UNION ALL
  SELECT u.id, public.nom_rr(u.raw_app_meta_data->>'rr') FROM auth.users u
  WHERE v_mag IS NULL AND q.cible IN ('equipe', 'tous') AND q.auteur_role = 'directeur' AND u.raw_app_meta_data->>'role' = 'rr'
    AND u.id IS DISTINCT FROM q.auteur
    AND EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE (u.raw_app_meta_data->>'rr') = ANY(p.rrs) AND (q.magasins IS NULL OR p.store_name = ANY(q.magasins)))
$$;

-- Directeur et RR : résultats des sondages qu'ils voient. Un RR : sondages qui touchent ses magasins,
-- réponses de sa région seulement. Pour un sondage anonyme : jamais de nom.
CREATE OR REPLACE FUNCTION public.resultats_questions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[]; v_rr text;
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.magasins_questions();
  v_rr := CASE WHEN public.est_directeur() THEN NULL ELSE (SELECT u.raw_app_meta_data->>'rr' FROM auth.users u WHERE u.id = auth.uid()) END;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'titre', q.titre, 'genre', q.genre, 'choix', to_jsonb(q.choix), 'questions', q.questions, 'cible', q.cible,
      'anonyme', q.anonyme, 'magasins', to_jsonb(q.magasins), 'jusqu_au', q.jusqu_au, 'auteur', q.auteur, 'auteur_nom', q.auteur_nom, 'cree_le', q.cree_le,
      'reponses', (SELECT coalesce(jsonb_agg(jsonb_build_object('valeur', r.valeur, 'valeurs', to_jsonb(coalesce(r.valeurs, ARRAY[r.valeur])), 'role', r.role,
                       'franchise', r.franchise, 'magasins', to_jsonb(r.magasins), 'regions', to_jsonb(r.regions))), '[]'::jsonb)
                   FROM public.questions_reponses r WHERE r.question = q.id AND (v_rr IS NULL OR v_rr = ANY(r.regions))),
      'sans_reponse', (SELECT coalesce(jsonb_agg(DISTINCT d.nom), '[]'::jsonb) FROM public.destinataires_sondage(q, v_mag) d
                   WHERE NOT EXISTS (SELECT 1 FROM public.questions_participations p WHERE p.question = q.id AND p.user_id = d.user_id)),
      'concernes', (SELECT count(DISTINCT d.user_id) FROM public.destinataires_sondage(q, v_mag) d)
    ) ORDER BY q.cree_le DESC), '[]'::jsonb)
    FROM public.questions_eclair q
    WHERE q.cree_le > now() - interval '24 months' AND (v_mag IS NULL OR q.auteur = auth.uid() OR q.magasins IS NULL OR q.magasins && v_mag));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['publier_sondage(text, jsonb, text, boolean, text[], date)', 'publier_question(text, text, text[], boolean, text[], date)',
                           'questions_franchise()', 'questions_equipe()', 'repondre_sondage(bigint, text[])', 'repondre_question(bigint, text)',
                           'resultats_questions()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- Fonctions internes : jamais appelées depuis l'app
  FOREACH f IN ARRAY ARRAY['nom_rr(text)', 'destinataire_sondage(public.questions_eclair)', 'question_valable(jsonb)', 'reponse_valable(jsonb, text)',
                           'sondages_pour_moi()', 'destinataires_sondage(public.questions_eclair, text[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0029', 'sondages')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : les nouvelles colonnes existent, les tables restent sans accès direct
SELECT 'questions_eclair.questions et cible' AS element, count(*) AS present FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'questions_eclair' AND column_name IN ('questions', 'cible')
UNION ALL
SELECT 'tables des sondages (accès direct)', (SELECT count(*) FROM information_schema.role_table_grants g
  WHERE g.table_name IN ('questions_eclair', 'questions_participations', 'questions_reponses') AND g.grantee IN ('anon', 'authenticated'));
