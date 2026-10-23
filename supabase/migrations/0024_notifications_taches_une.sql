-- 0024 : notifications sur le téléphone pour une tâche confiée et une communication mise à la une (sprint 22, F2).
-- Lues seulement par la fonction Supabase « notifier » (service_role), comme notifications_a_envoyer (0016, 0018).
-- Réexécutable ; ne rouvre aucun accès.

-- Tâche confiée (hors visite) : p_cles = porteurs désignés (clés coach:, rr:, franchise:, directeur), au plus 10.
-- L'auteur doit voir le magasin ; la tâche doit exister dans le suivi du magasin, non faite, créée aujourd'hui ou hier (creeLe est un jour) ;
-- chaque destinataire doit voir le magasin (une tâche « Équipe seule » ne part jamais vers un franchisé).
CREATE OR REPLACE FUNCTION public.notifications_tache(p_store text, p_tache text, p_cles text[], p_auteur uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb := '[]'::jsonb; t jsonb;
BEGIN
  IF NOT public.compte_lit_magasin(p_auteur, p_store, false) AND NOT public.compte_lit_magasin(p_auteur, p_store, true) THEN RETURN v; END IF;
  SELECT e INTO t FROM public.suivi_magasins s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) e
  WHERE s.store_name = p_store AND s.cle = 'actions' AND e->>'id' = p_tache LIMIT 1;
  IF t IS NULL OR t ? 'faite' THEN RETURN v; END IF;
  IF coalesce(t->>'creeLe', '') !~ '^\d{4}-\d{2}-\d{2}' OR left(t->>'creeLe', 10)::date < current_date - 1 THEN RETURN v; END IF;
  WITH d AS (
    SELECT DISTINCT k.user_id FROM unnest(p_cles[1:10]) c, LATERAL public.comptes_de_cle(c) k(user_id)
    WHERE k.user_id <> p_auteur AND public.compte_lit_magasin(k.user_id, p_store, coalesce(t->>'fil', '') = 'equipe')
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', 'Nouvelle tâche · ' || p_store,
      'texte', left(coalesce(t->>'action', ''), 140) || coalesce(' · échéance ' || nullif(t->>'echeance', ''), ''),
      'lien', '#/taches')), '[]'::jsonb) INTO v
  FROM d JOIN public.abonnements_push a ON a.user_id = d.user_id;
  RETURN v;
END $$;

-- Communication mise à la une : les franchisés des magasins visés (tout le réseau si magasins est vide).
-- Seuls le Directeur et l'auteur (RR) la mettent à la une : on reprend la même règle que mettre_a_la_une.
CREATE OR REPLACE FUNCTION public.notifications_une(p_ids bigint[], p_auteur uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
      'titre', 'À la une · Réseau V and B',
      'texte', left(c.titre, 140),
      'lien', '#/echanges/reseau')), '[]'::jsonb)
  FROM public.communications c
  JOIN auth.users u ON u.id = p_auteur
  JOIN public.acces_franchises f ON c.magasins IS NULL OR cardinality(c.magasins) = 0 OR c.magasins && f.magasins
  JOIN public.abonnements_push a ON a.user_id = f.user_id
  WHERE c.id = ANY(p_ids[1:20]) AND c.a_la_une >= current_date
    AND (u.raw_app_meta_data->>'role' = 'directeur' OR (u.raw_app_meta_data->>'role' = 'rr' AND c.auteur = p_auteur))
    AND f.user_id <> p_auteur
$$;

REVOKE ALL ON FUNCTION public.notifications_tache(text, text, text[], uuid), public.notifications_une(bigint[], uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.notifications_tache(text, text, text[], uuid), public.notifications_une(bigint[], uuid) TO service_role;
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0024', 'notifications_taches_une')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : les deux fonctions existent
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('notifications_tache', 'notifications_une') ORDER BY 1;
