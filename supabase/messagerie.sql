-- ════════════════════════════════════════════════════════════════
-- V and B — Messagerie entre personnes et notifications
-- À exécuter dans Supabase > SQL Editor, APRÈS acces_franchises.sql. Réexécutable.
-- Un Coach ou un RR ne voit que le fil de ses magasins dès que cloisonnement_equipe.sql est passé.
--
-- 1) Depuis le 20/10/2026 : échanges privés à deux (destinataire = clé de la personne),
--    avec des magasins cités en option. Seuls l'auteur et le destinataire lisent le message.
--    Les anciens messages par magasin (sans destinataire) restent lisibles comme avant.
-- 2) Personne ne lit ni n'écrit les tables directement : tout passe par les
--    fonctions ci-dessous, qui vérifient le rôle (lu dans la base) et que le
--    magasin fait partie de ceux du compte.
-- 3) Le nom et le rôle de l'auteur sont posés par la base, jamais par l'app.
-- 5) Photos et fichiers joints (pieces) : l'espace fichiers est créé par pieces_jointes.sql.
-- 4) Anciens messages : « equipe » = jamais renvoyé à un franchisé ; un envoi sur plusieurs
--    magasins = une ligne par magasin, reliées par « lot ».
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.messages (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store       text NOT NULL,
  auteur      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom  text NOT NULL,
  auteur_role text NOT NULL,
  texte       text NOT NULL,
  mentions    text[] NOT NULL DEFAULT '{}', -- directeur, rr:<id>, coach:<nom>, franchise:<nom>
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_store_date ON public.messages (store, cree_le);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS equipe boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS lot uuid;
-- Échanges à deux : clé de l'auteur et du destinataire (directeur, rr:<id>, coach:<nom>, franchise:<nom>), magasins cités
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS destinataire text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS auteur_cle text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS magasins text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.messages ALTER COLUMN store DROP NOT NULL;
CREATE INDEX IF NOT EXISTS messages_destinataire ON public.messages (destinataire, cree_le);
-- Photos et fichiers joints (script pieces_jointes.sql pour l'espace fichiers) : [{chemin, nom, taille, type}]
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pieces jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Dernière lecture de chaque compte, par magasin et par sujet (messages, visites)
CREATE TABLE IF NOT EXISTS public.messages_lus (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store   text NOT NULL,
  sujet   text NOT NULL DEFAULT 'messages',
  lu_le   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store, sujet)
);

-- Aucun accès direct (même si la règle « equipe_seulement » est reposée par acces_franchises.sql)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_lus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages, public.messages_lus FROM anon, authenticated;

-- Magasins dont le compte voit le fil : NULL = tous (Directeur de réseau).
-- Coach et RR : leurs magasins une fois cloisonnement_equipe.sql passé, tous avant.
CREATE OR REPLACE FUNCTION public.magasins_messagerie() RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := public.mon_role(); v_mag text[];
BEGIN
  IF v_role = 'franchise' THEN RETURN public.mes_magasins(); END IF;
  IF v_role IN ('coach', 'rr') AND to_regprocedure('public.magasins_visibles()') IS NOT NULL THEN
    EXECUTE 'SELECT public.magasins_visibles()' INTO v_mag;
    RETURN coalesce(v_mag, '{}');
  END IF;
  IF public.est_equipe() THEN RETURN NULL; END IF;
  RETURN '{}'::text[];
END $$;

-- Le compte connecté peut-il lire et écrire sur ce magasin ?
CREATE OR REPLACE FUNCTION public.peut_ecrire_magasin(p_store text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RETURN false; END IF;
  v_mag := public.magasins_messagerie();
  RETURN v_mag IS NULL OR p_store = ANY(v_mag);
END $$;

-- Nom affiché de l'auteur : Coach, Responsable Régional, Directeur de réseau ou franchisé
CREATE OR REPLACE FUNCTION public.mon_nom() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH u AS (SELECT u.email, coalesce(u.raw_app_meta_data, '{}'::jsonb) AS m FROM auth.users u WHERE u.id = auth.uid()),
  d AS (SELECT coalesce((SELECT public.json_sur(c.value) FROM public.app_config c WHERE c.key = 'drs_data'), '{}'::jsonb) AS v)
  SELECT coalesce(nullif(trim(CASE public.mon_role()
    WHEN 'coach' THEN (SELECT m->>'coach' FROM u)
    WHEN 'rr' THEN (SELECT x->>'name' FROM d, jsonb_array_elements(CASE WHEN jsonb_typeof(d.v->'drs') = 'array' THEN d.v->'drs' ELSE '[]'::jsonb END) x
                    WHERE x->>'id' = (SELECT m->>'rr' FROM u) LIMIT 1)
    WHEN 'franchise' THEN (SELECT a.franchise FROM public.acces_franchises a WHERE a.user_id = auth.uid())
    WHEN 'directeur' THEN (SELECT d.v->'directeur'->>'name' FROM d)
  END), ''), (SELECT split_part(email, '@', 1) FROM u), 'Utilisateur')
$$;

-- Clé du compte connecté, telle qu'on l'écrit dans « destinataire »
CREATE OR REPLACE FUNCTION public.ma_cle() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH u AS (SELECT coalesce(u.raw_app_meta_data, '{}'::jsonb) AS m FROM auth.users u WHERE u.id = auth.uid())
  SELECT CASE public.mon_role()
    WHEN 'directeur' THEN 'directeur'
    WHEN 'rr' THEN 'rr:' || (SELECT m->>'rr' FROM u)
    WHEN 'coach' THEN 'coach:' || (SELECT m->>'coach' FROM u)
    WHEN 'franchise' THEN 'franchise:' || (SELECT a.franchise FROM public.acces_franchises a WHERE a.user_id = auth.uid())
  END
$$;

-- Messages visibles par le compte (ses magasins, 18 derniers mois) et ses dernières lectures.
-- « reference » : ouverture de l'accès d'un franchisé, pour ne pas lui signaler tout l'historique.
CREATE OR REPLACE FUNCTION public.messagerie() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := public.mon_role(); v_mag text[]; v_ref timestamptz; v_cle text := public.ma_cle();
BEGIN
  IF v_role = 'franchise' THEN
    SELECT a.ouvert_le INTO v_ref FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  ELSIF NOT public.est_equipe() THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  v_mag := public.magasins_messagerie();
  RETURN jsonb_build_object(
    'moi', auth.uid(),
    'version', 3,
    'cle', v_cle,
    'reference', v_ref,
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'store', m.store, 'auteur', m.auteur, 'auteur_nom', m.auteur_nom,
        'auteur_role', m.auteur_role, 'texte', m.texte, 'mentions', to_jsonb(m.mentions), 'cree_le', m.cree_le, 'equipe', m.equipe, 'lot', m.lot,
        'destinataire', m.destinataire, 'auteur_cle', m.auteur_cle, 'magasins', to_jsonb(m.magasins), 'pieces', m.pieces) ORDER BY m.cree_le, m.id), '[]'::jsonb)
      FROM public.messages m WHERE m.cree_le > now() - interval '18 months' AND (
        -- Échange à deux : l'auteur et le destinataire seulement
        (m.destinataire IS NOT NULL AND (m.auteur = auth.uid() OR m.destinataire = v_cle))
        -- Ancien fil par magasin
        OR (m.destinataire IS NULL AND (v_mag IS NULL OR m.store = ANY(v_mag)) AND NOT (m.equipe AND v_role = 'franchise')))),
    'lus', (SELECT coalesce(jsonb_object_agg(l.store || '|' || l.sujet, l.lu_le), '{}'::jsonb) FROM public.messages_lus l WHERE l.user_id = auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.marquer_lu(p_store text, p_sujet text DEFAULT 'messages') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.peut_ecrire_magasin(p_store) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_sujet NOT IN ('messages', 'visites') THEN RAISE EXCEPTION 'sujet_inconnu'; END IF;
  INSERT INTO public.messages_lus (user_id, store, sujet, lu_le) VALUES (auth.uid(), p_store, p_sujet, now())
  ON CONFLICT (user_id, store, sujet) DO UPDATE SET lu_le = now();
END $$;

DROP FUNCTION IF EXISTS public.envoyer_message(text, text, text[]);
CREATE OR REPLACE FUNCTION public.envoyer_message(p_store text, p_texte text, p_mentions text[] DEFAULT '{}', p_equipe boolean DEFAULT false, p_lot uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texte text := trim(coalesce(p_texte, '')); v_id bigint; v_le timestamptz;
BEGIN
  IF coalesce(p_equipe, false) AND NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NOT public.peut_ecrire_magasin(p_store) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 4000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  INSERT INTO public.messages (store, auteur, auteur_nom, auteur_role, texte, mentions, equipe, lot)
  VALUES (p_store, auth.uid(), public.mon_nom(), public.mon_role(), v_texte,
    coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_mentions) x WHERE x ~ '^(directeur|rr:.+|coach:.+|franchise:.+)$'), '{}'),
    coalesce(p_equipe, false), p_lot)
  RETURNING id, cree_le INTO v_id, v_le;
  PERFORM public.marquer_lu(p_store, 'messages');
  RETURN jsonb_build_object('id', v_id, 'cree_le', v_le);
END $$;

-- Pièces jointes reçues de l'app : seuls les fichiers rangés sous le compte connecté, 10 au plus
CREATE OR REPLACE FUNCTION public.pieces_propres(p_pieces jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('chemin', e->>'chemin', 'nom', left(coalesce(e->>'nom', 'Fichier'), 200),
      'taille', CASE WHEN coalesce(e->>'taille', '') ~ '^\d{1,12}$' THEN (e->>'taille')::bigint ELSE 0 END, 'type', left(coalesce(e->>'type', ''), 120)) ORDER BY o), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_pieces) = 'array' THEN p_pieces ELSE '[]'::jsonb END) WITH ORDINALITY AS t(e, o)
  WHERE o <= 10 AND jsonb_typeof(e) = 'object' AND coalesce(e->>'chemin', '') LIKE auth.uid()::text || '/%'
$$;

-- Message privé à une personne, magasins cités en option (parmi ceux du compte), photos et fichiers en option.
-- Un franchisé écrit à l'équipe, jamais à un autre franchisé.
DROP FUNCTION IF EXISTS public.envoyer_a(text, text, text[]);
CREATE OR REPLACE FUNCTION public.envoyer_a(p_destinataire text, p_texte text, p_magasins text[] DEFAULT '{}', p_pieces jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texte text := trim(coalesce(p_texte, '')); v_cle text := public.ma_cle(); v_mag text; v_id bigint; v_le timestamptz;
  v_pieces jsonb := public.pieces_propres(p_pieces);
BEGIN
  IF v_cle IS NULL OR NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(p_destinataire, '') !~ '^(directeur|rr:.+|coach:.+|franchise:.+)$' OR p_destinataire = v_cle THEN RAISE EXCEPTION 'destinataire_inconnu'; END IF;
  IF public.mon_role() = 'franchise' AND p_destinataire LIKE 'franchise:%' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' AND jsonb_array_length(v_pieces) = 0 THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 4000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  FOREACH v_mag IN ARRAY coalesce(p_magasins, '{}') LOOP
    IF NOT public.peut_ecrire_magasin(v_mag) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  END LOOP;
  INSERT INTO public.messages (store, auteur, auteur_nom, auteur_role, texte, mentions, destinataire, auteur_cle, magasins, pieces)
  VALUES (NULL, auth.uid(), public.mon_nom(), public.mon_role(), v_texte, ARRAY[p_destinataire], p_destinataire, v_cle,
    coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_magasins) x), '{}'), v_pieces)
  RETURNING id, cree_le INTO v_id, v_le;
  PERFORM public.marquer_lu_personne(p_destinataire);
  RETURN jsonb_build_object('id', v_id, 'cree_le', v_le);
END $$;

-- Dernière lecture d'un échange avec une personne (rangée sous « personne:<clé> »)
CREATE OR REPLACE FUNCTION public.marquer_lu_personne(p_cle text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  INSERT INTO public.messages_lus (user_id, store, sujet, lu_le) VALUES (auth.uid(), 'personne:' || p_cle, 'messages', now())
  ON CONFLICT (user_id, store, sujet) DO UPDATE SET lu_le = now();
END $$;

-- Un auteur retire son propre message (sur tous les magasins du même envoi)
CREATE OR REPLACE FUNCTION public.supprimer_message(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_lot uuid;
BEGIN
  SELECT lot INTO v_lot FROM public.messages WHERE id = p_id AND auteur = auth.uid();
  DELETE FROM public.messages WHERE auteur = auth.uid() AND (id = p_id OR (v_lot IS NOT NULL AND lot = v_lot));
END $$;

-- Un magasin renommé garde son fil
CREATE OR REPLACE FUNCTION public.renommer_magasin_messages(p_ancien text, p_nouveau text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_equipe() OR NOT public.peut_ecrire_magasin(p_ancien) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.messages SET store = p_nouveau WHERE store = p_ancien;
  UPDATE public.messages SET magasins = array_replace(magasins, p_ancien, p_nouveau) WHERE p_ancien = ANY(magasins);
  DELETE FROM public.messages_lus l WHERE l.store = p_ancien
    AND EXISTS (SELECT 1 FROM public.messages_lus n WHERE n.user_id = l.user_id AND n.store = p_nouveau AND n.sujet = l.sujet);
  UPDATE public.messages_lus SET store = p_nouveau WHERE store = p_ancien;
END $$;

-- Droits d'appel : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['ma_cle()', 'pieces_propres(jsonb)', 'envoyer_a(text, text, text[], jsonb)', 'marquer_lu_personne(text)', 'magasins_messagerie()', 'peut_ecrire_magasin(text)', 'mon_nom()', 'messagerie()', 'marquer_lu(text, text)',
    'envoyer_message(text, text, text[], boolean, uuid)', 'supprimer_message(bigint)', 'renommer_magasin_messages(text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vérification : les deux tables existent, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name IN ('messages', 'messages_lus');
