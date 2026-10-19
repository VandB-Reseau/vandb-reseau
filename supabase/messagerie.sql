-- ════════════════════════════════════════════════════════════════
-- V and B — Messagerie par magasin et notifications
-- À exécuter dans Supabase > SQL Editor, APRÈS acces_franchises.sql. Réexécutable.
--
-- 1) Un fil de messages par magasin : Directeur de réseau, Responsables Régionaux,
--    Coachs et franchisés du magasin.
-- 2) Personne ne lit ni n'écrit les tables directement : tout passe par les
--    fonctions ci-dessous, qui vérifient le rôle (lu dans la base) et, pour un
--    franchisé, que le magasin est bien le sien.
-- 3) Le nom et le rôle de l'auteur sont posés par la base, jamais par l'app.
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

-- Le compte connecté peut-il écrire sur ce magasin ?
CREATE OR REPLACE FUNCTION public.peut_ecrire_magasin(p_store text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.est_equipe() OR (public.mon_role() = 'franchise' AND p_store = ANY(public.mes_magasins()))
$$;

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

-- Messages visibles par le compte (18 derniers mois) et ses dernières lectures.
-- « reference » : ouverture de l'accès d'un franchisé, pour ne pas lui signaler tout l'historique.
CREATE OR REPLACE FUNCTION public.messagerie() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := public.mon_role(); v_mag text[]; v_ref timestamptz;
BEGIN
  IF v_role = 'franchise' THEN
    v_mag := public.mes_magasins();
    SELECT a.ouvert_le INTO v_ref FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  ELSIF NOT public.est_equipe() THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  RETURN jsonb_build_object(
    'moi', auth.uid(),
    'reference', v_ref,
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'store', m.store, 'auteur', m.auteur, 'auteur_nom', m.auteur_nom,
        'auteur_role', m.auteur_role, 'texte', m.texte, 'mentions', to_jsonb(m.mentions), 'cree_le', m.cree_le) ORDER BY m.cree_le, m.id), '[]'::jsonb)
      FROM public.messages m WHERE (v_mag IS NULL OR m.store = ANY(v_mag)) AND m.cree_le > now() - interval '18 months'),
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

CREATE OR REPLACE FUNCTION public.envoyer_message(p_store text, p_texte text, p_mentions text[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texte text := trim(coalesce(p_texte, '')); v_id bigint; v_le timestamptz;
BEGIN
  IF NOT public.peut_ecrire_magasin(p_store) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 4000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  INSERT INTO public.messages (store, auteur, auteur_nom, auteur_role, texte, mentions)
  VALUES (p_store, auth.uid(), public.mon_nom(), public.mon_role(), v_texte,
    coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_mentions) x WHERE x ~ '^(directeur|rr:.+|coach:.+|franchise:.+)$'), '{}'))
  RETURNING id, cree_le INTO v_id, v_le;
  PERFORM public.marquer_lu(p_store, 'messages');
  RETURN jsonb_build_object('id', v_id, 'cree_le', v_le);
END $$;

-- Un auteur retire son propre message
CREATE OR REPLACE FUNCTION public.supprimer_message(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.messages WHERE id = p_id AND auteur = auth.uid();
END $$;

-- Un magasin renommé garde son fil
CREATE OR REPLACE FUNCTION public.renommer_magasin_messages(p_ancien text, p_nouveau text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.messages SET store = p_nouveau WHERE store = p_ancien;
  DELETE FROM public.messages_lus l WHERE l.store = p_ancien
    AND EXISTS (SELECT 1 FROM public.messages_lus n WHERE n.user_id = l.user_id AND n.store = p_nouveau AND n.sujet = l.sujet);
  UPDATE public.messages_lus SET store = p_nouveau WHERE store = p_ancien;
END $$;

-- Droits d'appel : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['peut_ecrire_magasin(text)', 'mon_nom()', 'messagerie()', 'marquer_lu(text, text)',
    'envoyer_message(text, text, text[])', 'supprimer_message(bigint)', 'renommer_magasin_messages(text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vérification : les deux tables existent, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name IN ('messages', 'messages_lus');
