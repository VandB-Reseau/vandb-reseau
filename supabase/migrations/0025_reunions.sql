-- ════════════════════════════════════════════════════════════════
-- V and B — Réunions et formations : invités, réponse, présence (sprint 22, A2, 23/10/2026)
-- Réexécutable. Suppose 0001 (events), 0004 (mon_role, est_equipe, est_directeur, mes_magasins), 0005 (magasins_visibles), 0012 (journal).
--
-- 1) Un événement de l'agenda peut inviter des magasins (colonne events.invites ; vide = événement sans invités).
--    Seuls le Directeur et les Responsables Régionaux posent ou changent les invités.
-- 2) Le franchisé voit les réunions où ses magasins sont invités et répond Présent ou Absent (reunions_franchise, repondre_reunion).
-- 3) Après la date, l'équipe pointe les présents de ses magasins (pointer_presence) ;
--    elle lit réponses et présences de ses magasins (presences_reunions). Le Directeur voit tout.
-- 4) Personne ne lit ni n'écrit la table reunions_presences directement.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invites text[];

-- Le Coach ne pose ni ne change les invités (l'événement reste écrit par toute l'équipe)
CREATE OR REPLACE FUNCTION public.garde_invites() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr')
     AND (TG_OP = 'INSERT' AND cardinality(coalesce(NEW.invites, '{}')) > 0
          OR TG_OP = 'UPDATE' AND NEW.invites IS DISTINCT FROM OLD.invites) THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  IF cardinality(coalesce(NEW.invites, '{}')) > 1000 THEN RAISE EXCEPTION 'format'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS garde_invites ON public.events;
CREATE TRIGGER garde_invites BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.garde_invites();

CREATE TABLE IF NOT EXISTS public.reunions_presences (
  event_id   bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  reponse    text CHECK (reponse IN ('present', 'absent')),
  repondu_le timestamptz,
  present    boolean,
  pointe_le  timestamptz,
  PRIMARY KEY (event_id, store_name)
);
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reunions_presences' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reunions_presences', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.reunions_presences FROM anon, authenticated;

-- Franchisé : réunions des 12 derniers mois et à venir où ses magasins sont invités, avec sa réponse
CREATE OR REPLACE FUNCTION public.reunions_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.mes_magasins();
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titre', e.title, 'debut', e.start_date, 'fin', coalesce(e.end_date, e.start_date), 'notes', coalesce(e.notes, ''),
      'magasins', (SELECT to_jsonb(array_agg(m ORDER BY m)) FROM unnest(e.invites) m WHERE m = ANY(v_mag)),
      'reponse', (SELECT p.reponse FROM public.reunions_presences p WHERE p.event_id = e.id AND p.store_name = ANY(v_mag) AND p.reponse IS NOT NULL ORDER BY p.repondu_le DESC LIMIT 1),
      'present', (SELECT bool_or(p.present) FROM public.reunions_presences p WHERE p.event_id = e.id AND p.store_name = ANY(v_mag))
    ) ORDER BY e.start_date, e.id), '[]'::jsonb)
    FROM public.events e
    WHERE e.invites && v_mag AND coalesce(e.end_date, e.start_date) >= current_date - 365);
END $$;

-- Franchisé : répond pour tous ses magasins invités, jusqu'au dernier jour de la réunion
CREATE OR REPLACE FUNCTION public.repondre_reunion(p_id bigint, p_reponse text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[]; v_inv text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_reponse NOT IN ('present', 'absent') THEN RAISE EXCEPTION 'format'; END IF;
  v_mag := public.mes_magasins();
  SELECT array_agg(m) INTO v_inv FROM public.events e, unnest(e.invites) m
  WHERE e.id = p_id AND m = ANY(v_mag) AND coalesce(e.end_date, e.start_date) >= current_date;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  INSERT INTO public.reunions_presences AS p (event_id, store_name, reponse, repondu_le)
  SELECT p_id, m, p_reponse, now() FROM unnest(v_inv) m
  ON CONFLICT (event_id, store_name) DO UPDATE SET reponse = excluded.reponse, repondu_le = now();
END $$;

-- Équipe : réponses et présences des magasins qu'elle suit (tous pour le Directeur)
CREATE OR REPLACE FUNCTION public.presences_reunions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := CASE WHEN public.est_directeur() THEN NULL ELSE public.magasins_visibles() END;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('event', p.event_id, 'magasin', p.store_name, 'reponse', p.reponse, 'present', p.present)), '[]'::jsonb)
    FROM public.reunions_presences p WHERE v_mag IS NULL OR p.store_name = ANY(v_mag));
END $$;

-- Équipe : pointe un magasin invité présent (true), absent (false) ou efface (NULL), une fois la réunion commencée
CREATE OR REPLACE FUNCTION public.pointer_presence(p_id bigint, p_magasin text, p_present boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NOT public.est_directeur() AND NOT p_magasin = ANY(public.magasins_visibles()) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_id AND p_magasin = ANY(e.invites) AND e.start_date <= current_date) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  INSERT INTO public.reunions_presences AS p (event_id, store_name, present, pointe_le)
  VALUES (p_id, p_magasin, p_present, now())
  ON CONFLICT (event_id, store_name) DO UPDATE SET present = excluded.present, pointe_le = now();
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['reunions_franchise()', 'repondre_reunion(bigint, text)', 'presences_reunions()', 'pointer_presence(bigint, text, boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.garde_invites() FROM PUBLIC, anon, authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0025', 'reunions')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la colonne et la table existent, la table sans accès direct
SELECT 'events.invites' AS element, count(*) AS present FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'invites'
UNION ALL
SELECT 'reunions_presences (accès direct)', (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = 'reunions_presences' AND g.grantee IN ('anon', 'authenticated'));
