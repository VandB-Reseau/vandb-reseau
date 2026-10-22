-- ════════════════════════════════════════════════════════════════
-- V and B — Échanges en groupe (21/10/2026)
-- Réexécutable. Suppose 0004 (franchisés), 0005 (périmètre), 0006 (messagerie), 0009 (pièces), 0016 (téléphone).
--
-- 1) Groupe de chaque magasin, en deux fils (pas de table : les messages portent le magasin) :
--    « Avec le franchisé » (equipe = faux) et « Équipe seule » (equipe = vrai, jamais renvoyé à un franchisé).
-- 2) Groupes libres (« Coachs Ouest », « Franchisés Bretagne ») : créés par le Directeur de réseau ou un RR.
--    Un RR n'y invite que des franchisés de ses magasins. Seuls les membres lisent et écrivent.
--    Un message de groupe porte destinataire = 'groupe:<id>' : les fonctions de 0006 et 0016, même rejouées
--    après celle-ci, ne le montrent qu'à son auteur et ne l'envoient à personne.
-- 3) envoyer_fil() : un seul envoi pour les trois fils, avec photos et fichiers ;
--    marquer_lu_fil() : dernière lecture d'un fil.
-- 4) Notifications sur le téléphone : dans un groupe de magasin, le franchisé et le Coach de tout,
--    les autres seulement quand on les cite ou s'ils ont déjà écrit dans le fil ; dans un groupe libre, tous les membres.
--    Jamais à quelqu'un qui ne peut pas lire le message.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.groupes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom         text NOT NULL,
  membres     text[] NOT NULL DEFAULT '{}', -- clés : directeur, rr:<id>, coach:<nom>, franchise:<nom>
  cree_par    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS groupe bigint REFERENCES public.groupes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS messages_groupe ON public.messages (groupe, cree_le);

-- Table fermée : RLS sans règle, aucun droit pour les comptes
ALTER TABLE public.groupes ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'groupes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.groupes', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.groupes FROM PUBLIC, anon, authenticated;

-- Le compte connecté peut-il ajouter cette personne à un groupe ?
CREATE OR REPLACE FUNCTION public.peut_inviter(p_cle text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(p_cle, '') !~ '^(directeur|rr:.+|coach:.+|franchise:.+)$' THEN RETURN false; END IF;
  IF public.est_directeur() THEN RETURN true; END IF;
  IF public.mon_role() <> 'rr' THEN RETURN false; END IF;
  RETURN p_cle NOT LIKE 'franchise:%' OR public.franchise_de_mes_magasins(substr(p_cle, 11));
END $$;

-- Nouveau groupe libre (Directeur ou RR) : le créateur en fait toujours partie
CREATE OR REPLACE FUNCTION public.creer_groupe(p_nom text, p_membres text[]) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_nom text := left(trim(coalesce(p_nom, '')), 80); v_id bigint; v_cle text := public.ma_cle();
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') OR v_cle IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_nom = '' THEN RAISE EXCEPTION 'nom_vide'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_membres, '{}')) k WHERE k <> v_cle AND NOT public.peut_inviter(k)) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  INSERT INTO public.groupes (nom, membres, cree_par)
  VALUES (v_nom, (SELECT array_agg(DISTINCT k ORDER BY k) FROM unnest(array_append(coalesce(p_membres, '{}'), v_cle)) k), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Nom et membres d'un groupe : son créateur ou le Directeur. Les membres déjà présents qu'on ne pourrait pas
-- inviter (franchisé d'un autre RR) restent.
CREATE OR REPLACE FUNCTION public.modifier_groupe(p_id bigint, p_nom text, p_membres text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.groupes; v_nom text := left(trim(coalesce(p_nom, '')), 80);
BEGIN
  SELECT * INTO g FROM public.groupes WHERE id = p_id FOR UPDATE;
  IF g.id IS NULL OR NOT (public.est_directeur() OR (g.cree_par = auth.uid() AND public.mon_role() = 'rr')) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_nom = '' THEN RAISE EXCEPTION 'nom_vide'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_membres, '{}')) k WHERE NOT k = ANY(g.membres) AND NOT public.peut_inviter(k)) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.groupes SET nom = v_nom,
    membres = (SELECT coalesce(array_agg(DISTINCT k ORDER BY k), '{}') FROM unnest(coalesce(p_membres, '{}')) k)
  WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.supprimer_groupe(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.groupes WHERE id = p_id AND (public.est_directeur() OR (cree_par = auth.uid() AND public.mon_role() = 'rr'));
END $$;

-- Un membre quitte un groupe
CREATE OR REPLACE FUNCTION public.quitter_groupe(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.groupes SET membres = array_remove(membres, public.ma_cle()) WHERE id = p_id;
END $$;

-- Fil désigné par l'app : magasin:<nom> (avec le franchisé), equipe:<nom> (équipe seule), groupe:<id>
CREATE OR REPLACE FUNCTION public.peut_ecrire_fil(p_fil text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_genre text := split_part(coalesce(p_fil, ''), ':', 1); v_valeur text := substr(coalesce(p_fil, ''), length(split_part(coalesce(p_fil, ''), ':', 1)) + 2);
BEGIN
  IF v_valeur = '' THEN RETURN false; END IF;
  IF v_genre = 'magasin' THEN RETURN public.peut_ecrire_magasin(v_valeur); END IF;
  IF v_genre = 'equipe' THEN RETURN public.est_equipe() AND public.peut_ecrire_magasin(v_valeur); END IF;
  IF v_genre = 'groupe' AND v_valeur ~ '^\d{1,18}$' THEN
    RETURN EXISTS (SELECT 1 FROM public.groupes g WHERE g.id = v_valeur::bigint AND public.ma_cle() = ANY(g.membres));
  END IF;
  RETURN false;
END $$;

-- Dernière lecture d'un fil : magasin → (magasin, messages), equipe → (magasin, equipe), groupe → (groupe:<id>, messages)
CREATE OR REPLACE FUNCTION public.marquer_lu_fil(p_fil text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_genre text := split_part(p_fil, ':', 1); v_valeur text := substr(p_fil, length(split_part(p_fil, ':', 1)) + 2);
BEGIN
  IF NOT public.peut_ecrire_fil(p_fil) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  INSERT INTO public.messages_lus (user_id, store, sujet, lu_le)
  VALUES (auth.uid(), CASE WHEN v_genre = 'groupe' THEN p_fil ELSE v_valeur END, CASE WHEN v_genre = 'equipe' THEN 'equipe' ELSE 'messages' END, now())
  ON CONFLICT (user_id, store, sujet) DO UPDATE SET lu_le = now();
END $$;

-- Message dans un fil. Les personnes citées sont gardées seulement si elles peuvent lire le fil
-- (jamais un franchisé dans « Équipe seule », jamais un non-membre dans un groupe).
CREATE OR REPLACE FUNCTION public.envoyer_fil(p_fil text, p_texte text, p_mentions text[] DEFAULT '{}', p_pieces jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_genre text := split_part(coalesce(p_fil, ''), ':', 1); v_valeur text := substr(coalesce(p_fil, ''), length(split_part(coalesce(p_fil, ''), ':', 1)) + 2);
  v_texte text := trim(coalesce(p_texte, '')); v_pieces jsonb := public.pieces_propres(p_pieces); v_membres text[]; v_mentions text[]; v_id bigint; v_le timestamptz;
BEGIN
  IF NOT public.peut_ecrire_fil(p_fil) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' AND jsonb_array_length(v_pieces) = 0 THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 4000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  IF v_genre = 'groupe' THEN SELECT g.membres INTO v_membres FROM public.groupes g WHERE g.id = v_valeur::bigint; END IF;
  v_mentions := coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_mentions) x WHERE x ~ '^(directeur|rr:.+|coach:.+|franchise:.+)$'
    AND (v_genre <> 'equipe' OR x NOT LIKE 'franchise:%') AND (v_genre <> 'groupe' OR x = ANY(v_membres))), '{}');
  INSERT INTO public.messages (store, destinataire, auteur, auteur_nom, auteur_role, auteur_cle, texte, mentions, equipe, groupe, pieces)
  VALUES (CASE WHEN v_genre = 'groupe' THEN NULL ELSE v_valeur END, CASE WHEN v_genre = 'groupe' THEN p_fil END, auth.uid(), public.mon_nom(), public.mon_role(), public.ma_cle(), v_texte, v_mentions,
    v_genre = 'equipe', CASE WHEN v_genre = 'groupe' THEN v_valeur::bigint END, v_pieces)
  RETURNING id, cree_le INTO v_id, v_le;
  PERFORM public.marquer_lu_fil(p_fil);
  RETURN jsonb_build_object('id', v_id, 'cree_le', v_le);
END $$;

-- Messages visibles : échanges à deux, fils des magasins du compte (sans « Équipe seule » pour un franchisé),
-- groupes dont il est membre ; ses dernières lectures et ses groupes.
CREATE OR REPLACE FUNCTION public.messagerie() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := public.mon_role(); v_mag text[]; v_ref timestamptz; v_cle text := public.ma_cle(); v_groupes bigint[];
BEGIN
  IF v_role = 'franchise' THEN
    SELECT a.ouvert_le INTO v_ref FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  ELSIF NOT public.est_equipe() THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  v_mag := public.magasins_messagerie();
  SELECT coalesce(array_agg(g.id), '{}') INTO v_groupes FROM public.groupes g WHERE v_cle = ANY(g.membres);
  RETURN jsonb_build_object(
    'moi', auth.uid(),
    'version', 4,
    'cle', v_cle,
    'reference', v_ref,
    'groupes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nom', g.nom, 'membres', to_jsonb(g.membres), 'cree_par', g.cree_par, 'cree_le', g.cree_le) ORDER BY g.nom), '[]'::jsonb)
      FROM public.groupes g WHERE g.id = ANY(v_groupes)),
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'store', m.store, 'auteur', m.auteur, 'auteur_nom', m.auteur_nom,
        'auteur_role', m.auteur_role, 'texte', m.texte, 'mentions', to_jsonb(m.mentions), 'cree_le', m.cree_le, 'equipe', m.equipe, 'lot', m.lot,
        'destinataire', m.destinataire, 'auteur_cle', m.auteur_cle, 'magasins', to_jsonb(m.magasins), 'pieces', m.pieces, 'groupe', m.groupe) ORDER BY m.cree_le, m.id), '[]'::jsonb)
      FROM public.messages m WHERE m.cree_le > now() - interval '18 months' AND (
        (m.destinataire IS NOT NULL AND m.groupe IS NULL AND (m.auteur = auth.uid() OR m.destinataire = v_cle))
        OR (m.groupe IS NOT NULL AND m.groupe = ANY(v_groupes))
        OR (m.destinataire IS NULL AND m.groupe IS NULL AND m.store IS NOT NULL AND (v_mag IS NULL OR m.store = ANY(v_mag)) AND NOT (m.equipe AND v_role = 'franchise')))),
    'lus', (SELECT coalesce(jsonb_object_agg(l.store || '|' || l.sujet, l.lu_le), '{}'::jsonb) FROM public.messages_lus l WHERE l.user_id = auth.uid()));
END $$;

-- Un compte peut-il lire le fil d'un magasin ? (envoi des notifications sur le téléphone)
CREATE OR REPLACE FUNCTION public.compte_lit_magasin(p_user uuid, p_store text, p_equipe boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE u.raw_app_meta_data->>'role'
    WHEN 'directeur' THEN true
    WHEN 'coach' THEN EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE p.store_name = p_store AND p.coach = u.raw_app_meta_data->>'coach')
    WHEN 'rr' THEN EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE p.store_name = p_store AND (u.raw_app_meta_data->>'rr') = ANY(p.rrs))
    WHEN 'franchise' THEN NOT p_equipe AND EXISTS (SELECT 1 FROM public.acces_franchises f WHERE f.user_id = p_user AND p_store = ANY(f.magasins))
    ELSE false END FROM auth.users u WHERE u.id = p_user), false)
$$;

-- Notifications à envoyer (fonction « notifier » seule) : 0016, plus les messages des groupes
CREATE OR REPLACE FUNCTION public.notifications_a_envoyer(p_type text, p_ids bigint[], p_auteur uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb := '[]'::jsonb; v_groupes jsonb := '[]'::jsonb; v_role text;
BEGIN
  SELECT u.raw_app_meta_data->>'role' INTO v_role FROM auth.users u WHERE u.id = p_auteur;
  IF p_type = 'message' THEN
    -- Échange à deux : le destinataire
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', m.auteur_nom,
        'texte', CASE WHEN m.texte = '' THEN 'Pièce jointe' ELSE left(m.texte, 140) END,
        'lien', '#/echanges/personne/' || replace(coalesce(m.auteur_cle, ''), ' ', '%20'))), '[]'::jsonb) INTO v
    FROM public.messages m
    JOIN LATERAL public.comptes_de_cle(m.destinataire) d(user_id) ON true
    JOIN public.abonnements_push a ON a.user_id = d.user_id
    WHERE m.id = ANY(p_ids) AND m.auteur = p_auteur AND m.destinataire IS NOT NULL AND m.groupe IS NULL
      AND m.cree_le > now() - interval '10 minutes' AND d.user_id <> p_auteur;
    -- Groupe d'un magasin ou groupe libre
    WITH m AS (
      SELECT * FROM public.messages x WHERE x.id = ANY(p_ids) AND x.auteur = p_auteur
        AND ((x.destinataire IS NULL AND x.store IS NOT NULL) OR x.groupe IS NOT NULL) AND x.cree_le > now() - interval '10 minutes'
    ), d AS (
      SELECT DISTINCT m.id, c.user_id FROM m, LATERAL (
        SELECT f.user_id FROM public.acces_franchises f WHERE m.groupe IS NULL AND NOT m.equipe AND m.store = ANY(f.magasins)
        UNION SELECT k.user_id FROM public.perimetre_equipe p, LATERAL public.comptes_de_cle('coach:' || p.coach) k(user_id)
          WHERE m.groupe IS NULL AND p.store_name = m.store AND p.coach IS NOT NULL
        UNION SELECT k.user_id FROM unnest(m.mentions) x, LATERAL public.comptes_de_cle(x) k(user_id)
        UNION SELECT a.auteur FROM public.messages a WHERE m.groupe IS NULL AND a.store = m.store AND a.equipe = m.equipe
          AND a.destinataire IS NULL AND a.groupe IS NULL AND a.auteur IS NOT NULL AND a.cree_le > now() - interval '18 months'
        UNION SELECT k.user_id FROM public.groupes g, unnest(g.membres) x, LATERAL public.comptes_de_cle(x) k(user_id) WHERE g.id = m.groupe
      ) c(user_id)
      WHERE c.user_id <> p_auteur AND (m.groupe IS NOT NULL OR public.compte_lit_magasin(c.user_id, m.store, m.equipe))
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', coalesce(g.nom, m.store),
        'texte', m.auteur_nom || ' : ' || CASE WHEN m.texte = '' THEN 'Pièce jointe' ELSE left(m.texte, 140) END,
        'lien', CASE WHEN m.groupe IS NOT NULL THEN '#/echanges/groupe/' || m.groupe
          ELSE '#/echanges/magasin/' || replace(m.store, ' ', '%20') || CASE WHEN m.equipe THEN '?fil=equipe' ELSE '' END END)), '[]'::jsonb) INTO v_groupes
    FROM d JOIN m ON m.id = d.id
    LEFT JOIN public.groupes g ON g.id = m.groupe
    JOIN public.abonnements_push a ON a.user_id = d.user_id;
    v := v || v_groupes;
  ELSIF p_type = 'visite' AND v_role IN ('directeur', 'rr', 'coach') THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', 'Nouveau compte rendu de visite',
        'texte', vi.store || coalesce(' · ' || to_char(CASE WHEN vi.visit_date::text ~ '^\d{4}-\d{2}-\d{2}' THEN left(vi.visit_date::text, 10)::date END, 'DD/MM/YYYY'), ''),
        'lien', '#/visites/compte-rendu/' || vi.id)), '[]'::jsonb) INTO v
    FROM public.visits vi
    JOIN public.acces_franchises f ON vi.store = ANY(f.magasins)
    JOIN public.abonnements_push a ON a.user_id = f.user_id
    WHERE vi.id = ANY(p_ids) AND coalesce(vi.type, 'terrain') NOT IN ('appel', 'point')
      AND vi.visit_date::text ~ '^\d{4}-\d{2}-\d{2}'
      AND left(vi.visit_date::text, 10)::date BETWEEN current_date - 7 AND current_date;
  END IF;
  RETURN v;
END $$;

-- Droits d'appel
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['peut_inviter(text)', 'creer_groupe(text, text[])', 'modifier_groupe(bigint, text, text[])', 'supprimer_groupe(bigint)',
    'quitter_groupe(bigint)', 'peut_ecrire_fil(text)', 'marquer_lu_fil(text)', 'envoyer_fil(text, text, text[], jsonb)', 'messagerie()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.compte_lit_magasin(uuid, text, boolean), public.notifications_a_envoyer(text, bigint[], uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.compte_lit_magasin(uuid, text, boolean), public.notifications_a_envoyer(text, bigint[], uuid) TO service_role;
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0018', 'echanges_groupes')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la table des groupes existe, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'groupes';
