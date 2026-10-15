-- ════════════════════════════════════════════════════════════════
-- V and B — Espace photos des audits (Supabase Storage)
-- À exécuter une fois dans Supabase > SQL Editor. Réexécutable.
-- Seau privé : photos lisibles seulement par les comptes connectés,
-- via des liens temporaires. 5 Mo maximum par photo (l'app envoie ~250 Ko).
-- ════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg'];

DROP POLICY IF EXISTS "photos_lecture" ON storage.objects;
DROP POLICY IF EXISTS "photos_ajout" ON storage.objects;
DROP POLICY IF EXISTS "photos_suppression" ON storage.objects;
CREATE POLICY "photos_lecture" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos');
CREATE POLICY "photos_ajout" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
CREATE POLICY "photos_suppression" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos');
