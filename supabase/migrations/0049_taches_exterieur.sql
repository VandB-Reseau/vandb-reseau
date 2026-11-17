-- ════════════════════════════════════════════════════════════════
-- V and B — Actions du plan « Marché extérieur » = tâches du magasin (Joseph, 17/11/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0007 (franchise_du_magasin, ajouter_action_franchise), 0043 et 0048.
--
-- Chaque action d'une cible devient une tâche de la rubrique « actions » de suivi_magasins, marquée
-- « exterieur » : {cible, nom}. Plusieurs tâches par cible ; elles se suivent dans la liste Tâches comme les autres
-- (le franchisé les coche par marquer_action_franchise et statut_action_franchise, inchangées).
-- Le franchisé crée, modifie et supprime ces tâches depuis son plan, sur ses magasins seulement, par
-- tache_exterieur_franchise() : jamais une tâche qui n'est pas marquée « exterieur ».
-- Les actions déjà saisies dans les plans (une par cible, champ « action ») sont reprises en tâches, puis retirées du plan.
-- ════════════════════════════════════════════════════════════════

-- ── Le franchisé tient les tâches du plan extérieur de ses magasins ───────────────────────────────
-- p_id vide : nouvelle tâche (identifiant renvoyé) ; p_supprimer : la tâche est retirée
CREATE OR REPLACE FUNCTION public.tache_exterieur_franchise(p_store text, p_id text, p_cible text, p_nom text, p_action text,
  p_porteur text DEFAULT '', p_echeance text DEFAULT '', p_supprimer boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_texte text := left(regexp_replace(btrim(coalesce(p_action, '')), '\s+', ' ', 'g'), 1000);
  v_echeance text := btrim(coalesce(p_echeance, ''));
  v_cible text := left(btrim(coalesce(p_cible, '')), 40);
  v_nom text := left(btrim(coalesce(p_nom, '')), 160);
  v_id text := btrim(coalesce(p_id, ''));
  v_l jsonb;
  v_a jsonb;
BEGIN
  SELECT s.valeur INTO v_l FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'actions' FOR UPDATE;
  IF jsonb_typeof(v_l) IS DISTINCT FROM 'array' THEN v_l := '[]'::jsonb; END IF;
  -- Une tâche existante n'est touchée que si elle vient du plan extérieur
  IF v_id <> '' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_l) e WHERE e->>'id' = v_id AND jsonb_typeof(e->'exterieur') = 'object') THEN
    RAISE EXCEPTION 'action_introuvable';
  END IF;
  IF p_supprimer THEN
    IF v_id = '' THEN RAISE EXCEPTION 'action_introuvable'; END IF;
    UPDATE public.suivi_magasins SET valeur = (SELECT coalesce(jsonb_agg(e ORDER BY o), '[]'::jsonb) FROM jsonb_array_elements(v_l) WITH ORDINALITY AS t(e, o) WHERE e->>'id' IS DISTINCT FROM v_id), maj_le = now()
    WHERE store_name = p_store AND cle = 'actions';
    RETURN v_id;
  END IF;
  IF v_texte = '' THEN RAISE EXCEPTION 'action_vide'; END IF;
  IF v_cible = '' OR v_nom = '' THEN RAISE EXCEPTION 'format'; END IF;
  IF v_echeance <> '' AND v_echeance !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'echeance_invalide'; END IF;
  IF v_id = '' THEN
    IF jsonb_array_length(v_l) >= 2000 THEN RAISE EXCEPTION 'format'; END IF;
    v_id := 'l_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    v_a := jsonb_build_object('id', v_id, 'action', v_texte, 'porteur', left(btrim(coalesce(p_porteur, '')), 200), 'echeance', v_echeance,
      'creeLe', to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD'), 'auteur', v_fr,
      'exterieur', jsonb_build_object('cible', v_cible, 'nom', v_nom));
    INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'actions', jsonb_build_array(v_a))
    ON CONFLICT (store_name, cle) DO UPDATE
      SET valeur = (CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) || excluded.valeur, maj_le = now();
    RETURN v_id;
  END IF;
  -- Modification : texte, porteur, échéance ; statut, fait, auteur et date de création gardés
  UPDATE public.suivi_magasins SET valeur = (SELECT jsonb_agg(CASE WHEN e->>'id' = v_id
      THEN e || jsonb_build_object('action', v_texte, 'porteur', left(btrim(coalesce(p_porteur, '')), 200), 'echeance', v_echeance,
        'exterieur', jsonb_build_object('cible', v_cible, 'nom', v_nom))
      ELSE e END ORDER BY o) FROM jsonb_array_elements(v_l) WITH ORDINALITY AS t(e, o)), maj_le = now()
  WHERE store_name = p_store AND cle = 'actions';
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.tache_exterieur_franchise(text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tache_exterieur_franchise(text, text, text, text, text, text, text, boolean) TO authenticated;

-- ── Reprise des actions déjà saisies dans les plans ─────────────────────────────────────────────
-- Une tâche par cible qui avait une action (abandonnée : non reprise) ; identifiant tiré de la cible, jamais repris deux fois
DO $$ DECLARE r record; v_taches jsonb; v_cibles jsonb; BEGIN
  FOR r IN SELECT s.store_name, s.valeur FROM public.suivi_magasins s
    WHERE s.cle = 'exterieur' AND jsonb_typeof(s.valeur) = 'object' AND jsonb_typeof(s.valeur->'cibles') = 'array'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.valeur->'cibles') c WHERE jsonb_typeof(c) = 'object' AND btrim(coalesce(c->>'action', '')) <> '') LOOP
    SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', 'l_ext_' || left(c->>'id', 40),
        'action', left(btrim(c->>'action'), 1000),
        'porteur', left(coalesce(c->>'qui', ''), 200),
        'echeance', CASE WHEN coalesce(c->>'echeance', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN c->>'echeance' ELSE '' END,
        'creeLe', CASE WHEN coalesce(c->>'le', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN c->>'le' ELSE to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') END,
        'auteur', nullif(c->>'par', ''),
        'faite', CASE WHEN c->>'statut' = 'fait' THEN to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') END,
        'statut', CASE WHEN c->>'statut' = 'en_cours' THEN 'en_cours' END,
        'exterieur', jsonb_build_object('cible', left(c->>'id', 40), 'nom', left(coalesce(c->>'nom', ''), 160))))), '[]'::jsonb)
    INTO v_taches
    FROM jsonb_array_elements(r.valeur->'cibles') c
    WHERE jsonb_typeof(c) = 'object' AND btrim(coalesce(c->>'action', '')) <> '' AND coalesce(c->>'statut', '') <> 'abandon'
      AND coalesce(c->>'id', '') <> ''
      AND NOT EXISTS (SELECT 1 FROM public.suivi_magasins a, jsonb_array_elements(CASE WHEN jsonb_typeof(a.valeur) = 'array' THEN a.valeur ELSE '[]'::jsonb END) e
        WHERE a.store_name = r.store_name AND a.cle = 'actions' AND e->>'id' = 'l_ext_' || left(c->>'id', 40));
    IF jsonb_array_length(v_taches) > 0 THEN
      INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (r.store_name, 'actions', v_taches)
      ON CONFLICT (store_name, cle) DO UPDATE
        SET valeur = (CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) || excluded.valeur, maj_le = now();
    END IF;
    SELECT jsonb_agg(CASE WHEN jsonb_typeof(c) = 'object' THEN c - 'action' - 'qui' - 'echeance' - 'statut' ELSE c END ORDER BY o) INTO v_cibles
    FROM jsonb_array_elements(r.valeur->'cibles') WITH ORDINALITY AS t(c, o);
    UPDATE public.suivi_magasins SET valeur = jsonb_set(r.valeur, '{cibles}', v_cibles), maj_le = now()
    WHERE store_name = r.store_name AND cle = 'exterieur';
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0049', 'taches_exterieur')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
