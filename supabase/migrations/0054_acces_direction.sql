-- ════════════════════════════════════════════════════════════════
-- V and B Réseau — accès « Direction » en lecture (Joseph, 24/11/2026 : notes de l'équipe visibles d'un DG ou
-- d'autres accès donnés ; lot à part, juste après le carnet du magasin). Réexécutable.
--
-- Un compte « direction » (rôle direction dans auth.users, nom dans la clé direction) :
--   - lit tout le réseau comme le Directeur : magasins, visites, suivi (carnet compris), équipe, chiffres, animation ;
--   - n'écrit nulle part, sauf dans le carnet des magasins (rubrique notes de suivi_magasins : notes et réponses) ;
--   - ne lit pas la messagerie privée, ni les accès des franchisés, ni les appareils abonnés ;
--   - ne tient aucun référentiel, ne valide aucun budget ; n'apparaît jamais au franchisé.
-- Ouvert et coupé par le Directeur seul (ouvrir_acces_direction, couper_acces_direction, liste_acces_direction).
--
-- Les règles existantes ne sont pas rouvertes : on AJOUTE des règles de lecture réservées au rôle direction,
-- et les fonctions de lecture listées plus bas sont réécrites pour l'admettre (un rejeu seul d'une ancienne
-- migration ne fait que lui retirer cette lecture). Suppose 0004, 0005, 0021, 0053.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Qui lit
CREATE OR REPLACE FUNCTION public.est_direction() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() = 'direction'
$$;
-- Lecture de tout le réseau : Directeur ou Direction (jamais pour écrire)
CREATE OR REPLACE FUNCTION public.lecteur_reseau() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() IN ('directeur', 'direction')
$$;
-- Lecture réservée à l'équipe : Directeur, RR, Coach, ou Direction
CREATE OR REPLACE FUNCTION public.lecteur_equipe() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.mon_role() IN ('directeur', 'rr', 'coach', 'direction')
$$;

-- Le nom affiché du compte Direction (auteur des notes du carnet)
CREATE OR REPLACE FUNCTION public.mon_acces() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'role', public.mon_role(),
    'coach', (SELECT u.raw_app_meta_data->>'coach' FROM auth.users u WHERE u.id = auth.uid()),
    'rr', (SELECT u.raw_app_meta_data->>'rr' FROM auth.users u WHERE u.id = auth.uid()),
    'direction', (SELECT u.raw_app_meta_data->>'direction' FROM auth.users u WHERE u.id = auth.uid() AND public.mon_role() = 'direction'),
    'franchise', (SELECT a.franchise FROM public.acces_franchises a WHERE a.user_id = auth.uid() AND public.mon_role() = 'franchise'),
    'magasins', to_jsonb(public.mes_magasins())
  )
$$;

-- ── 2) Tables : une règle de lecture de plus, pour la Direction seule
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_config', 'store_overrides', 'reassigns', 'cs_overrides', 'recruits', 'visits', 'events', 'leaves',
    'suivi_magasins', 'perimetre_equipe', 'fiches_personnes', 'campagnes_regions', 'demandes', 'entretiens'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "direction_lecture" ON public.%I', t);
      EXECUTE format('CREATE POLICY "direction_lecture" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.est_direction()))', t);
    END IF;
  END LOOP;
END $$;

-- Le carnet : la Direction écrit des notes et y répond (rubrique notes seulement)
DROP POLICY IF EXISTS "direction_carnet_ajout" ON public.suivi_magasins;
DROP POLICY IF EXISTS "direction_carnet_modification" ON public.suivi_magasins;
CREATE POLICY "direction_carnet_ajout" ON public.suivi_magasins FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_direction()) AND cle = 'notes');
CREATE POLICY "direction_carnet_modification" ON public.suivi_magasins FOR UPDATE TO authenticated
  USING ((SELECT public.est_direction()) AND cle = 'notes') WITH CHECK ((SELECT public.est_direction()) AND cle = 'notes');

-- Ses préférences (état « lu » de la cloche, favoris), comme un membre de l'équipe
DO $$
BEGIN
  IF to_regclass('public.preferences') IS NOT NULL THEN
    DROP POLICY IF EXISTS "direction_preferences" ON public.preferences;
    CREATE POLICY "direction_preferences" ON public.preferences FOR ALL TO authenticated
      USING (user_id = (SELECT auth.uid()) AND (SELECT public.est_direction()))
      WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.est_direction()));
  END IF;
END $$;

-- ── 3) Fonctions de lecture : la Direction y est admise comme le Directeur (lecture) ou l'équipe
-- Réécriture de la définition en place : est_equipe() → lecteur_equipe(), est_directeur() → lecteur_reseau(),
-- listes de rôles complétées. Seulement des fonctions qui lisent ; aucune fonction qui écrit n'est touchée.
DO $$
DECLARE f text; d text; n text;
BEGIN
  FOREACH f IN ARRAY ARRAY['a_la_une', 'challenges_equipe', 'chiffres_mensuels', 'communication_visible', 'communications',
    'connaissances', 'couverture_caisse', 'historique_modifications', 'lectures_communications', 'lectures_pratiques',
    'magasins_questions', 'piece_visible', 'pratique_visible', 'presences_reunions', 'propositions_pratiques',
    'questions_equipe', 'rapports_du_compte', 'reactions_pratiques', 'reactions_visites', 'reperes_equipe',
    'resultats_questions', 'visite_visible', 'coachs_encadres'] LOOP
    FOR d IN SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f LOOP
      n := replace(d, 'public.est_equipe()', 'public.lecteur_equipe()');
      n := replace(n, 'public.est_directeur()', 'public.lecteur_reseau()');
      n := replace(n, 'NOT IN (''directeur'', ''rr'', ''coach'')', 'NOT IN (''directeur'', ''rr'', ''coach'', ''direction'')');
      n := replace(n, 'NOT IN (''directeur'', ''rr'')', 'NOT IN (''directeur'', ''rr'', ''direction'')');
      IF n <> d THEN EXECUTE n; END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── 4) Ouvrir, couper et lister les accès Direction (Directeur seul)
CREATE OR REPLACE FUNCTION public.ouvrir_acces_direction(p_email text, p_nom text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_role text; v_email text;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(trim(p_nom), '') = '' THEN RAISE EXCEPTION 'format'; END IF;
  SELECT u.id, coalesce(u.raw_app_meta_data->>'role', ''), u.email INTO v_id, v_role, v_email
  FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_id IS NULL THEN RAISE EXCEPTION 'compte_introuvable'; END IF;
  IF v_id = auth.uid() OR v_role = 'directeur' THEN RAISE EXCEPTION 'compte_directeur'; END IF;
  IF v_role = 'franchise' OR EXISTS (SELECT 1 FROM public.acces_franchises a WHERE a.user_id = v_id) THEN RAISE EXCEPTION 'compte_franchise'; END IF;
  IF v_role IN ('coach', 'rr') THEN RAISE EXCEPTION 'compte_equipe'; END IF;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'coach' - 'rr' - 'franchise')
    || jsonb_build_object('role', 'direction', 'direction', left(trim(p_nom), 80))
  WHERE id = v_id;
  RETURN jsonb_build_object('user_id', v_id, 'email', v_email);
END $$;

CREATE OR REPLACE FUNCTION public.couper_acces_direction(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE auth.users SET raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'direction') || '{"role":"sans_acces"}'::jsonb
  WHERE id = p_user AND raw_app_meta_data->>'role' = 'direction';
END $$;

CREATE OR REPLACE FUNCTION public.liste_acces_direction() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN public.est_directeur() THEN coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id, 'email', u.email, 'nom', u.raw_app_meta_data->>'direction', 'derniere_connexion', u.last_sign_in_at) ORDER BY u.email), '[]'::jsonb) END
  FROM auth.users u WHERE u.raw_app_meta_data->>'role' = 'direction'
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['est_direction()', 'lecteur_reseau()', 'lecteur_equipe()', 'mon_acces()',
    'ouvrir_acces_direction(text, text)', 'couper_acces_direction(uuid)', 'liste_acces_direction()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0054', 'acces_direction')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
