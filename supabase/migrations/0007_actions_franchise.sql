-- ════════════════════════════════════════════════════════════════
-- V and B — Le franchisé coche et ajoute les actions de ses magasins
-- 20/10/2026 (PR #52). Réexécutable. Suppose 0004, 0005 et 0006.
--
-- 1) Un franchisé ne lit ni n'écrit aucune table : il passe par les deux fonctions ci-dessous,
--    qui vérifient que le magasin fait partie des siens (table acces_franchises).
-- 2) Il peut cocher faite (ou remettre à faire) une action du plan d'une visite de son magasin
--    ou une action hors visite, et ajouter une action hors visite.
-- 3) Son nom et la date sont posés par la base (« faitePar », « auteur »), jamais par l'app.
-- 4) Il ne modifie ni ne supprime une action : l'équipe garde la main.
-- ════════════════════════════════════════════════════════════════

-- Franchisé connecté, s'il a ce magasin ; sinon refus
CREATE OR REPLACE FUNCTION public.franchise_du_magasin(p_store text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fr text;
BEGIN
  IF public.mon_role() <> 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.franchise INTO v_fr FROM public.acces_franchises a WHERE a.user_id = auth.uid() AND p_store = ANY(a.magasins);
  IF v_fr IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN v_fr;
END $$;

-- Ajoute une action hors visite (une liste par magasin dans suivi_magasins, rubrique « actions »),
-- avec ses photos et fichiers (pieces_propres, 0006)
DROP FUNCTION IF EXISTS public.ajouter_action_franchise(text, text, text, text);
CREATE OR REPLACE FUNCTION public.ajouter_action_franchise(p_store text, p_action text, p_porteur text DEFAULT '', p_echeance text DEFAULT '', p_pieces jsonb DEFAULT '[]') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_texte text := regexp_replace(btrim(coalesce(p_action, '')), '\s+', ' ', 'g');
  v_echeance text := btrim(coalesce(p_echeance, ''));
  v_a jsonb;
BEGIN
  IF v_texte = '' OR length(v_texte) > 1000 THEN RAISE EXCEPTION 'action_vide'; END IF;
  IF v_echeance <> '' AND v_echeance !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'echeance_invalide'; END IF;
  v_a := jsonb_build_object(
    'id', 'l_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    'action', v_texte, 'porteur', left(btrim(coalesce(p_porteur, '')), 200), 'echeance', v_echeance,
    'creeLe', to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD'), 'auteur', v_fr);
  IF jsonb_array_length(public.pieces_propres(p_pieces)) > 0 THEN v_a := v_a || jsonb_build_object('pieces', public.pieces_propres(p_pieces)); END IF;
  INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'actions', jsonb_build_array(v_a))
  ON CONFLICT (store_name, cle) DO UPDATE
    SET valeur = (CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) || excluded.valeur, maj_le = now();
END $$;

-- Coche faite ou remet à faire : une action hors visite (p_libre = son id)
-- ou l'action n° p_index du plan de la visite p_visite (actions vides ignorées, comme dans l'app ; texte vérifié)
CREATE OR REPLACE FUNCTION public.marquer_action_franchise(p_store text, p_faite boolean, p_libre text DEFAULT NULL, p_visite bigint DEFAULT NULL, p_index integer DEFAULT NULL, p_texte text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_jour text := to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD');
  v_l jsonb; v_e jsonb;
BEGIN
  IF p_libre IS NOT NULL THEN
    SELECT s.valeur INTO v_l FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'actions' FOR UPDATE;
    IF jsonb_typeof(v_l) IS DISTINCT FROM 'array' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_l) e WHERE e->>'id' = p_libre) THEN
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

-- Droits d'appel : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['franchise_du_magasin(text)', 'ajouter_action_franchise(text, text, text, text, jsonb)',
    'marquer_action_franchise(text, boolean, text, bigint, integer, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vérification : les trois fonctions existent
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('franchise_du_magasin', 'ajouter_action_franchise', 'marquer_action_franchise') ORDER BY 1;
