-- ════════════════════════════════════════════════════════════════
-- V and B — « J'aime » et commentaires sur les comptes rendus de visite (22/10/2026)
-- Réexécutable. Suppose 0004 (mon_role, est_equipe, mes_magasins), 0006 (magasins_messagerie, mon_nom)
-- et 0012 (journal_migrations).
--
-- Dans le fil d'actualité, le franchisé et l'équipe aiment et commentent un compte rendu de visite.
-- Chacun ne réagit et ne lit les réactions que sur les visites qu'il voit déjà :
--   franchisé : visites de ses magasins, hors appels et points ;
--   Coach et RR : visites de leurs magasins ; Directeur : toutes.
-- Personne ne lit ni n'écrit les tables directement ; le nom et le rôle de l'auteur sont posés par la base.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.visites_pouces (
  visite   bigint NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom      text NOT NULL,
  cree_le  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visite, user_id)
);

CREATE TABLE IF NOT EXISTS public.visites_commentaires (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visite      bigint NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  auteur      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auteur_nom  text NOT NULL,
  auteur_role text NOT NULL,
  texte       text NOT NULL,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visites_commentaires_visite ON public.visites_commentaires (visite, cree_le);

-- Aucun accès direct
ALTER TABLE public.visites_pouces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites_commentaires ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visites_pouces, public.visites_commentaires FROM anon, authenticated;

-- La visite est-elle visible du compte connecté ?
CREATE OR REPLACE FUNCTION public.visite_visible(p_id bigint) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_store text; v_type text; v_mag text[];
BEGIN
  SELECT v.store, coalesce(v.type, 'terrain') INTO v_store, v_type FROM public.visits v WHERE v.id = p_id;
  IF v_store IS NULL THEN RETURN false; END IF;
  IF public.mon_role() = 'franchise' THEN
    RETURN v_store = ANY(public.mes_magasins()) AND v_type NOT IN ('appel', 'point');
  END IF;
  IF NOT public.est_equipe() THEN RETURN false; END IF;
  v_mag := public.magasins_messagerie();
  RETURN v_mag IS NULL OR v_store = ANY(v_mag);
END $$;

-- Pouces et commentaires des visites visibles, rangés par visite
CREATE OR REPLACE FUNCTION public.reactions_visites() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN jsonb_build_object(
    'moi', auth.uid(),
    'pouces', (SELECT coalesce(jsonb_object_agg(visite, l), '{}'::jsonb) FROM (
      SELECT p.visite, jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nom', p.nom) ORDER BY p.cree_le) l
      FROM public.visites_pouces p WHERE public.visite_visible(p.visite) GROUP BY p.visite) x),
    'commentaires', (SELECT coalesce(jsonb_object_agg(visite, l), '{}'::jsonb) FROM (
      SELECT k.visite, jsonb_agg(jsonb_build_object('id', k.id, 'auteur', k.auteur, 'auteur_nom', k.auteur_nom, 'auteur_role', k.auteur_role,
        'texte', k.texte, 'cree_le', k.cree_le) ORDER BY k.cree_le, k.id) l
      FROM public.visites_commentaires k WHERE public.visite_visible(k.visite) GROUP BY k.visite) x));
END $$;

-- Pouce mis ou retiré ; renvoie true si le pouce est mis
CREATE OR REPLACE FUNCTION public.basculer_pouce_visite(p_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.visite_visible(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.visites_pouces WHERE visite = p_id AND user_id = auth.uid();
  IF FOUND THEN RETURN false; END IF;
  INSERT INTO public.visites_pouces (visite, user_id, nom) VALUES (p_id, auth.uid(), public.mon_nom());
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.commenter_visite(p_id bigint, p_texte text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texte text := trim(coalesce(p_texte, '')); v_id bigint;
BEGIN
  IF NOT public.visite_visible(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF v_texte = '' THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 2000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  INSERT INTO public.visites_commentaires (visite, auteur, auteur_nom, auteur_role, texte)
  VALUES (p_id, auth.uid(), public.mon_nom(), public.mon_role(), v_texte) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

-- Chacun retire son commentaire ; le Directeur peut retirer n'importe lequel
CREATE OR REPLACE FUNCTION public.supprimer_commentaire_visite(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.visites_commentaires WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur());
END $$;

-- Droits d'appel : comptes connectés seulement
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['visite_visible(bigint)', 'reactions_visites()', 'basculer_pouce_visite(bigint)', 'commenter_visite(bigint, text)',
    'supprimer_commentaire_visite(bigint)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0022', 'reactions_visites')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
