-- Reproduit l'incident constaté le 21/10/2026 : l'ancien script « verrouillage » (ou la section 9 de
-- l'ancien « Setup COMPLET ») repassé après coup remplace toutes les règles par « tout compte connecté ».
-- La suite des migrations rejouée ensuite doit tout refermer.
DO $$
DECLARE t record; p record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.tablename);
    END LOOP;
    EXECUTE format('CREATE POLICY "connectes_seulement" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t.tablename);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "photos_lecture" ON storage.objects;
CREATE POLICY "photos_lecture" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos');
