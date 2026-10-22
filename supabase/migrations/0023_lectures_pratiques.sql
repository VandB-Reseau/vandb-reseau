-- ════════════════════════════════════════════════════════════════
-- V and B — « Vu par » des bonnes pratiques (22/10/2026)
-- Réexécutable. Suppose 0004 (acces_franchises, mon_role), 0006 (magasins_messagerie), 0012 (journal) et json_sur.
--
-- Comme pour les communications (0013) :
-- 1) Quand un franchisé affiche les bonnes pratiques, l'app note qu'il les a vues (une ligne par
--    pratique et par compte franchisé, la première fois seulement). Seules les pratiques qui existent
--    dans app_config (clé bonnes_pratiques) sont notées.
-- 2) Le Directeur de réseau et les Responsables Régionaux voient, pour chaque bonne pratique,
--    les franchisés qui l'ont vue et ceux qui ne l'ont pas encore vue.
--    Un Responsable Régional ne voit que les franchisés de ses magasins.
-- 3) Personne ne lit ni n'écrit la table directement : tout passe par les deux fonctions.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pratiques_lectures (
  pratique text NOT NULL,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vu_le    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pratique, user_id)
);
ALTER TABLE public.pratiques_lectures ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pratiques_lectures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pratiques_lectures', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.pratiques_lectures FROM anon, authenticated;

-- Identifiants des bonnes pratiques existantes
CREATE OR REPLACE FUNCTION public.pratiques_existantes() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(x->>'id'), '{}'::text[])
  FROM public.app_config c, jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(c.value)) = 'array' THEN public.json_sur(c.value) ELSE '[]'::jsonb END) x
  WHERE c.key = 'bonnes_pratiques' AND coalesce(x->>'id', '') <> '';
$$;

-- Le franchisé connecté a vu ces bonnes pratiques (identifiants inconnus ignorés)
CREATE OR REPLACE FUNCTION public.lire_pratiques(p_ids text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RETURN; END IF;
  INSERT INTO public.pratiques_lectures (pratique, user_id)
  SELECT DISTINCT i, auth.uid() FROM unnest(coalesce(p_ids, '{}'::text[])) i
  WHERE i = ANY (public.pratiques_existantes())
  ON CONFLICT DO NOTHING;
END $$;

-- Pour chaque bonne pratique : franchisés qui l'ont vue, et ceux qui ne l'ont pas vue
CREATE OR REPLACE FUNCTION public.lectures_pratiques() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.magasins_messagerie(); -- NULL pour le Directeur
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'lus', (SELECT coalesce(jsonb_agg(a.franchise ORDER BY a.franchise), '[]'::jsonb) FROM public.acces_franchises a
              WHERE (v_mag IS NULL OR a.magasins && v_mag)
                AND EXISTS (SELECT 1 FROM public.pratiques_lectures l WHERE l.pratique = p.id AND l.user_id = a.user_id)),
      'non_lus', (SELECT coalesce(jsonb_agg(a.franchise ORDER BY a.franchise), '[]'::jsonb) FROM public.acces_franchises a
              WHERE (v_mag IS NULL OR a.magasins && v_mag)
                AND NOT EXISTS (SELECT 1 FROM public.pratiques_lectures l WHERE l.pratique = p.id AND l.user_id = a.user_id))
    )), '[]'::jsonb)
    FROM unnest(public.pratiques_existantes()) AS p(id));
END $$;

DO $$
DECLARE f text;
BEGIN
  REVOKE ALL ON FUNCTION public.pratiques_existantes() FROM PUBLIC, anon, authenticated;
  FOREACH f IN ARRAY ARRAY['lire_pratiques(text[])', 'lectures_pratiques()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0023', 'lectures_pratiques')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la table existe, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'pratiques_lectures';
