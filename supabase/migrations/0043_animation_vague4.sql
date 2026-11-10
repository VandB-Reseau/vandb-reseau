-- ════════════════════════════════════════════════════════════════
-- V and B — Animation du réseau, refonte vague 4 (10/11/2026, choix 31 à 37 de Joseph, sauf 35)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0005 (suivi_magasins, magasins_visibles), 0007 (actions du
-- franchisé), 0029 (sondages) et 0042 (rubrique « objectifs »).
--
-- 31 Plan d'action : rubrique « plan » de suivi_magasins, une ligne par magasin, liste de
--    { id, titre, objectif (id d'un objectif de 0042), statut (active | atteinte | abandonnee), bilan, creeLe, par, closLe }.
--    Les tâches s'y rattachent par leur champ « priorite ». Même cloisonnement que le reste du suivi ; le franchisé
--    lit les titres et statuts par plans_franchise(), jamais l'objectif chiffré (règle de la vague 3).
-- 32 Statut d'une tâche : champs « statut » (en_cours | bloquee) et « raison » dans la tâche (JSON existant) ;
--    le franchisé les pose par statut_action_franchise(), l'équipe écrit comme aujourd'hui.
-- 34 Entretiens mensuels RR–Coach : table entretiens (Directeur : tout ; RR : les Coachs de ses magasins ;
--    Coach : les siens en lecture, ses remarques par remarque_entretien()).
-- 36 Remontées : un sondage peut poser une question « chiffre » ou « texte » (réponse nominative).
-- 37 Demandes des franchisés : table demandes, fermée ; le franchisé crée et répond par ses fonctions, l'équipe
--    lit celles de ses magasins et répond par repondre_demande(), qui pose les dates.
-- ════════════════════════════════════════════════════════════════

-- ── 31) Rubrique « plan » ──────────────────────────────────────────
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise', 'objectifs', 'plan'));

-- Plans d'action des magasins du franchisé connecté : titres et statuts seulement
CREATE OR REPLACE FUNCTION public.plans_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() <> 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  RETURN (SELECT coalesce(jsonb_object_agg(s.store_name, (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', e->>'id', 'titre', e->>'titre', 'statut', coalesce(e->>'statut', 'active'),
      'bilan', coalesce(e->>'bilan', ''), 'creeLe', coalesce(e->>'creeLe', ''), 'closLe', coalesce(e->>'closLe', '')) ORDER BY o), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, o)
    WHERE jsonb_typeof(e) = 'object' AND coalesce(e->>'titre', '') <> '')), '{}'::jsonb)
    FROM public.suivi_magasins s WHERE s.cle = 'plan' AND s.store_name = ANY(coalesce(v_mag, '{}')));
END $$;

-- ── 32) Statut d'une tâche posé par le franchisé ───────────────────
-- p_statut : 'a_faire' (retire le statut), 'en_cours' ou 'bloquee' (avec une raison) ; même cible que marquer_action_franchise
CREATE OR REPLACE FUNCTION public.statut_action_franchise(p_store text, p_statut text, p_raison text DEFAULT '', p_libre text DEFAULT NULL, p_visite bigint DEFAULT NULL, p_index integer DEFAULT NULL, p_texte text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_raison text := left(regexp_replace(btrim(coalesce(p_raison, '')), '\s+', ' ', 'g'), 300);
  v_l jsonb; v_e jsonb;
BEGIN
  IF p_statut NOT IN ('a_faire', 'en_cours', 'bloquee') THEN RAISE EXCEPTION 'statut_invalide'; END IF;
  IF p_libre IS NOT NULL THEN
    SELECT s.valeur INTO v_l FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'actions' FOR UPDATE;
    IF jsonb_typeof(v_l) IS DISTINCT FROM 'array' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_l) e WHERE e->>'id' = p_libre AND coalesce(e->>'fil', '') <> 'equipe') THEN
      RAISE EXCEPTION 'action_introuvable';
    END IF;
    SELECT jsonb_agg(CASE WHEN e->>'id' = p_libre
      THEN CASE WHEN p_statut = 'a_faire' THEN e - 'statut' - 'raison'
                WHEN p_statut = 'bloquee' THEN e || jsonb_build_object('statut', 'bloquee', 'raison', v_raison)
                ELSE (e - 'raison') || jsonb_build_object('statut', 'en_cours') END
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
  v_e := CASE WHEN p_statut = 'a_faire' THEN v_e - 'statut' - 'raison'
              WHEN p_statut = 'bloquee' THEN v_e || jsonb_build_object('statut', 'bloquee', 'raison', v_raison)
              ELSE (v_e - 'raison') || jsonb_build_object('statut', 'en_cours') END;
  UPDATE public.visits SET action_plan = jsonb_set(v_l, ARRAY[p_index::text], v_e) WHERE id = p_visite;
END $$;

-- ── 34) Entretiens mensuels RR–Coach ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.entretiens (
  id          bigserial PRIMARY KEY,
  coach       text NOT NULL,
  mois        text NOT NULL CHECK (mois ~ '^\d{4}-\d{2}$'),
  notes       text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  -- [{ id, texte, echeance (AAAA-MM-JJ), tenu: true | false | absent }], 3 au plus (contrôlé par l'app)
  engagements jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(engagements) = 'array'),
  remarques   text NOT NULL DEFAULT '' CHECK (length(remarques) <= 5000),
  fait_le     date,
  par         text NOT NULL DEFAULT '',
  maj_le      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach, mois)
);
ALTER TABLE public.entretiens ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entretiens' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.entretiens', p.policyname);
  END LOOP;
END $$;

-- Coachs que le compte connecté encadre : tous pour le Directeur, ceux de ses magasins pour un RR
CREATE OR REPLACE FUNCTION public.coachs_encadres() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN public.est_directeur() THEN (SELECT coalesce(array_agg(DISTINCT p.coach), '{}') FROM public.perimetre_equipe p WHERE p.coach IS NOT NULL)
    WHEN public.mon_role() = 'rr' THEN (SELECT coalesce(array_agg(DISTINCT p.coach), '{}') FROM public.perimetre_equipe p WHERE p.coach IS NOT NULL AND public.mon_rr() = ANY(p.rrs))
    ELSE '{}'::text[] END
$$;
-- Nom du Coach connecté (null pour tout autre compte)
CREATE OR REPLACE FUNCTION public.mon_coach() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.mon_role() = 'coach' THEN (SELECT nullif(u.raw_app_meta_data->>'coach', '') FROM auth.users u WHERE u.id = auth.uid()) END
$$;

CREATE POLICY "lecture" ON public.entretiens FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR coach = ANY((SELECT public.coachs_encadres())::text[]) OR coach = (SELECT public.mon_coach()));
CREATE POLICY "ajout" ON public.entretiens FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_directeur()) OR coach = ANY((SELECT public.coachs_encadres())::text[]));
CREATE POLICY "modification" ON public.entretiens FOR UPDATE TO authenticated
  USING ((SELECT public.est_directeur()) OR coach = ANY((SELECT public.coachs_encadres())::text[]))
  WITH CHECK ((SELECT public.est_directeur()) OR coach = ANY((SELECT public.coachs_encadres())::text[]));
CREATE POLICY "suppression" ON public.entretiens FOR DELETE TO authenticated
  USING ((SELECT public.est_directeur()) OR coach = ANY((SELECT public.coachs_encadres())::text[]));
REVOKE ALL ON public.entretiens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entretiens TO authenticated;
GRANT USAGE ON SEQUENCE public.entretiens_id_seq TO authenticated;

-- Le Coach ajoute ses remarques à un de ses entretiens, sans toucher au reste
CREATE OR REPLACE FUNCTION public.remarque_entretien(p_id bigint, p_texte text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_coach text := public.mon_coach();
BEGIN
  IF v_coach IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.entretiens SET remarques = left(btrim(coalesce(p_texte, '')), 5000), maj_le = now() WHERE id = p_id AND coach = v_coach;
  IF NOT FOUND THEN RAISE EXCEPTION 'entretien_introuvable'; END IF;
END $$;

-- ── 36) Remontées : questions « chiffre » et « texte » dans un sondage ─
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.questions_eclair'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%genre%' LOOP
    EXECUTE format('ALTER TABLE public.questions_eclair DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.questions_eclair ADD CONSTRAINT questions_eclair_genre_check CHECK (genre IN ('oui_non', 'choix', 'note', 'chiffre', 'texte'));

CREATE OR REPLACE FUNCTION public.question_valable(x jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(x) = 'object' AND coalesce(btrim(x->>'titre'), '') <> '' AND length(x->>'titre') <= 300
    AND x->>'genre' IN ('oui_non', 'choix', 'note', 'chiffre', 'texte')
    AND (x->>'genre' <> 'choix' OR (jsonb_typeof(x->'choix') = 'array' AND jsonb_array_length(x->'choix') BETWEEN 2 AND 6))
$$;
CREATE OR REPLACE FUNCTION public.reponse_valable(x jsonb, v text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE x->>'genre'
    WHEN 'oui_non' THEN v IN ('oui', 'non')
    WHEN 'note' THEN v IN ('1', '2', '3', '4', '5')
    WHEN 'choix' THEN v IN (SELECT jsonb_array_elements_text(x->'choix'))
    WHEN 'chiffre' THEN v ~ '^-?\d{1,12}([.,]\d{1,4})?$'
    WHEN 'texte' THEN btrim(coalesce(v, '')) <> '' AND length(v) <= 2000
    ELSE false END
$$;

-- ── 37) Demandes des franchisés au siège ──────────────────────────
CREATE TABLE IF NOT EXISTS public.demandes (
  id                 bigserial PRIMARY KEY,
  magasin            text NOT NULL,
  franchise          text NOT NULL,
  theme              text NOT NULL CHECK (theme IN ('achats', 'travaux', 'marketing', 'caisse', 'juridique', 'autre')),
  titre              text NOT NULL CHECK (btrim(titre) <> '' AND length(titre) <= 200),
  statut             text NOT NULL DEFAULT 'nouvelle' CHECK (statut IN ('nouvelle', 'en_cours', 'attente', 'resolue')),
  -- [{ par, role (franchise | equipe), texte, le (horodatage) }] ; le premier message est la demande
  echanges           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(echanges) = 'array'),
  ouverte_le         timestamptz NOT NULL DEFAULT now(),
  premiere_reponse_le timestamptz,
  resolue_le         timestamptz,
  maj_le             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'demandes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.demandes', p.policyname);
  END LOOP;
END $$;
-- L'équipe lit les demandes de ses magasins ; aucune écriture directe (fonctions ci-dessous)
CREATE POLICY "lecture" ON public.demandes FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR magasin = ANY((SELECT public.magasins_visibles())::text[]));
REVOKE ALL ON public.demandes FROM anon, authenticated;
GRANT SELECT ON public.demandes TO authenticated;

CREATE OR REPLACE FUNCTION public.creer_demande(p_store text, p_theme text, p_titre text, p_texte text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_titre text := left(regexp_replace(btrim(coalesce(p_titre, '')), '\s+', ' ', 'g'), 200);
  v_texte text := left(btrim(coalesce(p_texte, '')), 5000);
  v_id bigint;
BEGIN
  IF v_titre = '' THEN RAISE EXCEPTION 'demande_vide'; END IF;
  IF p_theme NOT IN ('achats', 'travaux', 'marketing', 'caisse', 'juridique', 'autre') THEN RAISE EXCEPTION 'theme_invalide'; END IF;
  IF (SELECT count(*) FROM public.demandes d WHERE d.franchise = v_fr AND d.ouverte_le > now() - interval '1 day') >= 20 THEN RAISE EXCEPTION 'trop_de_demandes'; END IF;
  INSERT INTO public.demandes (magasin, franchise, theme, titre, echanges)
  VALUES (p_store, v_fr, p_theme, v_titre,
    CASE WHEN v_texte = '' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('par', v_fr, 'role', 'franchise', 'texte', v_texte, 'le', now())) END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Demandes du franchisé connecté, la plus récente en tête
CREATE OR REPLACE FUNCTION public.mes_demandes() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() <> 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.ouverte_le DESC), '[]'::jsonb) FROM public.demandes d WHERE d.magasin = ANY(coalesce(v_mag, '{}')));
END $$;

-- Le franchisé complète sa demande : elle repart chez le siège si elle attendait sa réponse
CREATE OR REPLACE FUNCTION public.completer_demande(p_id bigint, p_texte text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_store text; v_fr text; v_texte text := left(btrim(coalesce(p_texte, '')), 5000);
BEGIN
  SELECT d.magasin INTO v_store FROM public.demandes d WHERE d.id = p_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'demande_introuvable'; END IF;
  v_fr := public.franchise_du_magasin(v_store);
  IF v_texte = '' THEN RAISE EXCEPTION 'message_vide'; END IF;
  UPDATE public.demandes SET
    echanges = echanges || jsonb_build_array(jsonb_build_object('par', v_fr, 'role', 'franchise', 'texte', v_texte, 'le', now())),
    statut = CASE WHEN statut IN ('attente', 'resolue') THEN 'en_cours' ELSE statut END,
    resolue_le = NULL, maj_le = now()
  WHERE id = p_id;
END $$;

-- L'équipe répond et change le statut ; la base pose l'auteur et les dates
CREATE OR REPLACE FUNCTION public.repondre_demande(p_id bigint, p_texte text, p_statut text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_store text; v_texte text := left(btrim(coalesce(p_texte, '')), 5000);
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_statut NOT IN ('nouvelle', 'en_cours', 'attente', 'resolue') THEN RAISE EXCEPTION 'statut_invalide'; END IF;
  SELECT d.magasin INTO v_store FROM public.demandes d WHERE d.id = p_id FOR UPDATE;
  IF v_store IS NULL OR NOT (public.est_directeur() OR v_store = ANY(public.magasins_visibles())) THEN RAISE EXCEPTION 'demande_introuvable'; END IF;
  UPDATE public.demandes SET
    echanges = CASE WHEN v_texte = '' THEN echanges
      ELSE echanges || jsonb_build_array(jsonb_build_object('par', public.mon_nom(), 'role', 'equipe', 'texte', v_texte, 'le', now())) END,
    statut = p_statut,
    premiere_reponse_le = CASE WHEN premiere_reponse_le IS NULL AND (v_texte <> '' OR p_statut <> 'nouvelle') THEN now() ELSE premiere_reponse_le END,
    resolue_le = CASE WHEN p_statut = 'resolue' THEN coalesce(resolue_le, now()) ELSE NULL END,
    maj_le = now()
  WHERE id = p_id;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['plans_franchise()', 'statut_action_franchise(text, text, text, text, bigint, integer, text)',
    'coachs_encadres()', 'mon_coach()', 'remarque_entretien(bigint, text)', 'creer_demande(text, text, text, text)',
    'mes_demandes()', 'completer_demande(bigint, text)', 'repondre_demande(bigint, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0043', 'animation_vague4')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
