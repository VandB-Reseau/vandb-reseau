-- ════════════════════════════════════════════════════════════════
-- V and B — Archive des chiffres saisis à la main (fusion avec le pilotage, Joseph 03/11/2026, décision 1 :
-- la caisse est la seule source du CA, les données de store_finance seront supprimées). Réexécutable. Suppose 0039.
--
-- 1) archive_store_finance : copie de chaque ligne de store_finance (ligne entière en jsonb, toutes colonnes gardées),
--    refaite à chaque passage. Aucun compte ne la lit ni ne l'écrit depuis l'app : elle sert à revenir en arrière.
-- 2) couverture_caisse() (Directeur seul) : pour chaque magasin, les mois saisis à la main, ceux que la caisse couvre
--    et ceux qu'elle ne couvre pas (ceux-là seraient perdus si on supprimait sans archive).
-- Rien n'est supprimé ici : la suppression viendra dans une migration à part, après lecture du bilan et feu vert de Joseph.
-- Le bilan s'affiche à la fin du script.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.archive_store_finance (
  store_name  text NOT NULL,
  month       date NOT NULL,
  ligne       jsonb NOT NULL,
  archive_le  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_name, month)
);
ALTER TABLE public.archive_store_finance ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'archive_store_finance' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.archive_store_finance', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.archive_store_finance FROM PUBLIC, anon, authenticated;

INSERT INTO public.archive_store_finance AS a (store_name, month, ligne, archive_le)
SELECT f.store_name, f.month, to_jsonb(f), now() FROM public.store_finance f
ON CONFLICT (store_name, month) DO UPDATE SET ligne = EXCLUDED.ligne, archive_le = now()
  WHERE a.ligne IS DISTINCT FROM EXCLUDED.ligne;

-- ── Bilan : mois saisis à la main couverts ou non par la caisse
CREATE OR REPLACE FUNCTION public.couverture_caisse()
RETURNS TABLE (store_name text, mois_saisis integer, mois_couverts integer, mois_sans_caisse text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Éditeur SQL de Supabase (aucun compte connecté) ou Directeur
  IF auth.uid() IS NOT NULL AND NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF to_regclass('pilotage.reel_mensuel') IS NULL THEN
    RETURN QUERY SELECT f.store_name, count(*)::integer, 0, array_agg(to_char(f.month, 'YYYY-MM') ORDER BY f.month)
      FROM public.store_finance f GROUP BY f.store_name ORDER BY f.store_name;
    RETURN;
  END IF;
  RETURN QUERY EXECUTE $q$
    WITH c AS (SELECT DISTINCT r.store_name, date_trunc('month', r.mois)::date AS mois FROM pilotage.reel_mensuel r)
    SELECT f.store_name, count(*)::integer,
      count(c.mois)::integer,
      coalesce(array_agg(to_char(f.month, 'YYYY-MM') ORDER BY f.month) FILTER (WHERE c.mois IS NULL), '{}')
    FROM public.store_finance f
    LEFT JOIN c ON c.store_name = f.store_name AND c.mois = date_trunc('month', f.month)::date
    GROUP BY f.store_name ORDER BY f.store_name
  $q$;
END $$;
REVOKE ALL ON FUNCTION public.couverture_caisse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.couverture_caisse() TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0040', 'archive_store_finance')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Bilan lu à la fin du passage (éditeur SQL de Supabase) : une ligne pour tout le réseau
SELECT (SELECT count(*) FROM public.archive_store_finance) AS lignes_archivees,
  coalesce(sum(b.mois_saisis), 0) AS mois_saisis, coalesce(sum(b.mois_couverts), 0) AS mois_couverts_par_la_caisse,
  coalesce(sum(cardinality(b.mois_sans_caisse)), 0) AS mois_sans_caisse
FROM public.couverture_caisse() b;
