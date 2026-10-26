-- ════════════════════════════════════════════════════════════════
-- V and B — Agenda de l'app dans Google Agenda (24/10/2026, sprint 25, F2)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (rôles), 0005 (périmètre), 0012 (journal), 0017 (visites
-- prévues), 0025 et 0030 (heure et invités des événements).
--
-- 1) agenda_jetons : un lien secret par compte de l'équipe (Directeur, RR, Coach), avec le nom de la personne tel que
--    l'app l'écrit dans les visites. Table fermée : aucune règle, aucun droit pour les comptes.
-- 2) mon_agenda(p_nom, p_nouveau) : le compte connecté de l'équipe lit son lien (créé au premier appel) ;
--    p_nouveau = true le remplace, l'ancien cesse de marcher. Refusé au franchisé et au compte sans rôle.
-- 3) agenda_du_jeton(p_jeton) : pour la fonction Supabase « agenda » seule (service_role), qui sert le fichier
--    .ics relu par Google Agenda. Renvoie, de 30 jours avant à un an après :
--    - les visites où la personne est visiteur, sur les magasins qu'elle voit (tous pour le Directeur),
--      avec l'heure préparée pour une visite prévue (rubrique « preparation » du suivi) ;
--    - les événements, réunions et formations de l'agenda, lisibles par toute l'équipe.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agenda_jetons (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  jeton   text NOT NULL UNIQUE CHECK (length(jeton) >= 40),
  nom     text NOT NULL DEFAULT '',
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agenda_jetons ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_jetons' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.agenda_jetons', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.agenda_jetons FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mon_agenda(p_nom text, p_nouveau boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_jeton text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT jeton INTO v_jeton FROM public.agenda_jetons WHERE user_id = auth.uid();
  IF v_jeton IS NULL OR p_nouveau THEN
    -- Deux identifiants aléatoires : 64 caractères impossibles à deviner
    v_jeton := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  END IF;
  INSERT INTO public.agenda_jetons (user_id, jeton, nom) VALUES (auth.uid(), v_jeton, left(coalesce(trim(p_nom), ''), 120))
  ON CONFLICT (user_id) DO UPDATE SET jeton = EXCLUDED.jeton, nom = EXCLUDED.nom,
    cree_le = CASE WHEN public.agenda_jetons.jeton = EXCLUDED.jeton THEN public.agenda_jetons.cree_le ELSE now() END;
  RETURN v_jeton;
END $$;
REVOKE ALL ON FUNCTION public.mon_agenda(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mon_agenda(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.agenda_du_jeton(p_jeton text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE j record; v_role text; v_meta jsonb; v_mag text[];
BEGIN
  SELECT a.user_id, a.nom INTO j FROM public.agenda_jetons a WHERE a.jeton = p_jeton AND length(coalesce(p_jeton, '')) >= 40;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT u.raw_app_meta_data INTO v_meta FROM auth.users u WHERE u.id = j.user_id;
  v_role := coalesce(v_meta->>'role', '');
  IF v_role NOT IN ('directeur', 'rr', 'coach') THEN RETURN NULL; END IF;
  -- Magasins vus : même règle que magasins_visibles(), pour ce compte
  SELECT coalesce(array_agg(p.store_name), '{}') INTO v_mag FROM public.perimetre_equipe p
  WHERE (v_role = 'coach' AND p.coach = v_meta->>'coach') OR (v_role = 'rr' AND (v_meta->>'rr') = ANY(p.rrs));
  RETURN jsonb_build_object(
    'nom', j.nom,
    'visites', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'magasin', v.store, 'date', v.visit_date, 'type', coalesce(v.type, 'terrain'), 'prevue', v.prevue,
        'heure', CASE WHEN v.prevue THEN (SELECT s.valeur->>'heure' FROM public.suivi_magasins s WHERE s.store_name = v.store AND s.cle = 'preparation') END)
        ORDER BY v.visit_date), '[]'::jsonb)
      FROM public.visits v
      WHERE v.visit_date BETWEEN current_date - 30 AND current_date + 365
        AND coalesce(v.type, 'terrain') NOT IN ('appel', 'point', 'feuille')
        AND (v_role = 'directeur' OR v.store = ANY(v_mag))
        AND j.nom <> '' AND position(lower(j.nom) IN lower(coalesce(v.visitor, ''))) > 0),
    'evenements', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'titre', e.title, 'type', coalesce(e.type, 'event'), 'debut', e.start_date, 'fin', coalesce(e.end_date, e.start_date),
        'heure', e.heure, 'notes', e.notes) ORDER BY e.start_date), '[]'::jsonb)
      FROM public.events e
      WHERE coalesce(e.end_date, e.start_date) >= current_date - 30 AND e.start_date <= current_date + 365));
END $$;
REVOKE ALL ON FUNCTION public.agenda_du_jeton(text) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.agenda_du_jeton(text) TO service_role;
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0034', 'agenda_abonne')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
