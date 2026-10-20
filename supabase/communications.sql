-- ════════════════════════════════════════════════════════════════
-- V and B — Communications du réseau vers les franchisés
-- À exécuter dans Supabase > SQL Editor, APRÈS messagerie.sql. Réexécutable.
-- Puis rejouer pieces_jointes.sql pour que les photos et fichiers joints soient lisibles.
--
-- 1) Le Directeur de réseau publie pour tout le réseau ; un Responsable Régional, pour ses magasins
--    (la liste est figée à la publication). L'auteur modifie ou retire sa publication.
-- 2) Toute l'équipe et les franchisés concernés lisent, commentent et mettent un pouce.
--    Coach et RR : les publications de tout le réseau et celles qui citent un de leurs magasins.
-- 3) Personne ne lit ni n'écrit les tables directement : tout passe par les fonctions ci-dessous.
--    Le nom et le rôle de l'auteur sont posés par la base, jamais par l'app.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.communications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titre       text NOT NULL,
  texte       text NOT NULL DEFAULT '',
  pieces      jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{chemin, nom, taille, type}], seau « pieces »
  magasins    text[],                             -- NULL = tout le réseau
  auteur      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom  text NOT NULL,
  auteur_role text NOT NULL,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  modifie_le  timestamptz
);
CREATE INDEX IF NOT EXISTS communications_date ON public.communications (cree_le DESC);

CREATE TABLE IF NOT EXISTS public.communications_pouces (
  communication bigint NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom           text NOT NULL,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (communication, user_id)
);

CREATE TABLE IF NOT EXISTS public.communications_commentaires (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  communication bigint NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  auteur        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom    text NOT NULL,
  auteur_role   text NOT NULL,
  texte         text NOT NULL,
  cree_le       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communications_commentaires_comm ON public.communications_commentaires (communication, cree_le);

-- Aucun accès direct
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications_pouces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications_commentaires ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.communications, public.communications_pouces, public.communications_commentaires FROM anon, authenticated;

-- Le compte connecté voit-il cette publication ?
CREATE OR REPLACE FUNCTION public.communication_visible(p_id bigint) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[]; v_cible text[]; v_auteur uuid;
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RETURN false; END IF;
  SELECT c.magasins, c.auteur INTO v_cible, v_auteur FROM public.communications c WHERE c.id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_cible IS NULL OR v_auteur = auth.uid() THEN RETURN true; END IF;
  v_mag := public.magasins_messagerie();
  RETURN v_mag IS NULL OR v_cible && v_mag;
END $$;

-- Publications visibles (24 derniers mois), avec leurs pouces et commentaires
CREATE OR REPLACE FUNCTION public.communications() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.magasins_messagerie();
  RETURN jsonb_build_object(
    'moi', auth.uid(),
    'role', public.mon_role(),
    'liste', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'titre', c.titre, 'texte', c.texte, 'pieces', c.pieces, 'magasins', to_jsonb(c.magasins),
        'auteur', c.auteur, 'auteur_nom', c.auteur_nom, 'auteur_role', c.auteur_role, 'cree_le', c.cree_le, 'modifie_le', c.modifie_le,
        'pouces', (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nom', p.nom) ORDER BY p.cree_le), '[]'::jsonb)
                   FROM public.communications_pouces p WHERE p.communication = c.id),
        'commentaires', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'auteur', k.auteur, 'auteur_nom', k.auteur_nom, 'auteur_role', k.auteur_role,
                   'texte', k.texte, 'cree_le', k.cree_le) ORDER BY k.cree_le, k.id), '[]'::jsonb)
                   FROM public.communications_commentaires k WHERE k.communication = c.id)
      ) ORDER BY c.cree_le DESC, c.id DESC), '[]'::jsonb)
      FROM public.communications c
      WHERE c.cree_le > now() - interval '24 months'
        AND (c.magasins IS NULL OR c.auteur = auth.uid() OR v_mag IS NULL OR c.magasins && v_mag)));
END $$;

-- Publication nouvelle (p_id NULL) ou modifiée par son auteur.
-- Directeur : tout le réseau ; Responsable Régional : ses magasins.
CREATE OR REPLACE FUNCTION public.publier_communication(p_id bigint, p_titre text, p_texte text, p_pieces jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := public.mon_role(); v_titre text := trim(coalesce(p_titre, '')); v_texte text := trim(coalesce(p_texte, ''));
  v_cible text[]; v_id bigint; v_pieces jsonb;
BEGIN
  IF v_role NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_titre = '' THEN RAISE EXCEPTION 'titre_vide'; END IF;
  IF length(v_titre) > 200 OR length(v_texte) > 8000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  IF p_id IS NULL THEN
    v_cible := CASE WHEN v_role = 'rr' THEN coalesce(public.magasins_messagerie(), '{}') END;
    INSERT INTO public.communications (titre, texte, pieces, magasins, auteur, auteur_nom, auteur_role)
    VALUES (v_titre, v_texte, public.pieces_propres(p_pieces), v_cible, auth.uid(), public.mon_nom(), v_role)
    RETURNING id INTO v_id;
  ELSE
    -- Les fichiers déjà joints restent ; seuls les nouveaux doivent appartenir au compte
    SELECT coalesce(jsonb_agg(e), '[]'::jsonb) INTO v_pieces FROM (
      SELECT e FROM public.communications c, jsonb_array_elements(c.pieces) e
      WHERE c.id = p_id AND p_pieces @> jsonb_build_array(jsonb_build_object('chemin', e->>'chemin'))
      UNION ALL SELECT e FROM jsonb_array_elements(public.pieces_propres(p_pieces)) e
        WHERE NOT EXISTS (SELECT 1 FROM public.communications c WHERE c.id = p_id AND c.pieces @> jsonb_build_array(jsonb_build_object('chemin', e->>'chemin')))
    ) x;
    UPDATE public.communications SET titre = v_titre, texte = v_texte, pieces = v_pieces, modifie_le = now()
    WHERE id = p_id AND auteur = auth.uid() RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- L'auteur retire sa publication (commentaires et pouces partent avec) ; le Directeur peut tout retirer
CREATE OR REPLACE FUNCTION public.supprimer_communication(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.communications WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur());
END $$;

-- Pouce mis ou retiré ; renvoie true si le pouce est mis
CREATE OR REPLACE FUNCTION public.basculer_pouce_communication(p_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.communication_visible(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.communications_pouces WHERE communication = p_id AND user_id = auth.uid();
  IF FOUND THEN RETURN false; END IF;
  INSERT INTO public.communications_pouces (communication, user_id, nom) VALUES (p_id, auth.uid(), public.mon_nom());
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.commenter_communication(p_id bigint, p_texte text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texte text := trim(coalesce(p_texte, '')); v_id bigint;
BEGIN
  IF NOT public.communication_visible(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 2000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  INSERT INTO public.communications_commentaires (communication, auteur, auteur_nom, auteur_role, texte)
  VALUES (p_id, auth.uid(), public.mon_nom(), public.mon_role(), v_texte) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- Chacun retire son commentaire ; le Directeur peut retirer n'importe lequel
CREATE OR REPLACE FUNCTION public.supprimer_commentaire_communication(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.communications_commentaires WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur());
END $$;

-- Droits d'appel : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['communication_visible(bigint)', 'communications()', 'publier_communication(bigint, text, text, jsonb)', 'supprimer_communication(bigint)',
    'basculer_pouce_communication(bigint)', 'commenter_communication(bigint, text)', 'supprimer_commentaire_communication(bigint)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Vérification : les trois tables existent, sans accès direct
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name IN ('communications', 'communications_pouces', 'communications_commentaires');
