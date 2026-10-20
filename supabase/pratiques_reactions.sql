-- ════════════════════════════════════════════════════════════════
-- V and B — « J'aime » et commentaires sur les bonnes pratiques
-- À exécuter dans Supabase > SQL Editor, APRÈS acces_franchises.sql et messagerie.sql. Réexécutable.
--
-- 1) Les bonnes pratiques sont communes à tout le réseau (app_config, clé bonnes_pratiques) :
--    toute l'équipe et les franchisés les lisent, mettent un pouce et commentent.
-- 2) Personne ne lit ni n'écrit les tables directement : tout passe par les fonctions ci-dessous.
--    Le nom et le rôle de l'auteur sont posés par la base, jamais par l'app.
-- 3) Les anciens « J'aime » de l'équipe (champ jaime des pratiques) restent affichés.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pratiques_pouces (
  pratique text NOT NULL, -- identifiant de la bonne pratique
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom      text NOT NULL,
  cree_le  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pratique, user_id)
);

CREATE TABLE IF NOT EXISTS public.pratiques_commentaires (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pratique    text NOT NULL,
  auteur      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom  text NOT NULL,
  auteur_role text NOT NULL,
  texte       text NOT NULL,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pratiques_commentaires_pratique ON public.pratiques_commentaires (pratique, cree_le);

-- Aucun accès direct
ALTER TABLE public.pratiques_pouces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pratiques_commentaires ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pratiques_pouces, public.pratiques_commentaires FROM anon, authenticated;

-- La bonne pratique existe-t-elle, et le compte connecté fait-il partie du réseau ?
CREATE OR REPLACE FUNCTION public.pratique_visible(p_id text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.app_config c, jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(c.value)) = 'array' THEN public.json_sur(c.value) ELSE '[]'::jsonb END) x
    WHERE c.key = 'bonnes_pratiques' AND x->>'id' = p_id);
END $$;

-- Pouces et commentaires de toutes les bonnes pratiques, rangés par pratique
CREATE OR REPLACE FUNCTION public.reactions_pratiques() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN jsonb_build_object(
    'moi', auth.uid(),
    'pouces', (SELECT coalesce(jsonb_object_agg(pratique, l), '{}'::jsonb) FROM (
      SELECT p.pratique, jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nom', p.nom) ORDER BY p.cree_le) l
      FROM public.pratiques_pouces p GROUP BY p.pratique) x),
    'commentaires', (SELECT coalesce(jsonb_object_agg(pratique, l), '{}'::jsonb) FROM (
      SELECT k.pratique, jsonb_agg(jsonb_build_object('id', k.id, 'auteur', k.auteur, 'auteur_nom', k.auteur_nom, 'auteur_role', k.auteur_role,
        'texte', k.texte, 'cree_le', k.cree_le) ORDER BY k.cree_le, k.id) l
      FROM public.pratiques_commentaires k GROUP BY k.pratique) x));
END $$;

-- Pouce mis ou retiré ; renvoie true si le pouce est mis
CREATE OR REPLACE FUNCTION public.basculer_pouce_pratique(p_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.pratique_visible(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.pratiques_pouces WHERE pratique = p_id AND user_id = auth.uid();
  IF FOUND THEN RETURN false; END IF;
  INSERT INTO public.pratiques_pouces (pratique, user_id, nom) VALUES (p_id, auth.uid(), public.mon_nom());
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.commenter_pratique(p_id text, p_texte text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texte text := trim(coalesce(p_texte, '')); v_id bigint;
BEGIN
  IF NOT public.pratique_visible(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 2000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  INSERT INTO public.pratiques_commentaires (pratique, auteur, auteur_nom, auteur_role, texte)
  VALUES (p_id, auth.uid(), public.mon_nom(), public.mon_role(), v_texte) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- Chacun retire son commentaire ; le Directeur peut retirer n'importe lequel
CREATE OR REPLACE FUNCTION public.supprimer_commentaire_pratique(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.pratiques_commentaires WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur());
END $$;

-- Droits d'appel : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['pratique_visible(text)', 'reactions_pratiques()', 'basculer_pouce_pratique(text)', 'commenter_pratique(text, text)',
    'supprimer_commentaire_pratique(bigint)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vérification : les deux tables existent, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name IN ('pratiques_pouces', 'pratiques_commentaires');
