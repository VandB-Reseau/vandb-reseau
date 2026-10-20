-- ════════════════════════════════════════════════════════════════
-- V and B — Photos et fichiers joints aux messages et aux tâches (Supabase Storage)
-- À exécuter dans Supabase > SQL Editor, APRÈS messagerie.sql et actions_franchise.sql. Réexécutable.
--
-- 1) Seau privé « pieces » : photos (l'app les réduit en JPEG), PDF, Word, Excel, PowerPoint,
--    texte et CSV, 10 Mo au plus par fichier. Lus seulement par liens temporaires.
-- 2) Chaque compte (équipe ou franchisé) range ses fichiers sous son identifiant : « <uid>/… ».
-- 3) Un fichier n'est lisible que par son auteur, ou par qui voit le message ou la tâche qui le cite :
--    échange à deux = l'auteur et le destinataire ; tâche = qui voit le magasin
--    (Directeur : tous, Coach et RR : les leurs, franchisé : les siens).
-- 4) Chacun ne supprime que ses propres fichiers.
-- ════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pieces', 'pieces', false, 10485760, ARRAY[
  'image/jpeg', 'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Le compte connecté peut-il lire ce fichier ?
CREATE OR REPLACE FUNCTION public.piece_visible(p_chemin text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text := public.mon_role();
  v_cle text;
  v_mag text[];
  v_ref jsonb := jsonb_build_array(jsonb_build_object('chemin', p_chemin));
BEGIN
  IF auth.uid() IS NULL OR coalesce(p_chemin, '') = '' THEN RETURN false; END IF;
  IF NOT (public.est_equipe() OR v_role = 'franchise') THEN RETURN false; END IF;
  IF split_part(p_chemin, '/', 1) = auth.uid()::text THEN RETURN true; END IF;

  -- Échange à deux qui le cite
  v_cle := public.ma_cle();
  IF EXISTS (SELECT 1 FROM public.messages m
    WHERE m.pieces @> v_ref AND m.destinataire IS NOT NULL AND (m.auteur = auth.uid() OR m.destinataire = v_cle)) THEN
    RETURN true;
  END IF;

  -- Tâche d'un magasin visible (hors visite, ou plan d'action d'une visite)
  v_mag := public.magasins_messagerie();
  IF EXISTS (SELECT 1 FROM public.suivi_magasins s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.valeur) = 'array' THEN s.valeur ELSE '[]'::jsonb END) e
    WHERE s.cle = 'actions' AND (v_mag IS NULL OR s.store_name = ANY(v_mag)) AND jsonb_typeof(e) = 'object' AND e->'pieces' @> v_ref) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.visits v, jsonb_array_elements(CASE WHEN jsonb_typeof(v.action_plan) = 'array' THEN v.action_plan ELSE '[]'::jsonb END) e
    WHERE (v_mag IS NULL OR v.store = ANY(v_mag)) AND jsonb_typeof(e) = 'object' AND e->'pieces' @> v_ref);
END $$;

REVOKE ALL ON FUNCTION public.piece_visible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.piece_visible(text) TO authenticated;

DROP POLICY IF EXISTS "pieces_lecture" ON storage.objects;
DROP POLICY IF EXISTS "pieces_ajout" ON storage.objects;
DROP POLICY IF EXISTS "pieces_suppression" ON storage.objects;
CREATE POLICY "pieces_lecture" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pieces' AND public.piece_visible(name));
CREATE POLICY "pieces_ajout" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pieces' AND split_part(name, '/', 1) = (SELECT auth.uid())::text
    AND ((SELECT public.est_equipe()) OR (SELECT public.mon_role()) = 'franchise'));
CREATE POLICY "pieces_suppression" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pieces' AND split_part(name, '/', 1) = (SELECT auth.uid())::text);

-- Vérification : le seau et ses trois règles
SELECT b.id, b.public, b.file_size_limit, (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'storage' AND p.policyname LIKE 'pieces_%') AS regles
FROM storage.buckets b WHERE b.id = 'pieces';
