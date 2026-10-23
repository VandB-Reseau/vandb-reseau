-- ════════════════════════════════════════════════════════════════
-- V and B — Questions éclair aux franchisés (sprint 22, A3, 23/10/2026)
-- Réexécutable. Suppose 0004 (mon_role, est_directeur, mes_magasins, acces_franchises), 0005 (magasins_visibles,
-- perimetre_equipe), 0006 (mon_nom), 0012 (journal).
--
-- 1) Le Directeur (tout le réseau ou une liste) ou un RR (ses magasins) pose une question : oui/non, choix, ou note de 1 à 5.
-- 2) Le franchisé concerné répond une fois, tant que la question est ouverte.
-- 3) Anonymat réel : pour une question anonyme, la réponse est rangée sans compte ni nom, seulement avec les régions
--    de ses magasins ; la participation (qui a répondu) est rangée à part, pour la relance et pour ne répondre qu'une fois.
-- 4) Le Directeur et le RR lisent les résultats (un RR : réponses et relances de ses magasins seulement).
-- 5) Personne ne lit ni n'écrit les tables directement.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.questions_eclair (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titre      text NOT NULL CHECK (length(titre) BETWEEN 1 AND 300),
  genre      text NOT NULL CHECK (genre IN ('oui_non', 'choix', 'note')),
  choix      text[] NOT NULL DEFAULT '{}',
  anonyme    boolean NOT NULL DEFAULT false,
  magasins   text[],                          -- NULL = tout le réseau
  jusqu_au   date NOT NULL,
  auteur     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom text NOT NULL DEFAULT '',
  cree_le    timestamptz NOT NULL DEFAULT now()
);
-- Qui a répondu (jamais la réponse)
CREATE TABLE IF NOT EXISTS public.questions_participations (
  question  bigint NOT NULL REFERENCES public.questions_eclair(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (question, user_id)  -- sans heure : rien pour rapprocher une participation d'une réponse anonyme
);
-- Réponses : franchise vide pour une question anonyme ; regions = RR des magasins du répondant
CREATE TABLE IF NOT EXISTS public.questions_reponses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- tiré au hasard, pas dans l'ordre des réponses
  question  bigint NOT NULL REFERENCES public.questions_eclair(id) ON DELETE CASCADE,
  valeur    text NOT NULL,
  franchise text,
  magasins  text[] NOT NULL DEFAULT '{}',
  regions   text[] NOT NULL DEFAULT '{}'
);
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['questions_eclair', 'questions_participations', 'questions_reponses'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Magasins que suit le compte de l'équipe (NULL = tous, pour le Directeur)
CREATE OR REPLACE FUNCTION public.magasins_questions() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.est_directeur() THEN NULL ELSE public.magasins_visibles() END
$$;

CREATE OR REPLACE FUNCTION public.publier_question(p_titre text, p_genre text, p_choix text[], p_anonyme boolean, p_magasins text[], p_jusqu_au date) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint; v_mag text[]; v_choix text[];
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_genre NOT IN ('oui_non', 'choix', 'note') OR coalesce(btrim(p_titre), '') = '' THEN RAISE EXCEPTION 'format'; END IF;
  IF p_jusqu_au IS NULL OR p_jusqu_au < current_date OR p_jusqu_au > current_date + 90 THEN RAISE EXCEPTION 'date_invalide'; END IF;
  SELECT coalesce(array_agg(DISTINCT left(btrim(c), 80)), '{}') INTO v_choix FROM unnest(coalesce(p_choix, '{}')) c WHERE btrim(c) <> '';
  IF p_genre = 'choix' AND (cardinality(v_choix) < 2 OR cardinality(v_choix) > 6) THEN RAISE EXCEPTION 'format'; END IF;
  IF p_genre <> 'choix' THEN v_choix := '{}'; END IF;
  v_mag := p_magasins;
  IF public.mon_role() = 'rr' THEN
    -- Un RR interroge ses magasins seulement
    v_mag := CASE WHEN p_magasins IS NULL THEN public.magasins_visibles()
                  ELSE (SELECT coalesce(array_agg(m), '{}') FROM unnest(p_magasins) m WHERE m = ANY(public.magasins_visibles())) END;
    IF cardinality(v_mag) = 0 THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  END IF;
  INSERT INTO public.questions_eclair (titre, genre, choix, anonyme, magasins, jusqu_au, auteur, auteur_nom)
  VALUES (left(btrim(p_titre), 300), p_genre, v_choix, coalesce(p_anonyme, false), v_mag, p_jusqu_au, auth.uid(),
          coalesce(public.mon_nom(), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.supprimer_question(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.questions_eclair WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur());
END $$;

-- Franchisé : questions ouvertes qui le concernent, et s'il a déjà répondu
CREATE OR REPLACE FUNCTION public.questions_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.mes_magasins();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'titre', q.titre, 'genre', q.genre, 'choix', to_jsonb(q.choix),
      'anonyme', q.anonyme, 'jusqu_au', q.jusqu_au, 'auteur_nom', q.auteur_nom,
      'repondu', EXISTS (SELECT 1 FROM public.questions_participations p WHERE p.question = q.id AND p.user_id = auth.uid()))
    ORDER BY q.cree_le DESC), '[]'::jsonb)
    FROM public.questions_eclair q
    WHERE q.jusqu_au >= current_date AND (q.magasins IS NULL OR q.magasins && v_mag));
END $$;

CREATE OR REPLACE FUNCTION public.repondre_question(p_id bigint, p_valeur text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q public.questions_eclair; v_mag text[]; v_fr text; v_concernes text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins, a.franchise INTO v_mag, v_fr FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  SELECT * INTO q FROM public.questions_eclair WHERE id = p_id AND jusqu_au >= current_date AND (magasins IS NULL OR magasins && v_mag);
  IF q.id IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NOT (q.genre = 'oui_non' AND p_valeur IN ('oui', 'non')
       OR q.genre = 'note' AND p_valeur IN ('1', '2', '3', '4', '5')
       OR q.genre = 'choix' AND p_valeur = ANY(q.choix)) THEN RAISE EXCEPTION 'format'; END IF;
  INSERT INTO public.questions_participations (question, user_id) VALUES (p_id, auth.uid());  -- une seule fois (clé primaire)
  v_concernes := CASE WHEN q.magasins IS NULL THEN v_mag ELSE (SELECT coalesce(array_agg(m), '{}') FROM unnest(v_mag) m WHERE m = ANY(q.magasins)) END;
  INSERT INTO public.questions_reponses (question, valeur, franchise, magasins, regions)
  VALUES (p_id, p_valeur, CASE WHEN q.anonyme THEN NULL ELSE v_fr END, CASE WHEN q.anonyme THEN '{}' ELSE v_concernes END,
          (SELECT coalesce(array_agg(DISTINCT r), '{}') FROM public.perimetre_equipe p, unnest(p.rrs) r WHERE p.store_name = ANY(v_concernes)));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'deja_repondu';
END $$;

-- Directeur et RR : résultats des questions qu'ils voient. Un RR : questions qui touchent ses magasins,
-- réponses de ses régions seulement. Pour une question anonyme : décompte seulement, jamais de nom.
CREATE OR REPLACE FUNCTION public.resultats_questions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[]; v_rr text;
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.magasins_questions();
  v_rr := CASE WHEN public.est_directeur() THEN NULL ELSE (SELECT u.raw_app_meta_data->>'rr' FROM auth.users u WHERE u.id = auth.uid()) END;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'titre', q.titre, 'genre', q.genre, 'choix', to_jsonb(q.choix), 'anonyme', q.anonyme, 'magasins', to_jsonb(q.magasins),
      'jusqu_au', q.jusqu_au, 'auteur', q.auteur, 'auteur_nom', q.auteur_nom, 'cree_le', q.cree_le,
      'reponses', (SELECT coalesce(jsonb_agg(jsonb_build_object('valeur', r.valeur, 'franchise', r.franchise, 'magasins', to_jsonb(r.magasins), 'regions', to_jsonb(r.regions))), '[]'::jsonb)
                   FROM public.questions_reponses r WHERE r.question = q.id AND (v_rr IS NULL OR v_rr = ANY(r.regions))),
      'sans_reponse', (SELECT coalesce(jsonb_agg(DISTINCT a.franchise), '[]'::jsonb) FROM public.acces_franchises a
                   WHERE (q.magasins IS NULL OR a.magasins && q.magasins) AND (v_mag IS NULL OR a.magasins && v_mag)
                     AND NOT EXISTS (SELECT 1 FROM public.questions_participations p WHERE p.question = q.id AND p.user_id = a.user_id)),
      'concernes', (SELECT count(*) FROM public.acces_franchises a WHERE (q.magasins IS NULL OR a.magasins && q.magasins) AND (v_mag IS NULL OR a.magasins && v_mag))
    ) ORDER BY q.cree_le DESC), '[]'::jsonb)
    FROM public.questions_eclair q
    WHERE q.cree_le > now() - interval '24 months' AND (v_mag IS NULL OR q.auteur = auth.uid() OR q.magasins IS NULL OR q.magasins && v_mag));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['publier_question(text, text, text[], boolean, text[], date)', 'supprimer_question(bigint)', 'questions_franchise()',
                           'repondre_question(bigint, text)', 'resultats_questions()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.magasins_questions() FROM PUBLIC, anon, authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0026', 'questions_eclair')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : les trois tables existent, sans accès direct
SELECT t.table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name IN ('questions_eclair', 'questions_participations', 'questions_reponses') ORDER BY 1;
