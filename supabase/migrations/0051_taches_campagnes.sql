-- ════════════════════════════════════════════════════════════════
-- V and B — Points des campagnes = tâches du magasin (Joseph, 18/11/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0005 (constats par magasin, campagnes_regions, json_sur) et 0007
-- (franchise_du_magasin).
--
-- Rien n'est recopié : l'application lit chaque point d'une campagne en cours comme une tâche de chaque magasin
-- concerné ; la tâche est faite quand le point est constaté fait (rubrique « constats » de suivi_magasins).
-- L'équipe constate comme avant. Le franchisé, qui ne lit aucune table, marque un point fait depuis sa tâche par
-- constat_campagne_franchise() : sur ses magasins seulement, sur un point qui existe dans une campagne, et il ne
-- rouvre que ce qu'il a lui-même marqué (un constat de son Coach reste intact).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.constat_campagne_franchise(p_store text, p_campagne text, p_point text, p_fait boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fr text := public.franchise_du_magasin(p_store);
  v_jour text := to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD');
  v_k jsonb;
  v_c jsonb;
BEGIN
  -- Le point doit exister dans une campagne du réseau ou d'une région
  IF coalesce(p_campagne, '') = '' OR coalesce(p_point, '') = '' OR NOT EXISTS (
    SELECT 1 FROM (
      SELECT c FROM public.app_config a, jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(a.value)->'liste') = 'array' THEN public.json_sur(a.value)->'liste' ELSE '[]'::jsonb END) c
      WHERE a.key = 'campagnes'
      UNION ALL
      SELECT r.valeur || jsonb_build_object('id', r.id) FROM public.campagnes_regions r WHERE jsonb_typeof(r.valeur) = 'object'
    ) l
    WHERE jsonb_typeof(l.c) = 'object' AND l.c->>'id' = p_campagne AND jsonb_typeof(l.c->'points') = 'array'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.c->'points') p WHERE p->>'id' = p_point)
  ) THEN
    RAISE EXCEPTION 'action_introuvable';
  END IF;

  SELECT s.valeur INTO v_k FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'constats' FOR UPDATE;
  IF jsonb_typeof(v_k) IS DISTINCT FROM 'object' THEN v_k := '{}'::jsonb; END IF;
  v_c := CASE WHEN jsonb_typeof(v_k->p_campagne) = 'object' THEN v_k->p_campagne ELSE '{}'::jsonb END;

  IF p_fait THEN
    v_c := v_c || jsonb_build_object(p_point, jsonb_build_object('fait', true, 'date', v_jour, 'par', v_fr));
  ELSE
    IF v_c->p_point->>'par' IS DISTINCT FROM v_fr THEN RAISE EXCEPTION 'action_introuvable'; END IF;
    v_c := v_c - p_point;
  END IF;
  v_k := CASE WHEN v_c = '{}'::jsonb THEN v_k - p_campagne ELSE v_k || jsonb_build_object(p_campagne, v_c) END;

  INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'constats', v_k)
  ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur, maj_le = now();
END $$;

REVOKE ALL ON FUNCTION public.constat_campagne_franchise(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.constat_campagne_franchise(text, text, text, boolean) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0051', 'taches_campagnes')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
