-- ════════════════════════════════════════════════════════════════
-- V and B — Équipements du magasin (Joseph, 14/11/2026)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (acces_franchises, json_sur), 0005 (suivi_magasins) et 0044
-- (rubrique « integration », animation_franchise()).
--
-- Le matériel acheté et mis à disposition du magasin, surtout pour le marché extérieur (tireuses, barnums, stands,
-- camion frigorifique, chariot…) : rubrique « equipements » de suivi_magasins, une liste par magasin, tenue par
-- l'équipe avec le même cloisonnement que le reste du suivi (Coach et RR sur leurs magasins, Directeur partout).
-- Le franchisé la lit pour ses magasins par animation_franchise() (Joseph, 14/11/2026 14h06) et la modifie par
-- ecrire_equipements() (Joseph, 14h25), sur ses magasins seulement ; il n'a toujours aucun accès direct à la table.
-- ════════════════════════════════════════════════════════════════

-- ── Rubrique « equipements » ──────────────────────────────────────
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise', 'objectifs', 'plan', 'integration', 'equipements'));

-- ── Ce que le franchisé lit : temps forts, parcours, suivi et équipements de ses magasins ─
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
      WHERE s.cle = 'equipements' AND s.store_name = ANY(coalesce(v_mag, '{}'))));
END $$;

REVOKE ALL ON FUNCTION public.animation_franchise() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.animation_franchise() TO authenticated;

-- ── Le franchisé tient les équipements de ses magasins (liste entière réécrite, 200 lignes au plus) ─
CREATE OR REPLACE FUNCTION public.ecrire_equipements(p_store text, p_liste jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  IF p_store IS NULL OR NOT (p_store = ANY(coalesce(v_mag, '{}'))) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF jsonb_typeof(p_liste) IS DISTINCT FROM 'array' OR jsonb_array_length(p_liste) > 200
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_liste) e WHERE jsonb_typeof(e) <> 'object') THEN RAISE EXCEPTION 'format'; END IF;
  IF length(p_liste::text) > 100000 THEN RAISE EXCEPTION 'format'; END IF;
  IF jsonb_array_length(p_liste) = 0 THEN
    DELETE FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'equipements';
  ELSE
    INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'equipements', p_liste)
    ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur, maj_le = now();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.ecrire_equipements(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_equipements(text, jsonb) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0046', 'equipements_magasins')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
