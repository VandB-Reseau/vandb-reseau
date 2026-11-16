-- ════════════════════════════════════════════════════════════════
-- V and B — Plan d'action « Marché extérieur » du magasin (Joseph, 16/11/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (acces_franchises, json_sur), 0005 (suivi_magasins), 0044
-- (animation_franchise()), 0046 et 0047 (rubriques « equipements » et « operations »).
--
-- Rubrique « exterieur » de suivi_magasins, un objet par magasin : rayon de recherche, objectif, cibles retenues (repérées
-- dans l'Annuaire des entreprises ou ajoutées à la main), diagnostic noté de 1 à 5 et plan d'action. Tenue par l'équipe
-- avec le cloisonnement du suivi (Coach et RR sur leurs magasins, Directeur partout). Le franchisé la lit par
-- animation_franchise() et la modifie par ecrire_exterieur(), sur ses magasins seulement ; toujours aucun accès direct
-- à la table.
-- ════════════════════════════════════════════════════════════════

-- ── Rubrique « exterieur » ────────────────────────────────────────
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise', 'objectifs', 'plan', 'integration', 'equipements', 'operations', 'exterieur'));

-- ── Ce que le franchisé lit : temps forts, parcours, suivi, équipements, opérations et plan extérieur de ses magasins ─
CREATE OR REPLACE FUNCTION public.animation_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  RETURN jsonb_build_object(
    'temps_forts', coalesce((SELECT public.json_sur(c.value) FROM public.app_config c WHERE c.key = 'temps_forts'), '[]'::jsonb),
    'parcours_integration', (SELECT public.json_sur(c.value) FROM public.app_config c WHERE c.key = 'parcours_integration'),
    'integration', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s
      WHERE s.cle = 'integration' AND s.store_name = ANY(coalesce(v_mag, '{}'))),
    'equipements', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s
      WHERE s.cle = 'equipements' AND s.store_name = ANY(coalesce(v_mag, '{}'))),
    'operations', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s
      WHERE s.cle = 'operations' AND s.store_name = ANY(coalesce(v_mag, '{}'))),
    'exterieur', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s
      WHERE s.cle = 'exterieur' AND s.store_name = ANY(coalesce(v_mag, '{}'))));
END $$;

REVOKE ALL ON FUNCTION public.animation_franchise() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.animation_franchise() TO authenticated;

-- ── Le franchisé tient le plan extérieur de ses magasins (objet entier réécrit, 300 cibles au plus) ─
CREATE OR REPLACE FUNCTION public.ecrire_exterieur(p_store text, p_plan jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  IF p_store IS NULL OR NOT (p_store = ANY(coalesce(v_mag, '{}'))) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF jsonb_typeof(p_plan) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'format'; END IF;
  IF jsonb_typeof(coalesce(p_plan->'cibles', '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_plan->'cibles', '[]'::jsonb)) > 300
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_plan->'cibles', '[]'::jsonb)) e WHERE jsonb_typeof(e) <> 'object') THEN RAISE EXCEPTION 'format'; END IF;
  IF length(p_plan::text) > 200000 THEN RAISE EXCEPTION 'format'; END IF;
  INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'exterieur', p_plan)
  ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur, maj_le = now();
END $$;

REVOKE ALL ON FUNCTION public.ecrire_exterieur(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_exterieur(text, jsonb) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0048', 'marche_exterieur')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
