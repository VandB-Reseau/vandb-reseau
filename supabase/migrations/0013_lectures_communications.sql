-- ════════════════════════════════════════════════════════════════
-- V and B — Lecture des communications par les franchisés (21/10/2026)
-- Réexécutable. Suppose 0004 (acces_franchises), 0006 (magasins_messagerie), 0008 (communications) et 0012 (journal).
--
-- 1) Quand un franchisé affiche les communications, l'app note qu'il les a lues (une ligne par
--    communication et par compte franchisé, la première lecture seulement).
-- 2) Le Directeur de réseau et les Responsables Régionaux voient, pour chaque communication,
--    les franchisés concernés qui l'ont lue et ceux qui ne l'ont pas encore lue.
--    Un Responsable Régional ne voit que les franchisés de ses magasins.
-- 3) Personne ne lit ni n'écrit la table directement : tout passe par les deux fonctions.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.communications_lectures (
  communication bigint NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lu_le         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (communication, user_id)
);
ALTER TABLE public.communications_lectures ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communications_lectures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.communications_lectures', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.communications_lectures FROM anon, authenticated;

-- Le franchisé connecté a lu ces communications (celles qu'il ne voit pas sont ignorées)
CREATE OR REPLACE FUNCTION public.lire_communications(p_ids bigint[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RETURN; END IF;
  INSERT INTO public.communications_lectures (communication, user_id)
  SELECT DISTINCT i, auth.uid() FROM unnest(coalesce(p_ids, '{}'::bigint[])) i
  WHERE public.communication_visible(i)
  ON CONFLICT DO NOTHING;
END $$;

-- Pour chaque communication visible : franchisés concernés qui l'ont lue, et ceux qui ne l'ont pas lue
CREATE OR REPLACE FUNCTION public.lectures_communications() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.magasins_messagerie(); -- NULL pour le Directeur
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'lus', (SELECT coalesce(jsonb_agg(a.franchise ORDER BY a.franchise), '[]'::jsonb) FROM public.acces_franchises a
              WHERE (c.magasins IS NULL OR a.magasins && c.magasins) AND (v_mag IS NULL OR a.magasins && v_mag)
                AND EXISTS (SELECT 1 FROM public.communications_lectures l WHERE l.communication = c.id AND l.user_id = a.user_id)),
      'non_lus', (SELECT coalesce(jsonb_agg(a.franchise ORDER BY a.franchise), '[]'::jsonb) FROM public.acces_franchises a
              WHERE (c.magasins IS NULL OR a.magasins && c.magasins) AND (v_mag IS NULL OR a.magasins && v_mag)
                AND NOT EXISTS (SELECT 1 FROM public.communications_lectures l WHERE l.communication = c.id AND l.user_id = a.user_id))
    ) ORDER BY c.cree_le DESC, c.id DESC), '[]'::jsonb)
    FROM public.communications c
    WHERE c.cree_le > now() - interval '24 months'
      AND (c.magasins IS NULL OR c.auteur = auth.uid() OR v_mag IS NULL OR c.magasins && v_mag));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['lire_communications(bigint[])', 'lectures_communications()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0013', 'lectures_communications')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la table existe, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'communications_lectures';
