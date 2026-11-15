-- ════════════════════════════════════════════════════════════════
-- V and B — Opérations commerciales du magasin et mesure en caisse des priorités (Joseph, 15/11/2026, choix 184 et 185)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (acces_franchises, json_sur), 0005 (suivi_magasins), 0043
-- (plans_franchise()) et 0046 (rubrique « equipements », animation_franchise()).
--
-- 185 · Journal des opérations commerciales : rubrique « operations » de suivi_magasins, une liste par magasin
-- (dégustation, soirée, promotion…, avec sa date, son univers et son coût), tenue par l'équipe avec le cloisonnement du
-- suivi (Coach et RR sur leurs magasins, Directeur partout). Le franchisé la lit par animation_franchise() et la modifie
-- par ecrire_operations(), sur ses magasins seulement ; il n'a toujours aucun accès direct à la table.
-- 184 · Une priorité née d'un simulateur garde sa mesure en caisse (indicateur, gain attendu par mois, mois de départ) :
-- plans_franchise() la renvoie au franchisé, toujours sans l'objectif chiffré.
-- ════════════════════════════════════════════════════════════════

-- ── Rubrique « operations » ───────────────────────────────────────
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise', 'objectifs', 'plan', 'integration', 'equipements', 'operations'));

-- ── Plans d'action du franchisé : titres, statuts et mesure en caisse (jamais l'objectif chiffré) ─
CREATE OR REPLACE FUNCTION public.plans_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() <> 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  RETURN (SELECT coalesce(jsonb_object_agg(s.store_name, (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', e->>'id', 'titre', e->>'titre', 'statut', coalesce(e->>'statut', 'active'),
      'bilan', coalesce(e->>'bilan', ''), 'creeLe', coalesce(e->>'creeLe', ''), 'closLe', coalesce(e->>'closLe', ''))
      || CASE WHEN jsonb_typeof(e->'mesure') = 'object' THEN jsonb_build_object('mesure', jsonb_build_object(
        'indicateur', e->'mesure'->>'indicateur', 'attendu', e->'mesure'->'attendu', 'depuis', e->'mesure'->>'depuis', 'source', coalesce(e->'mesure'->>'source', '')))
        ELSE '{}'::jsonb END ORDER BY o), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, o)
    WHERE jsonb_typeof(e) = 'object' AND coalesce(e->>'titre', '') <> '')), '{}'::jsonb)
    FROM public.suivi_magasins s WHERE s.cle = 'plan' AND s.store_name = ANY(coalesce(v_mag, '{}')));
END $$;

REVOKE ALL ON FUNCTION public.plans_franchise() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plans_franchise() TO authenticated;

-- ── Ce que le franchisé lit : temps forts, parcours, suivi, équipements et opérations de ses magasins ─
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
      WHERE s.cle = 'operations' AND s.store_name = ANY(coalesce(v_mag, '{}'))));
END $$;

REVOKE ALL ON FUNCTION public.animation_franchise() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.animation_franchise() TO authenticated;

-- ── Le franchisé tient le journal des opérations de ses magasins (liste entière réécrite, 300 lignes au plus) ─
CREATE OR REPLACE FUNCTION public.ecrire_operations(p_store text, p_liste jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  IF p_store IS NULL OR NOT (p_store = ANY(coalesce(v_mag, '{}'))) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF jsonb_typeof(p_liste) IS DISTINCT FROM 'array' OR jsonb_array_length(p_liste) > 300
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_liste) e WHERE jsonb_typeof(e) <> 'object') THEN RAISE EXCEPTION 'format'; END IF;
  IF length(p_liste::text) > 150000 THEN RAISE EXCEPTION 'format'; END IF;
  IF jsonb_array_length(p_liste) = 0 THEN
    DELETE FROM public.suivi_magasins s WHERE s.store_name = p_store AND s.cle = 'operations';
  ELSE
    INSERT INTO public.suivi_magasins AS s (store_name, cle, valeur) VALUES (p_store, 'operations', p_liste)
    ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur, maj_le = now();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.ecrire_operations(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_operations(text, jsonb) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0047', 'operations_mesure_priorites')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
