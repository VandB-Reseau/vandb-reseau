-- ════════════════════════════════════════════════════════════════
-- V and B — Garde-fous des règles d'accès et journal des migrations (21/10/2026)
-- Réexécutable. Suppose 0001 à 0011, passées dans l'ordre juste avant.
--
-- 1) Le contrôle du 21/10/2026 a trouvé la règle « connectes_seulement » (tout compte
--    connecté lit et écrit tout) sur toutes les tables : un ancien script hors dépôt
--    (« Setup COMPLET » ou « verrouillage ») avait été repassé et avait effacé le
--    cloisonnement. Cette migration retire toute règle de ce type, puis refuse de
--    se terminer s'il en reste une.
-- 2) Table journal_migrations : une ligne par migration passée en ligne, avec sa date.
--    Chaque nouvelle migration ajoute sa propre ligne à la fin.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Plus aucune règle ouverte à tout compte connecté
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND policyname IN ('connectes_seulement', 'visits_all') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(schemaname || '.' || tablename || ' : ' || policyname, ', ') INTO v FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
    AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true'
         OR coalesce(qual, '') IN ('(bucket_id = ''photos''::text)', '(bucket_id = ''pieces''::text)')
         OR coalesce(with_check, '') IN ('(bucket_id = ''photos''::text)', '(bucket_id = ''pieces''::text)'));
  IF v IS NOT NULL THEN RAISE EXCEPTION 'Règles encore ouvertes à tout compte connecté : %', v; END IF;
END $$;

-- ── 2) Journal des migrations passées
CREATE TABLE IF NOT EXISTS public.journal_migrations (
  numero    text PRIMARY KEY,           -- « 0012 »
  nom       text NOT NULL,              -- « garde_fous_et_journal »
  passee_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_migrations ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'journal_migrations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.journal_migrations', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "directeur_lecture" ON public.journal_migrations FOR SELECT TO authenticated USING ((SELECT public.est_directeur()));
REVOKE ALL ON public.journal_migrations FROM anon, authenticated;
GRANT SELECT ON public.journal_migrations TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES
  ('0001', 'tables_de_base'), ('0002', 'visites_compte_rendu'), ('0003', 'photos_audits'),
  ('0004', 'acces_franchises'), ('0005', 'cloisonnement_equipe'), ('0006', 'messagerie'),
  ('0007', 'actions_franchise'), ('0008', 'communications'), ('0009', 'pieces_jointes'),
  ('0010', 'pratiques_reactions'), ('0011', 'preparation_visites'), ('0012', 'garde_fous_et_journal')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : règles par table (aucune « connectes_seulement ») et journal
SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname IN ('public', 'storage') ORDER BY 1, 2, 3;
SELECT * FROM public.journal_migrations ORDER BY numero;
