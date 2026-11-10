-- ════════════════════════════════════════════════════════════════
-- V and B — Messagerie, refonte vague 6 (10/11/2026, choix 57, 60 et 62 de Joseph)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (franchisés), 0005 (périmètre), 0006 (messagerie),
-- 0009 (pièces), 0018 (groupes et fils) et 0043 (demandes).
--
-- 57 Une demande au siège peut naître d'un message du franchisé : demande_depuis_message() (équipe seule) crée la
--    demande (thème, titre, le message comme premier échange) et relie le message à la demande (colonne demande).
-- 60 Gestes sur un message : réponse à un message précis (repond_a), modification par son auteur pendant 15 minutes
--    (modifie_le), épingle dans la conversation (epingle_le, epingle_par), réactions courtes « vu », « merci »,
--    « accord » (table messages_reactions, fermée). Envoi avec citation : ecrire_fil() et ecrire_a(), qui passent par
--    envoyer_fil() et envoyer_a() (mêmes contrôles, mêmes notifications) puis posent la citation.
-- 62 Message à plusieurs magasins : ecrire_magasins() (équipe seule) écrit dans le fil « Avec le franchisé » de
--    chaque magasin choisi, parmi ceux du compte, avec « {prénom} » remplacé par le prénom du franchisé ; les
--    messages d'un même envoi partagent un « lot » (colonne de 0006), ce qui permet le suivi des réponses.
-- messagerie() passe en version 5 et renvoie ces nouvelles colonnes et les réactions.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS repond_a bigint REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS modifie_le timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS epingle_le timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS epingle_par text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS demande bigint REFERENCES public.demandes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_lot ON public.messages (lot) WHERE lot IS NOT NULL;

-- Réactions : une ligne par message, compte et réaction ; table fermée, tout passe par les fonctions
CREATE TABLE IF NOT EXISTS public.messages_reactions (
  message_id bigint NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom        text NOT NULL,
  reaction   text NOT NULL CHECK (reaction IN ('vu', 'merci', 'accord')),
  le         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);
ALTER TABLE public.messages_reactions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages_reactions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages_reactions', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.messages_reactions FROM PUBLIC, anon, authenticated;

-- Le compte connecté lit-il ce message ? Mêmes règles que messagerie() : échange à deux (auteur ou destinataire),
-- groupe libre (membre), fil d'un magasin (ses magasins ; jamais « Équipe seule » pour un franchisé).
CREATE OR REPLACE FUNCTION public.peut_lire_message(p_id bigint) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.messages; v_cle text := public.ma_cle();
BEGIN
  IF v_cle IS NULL OR NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RETURN false; END IF;
  SELECT * INTO m FROM public.messages x WHERE x.id = p_id;
  IF m.id IS NULL THEN RETURN false; END IF;
  IF m.groupe IS NOT NULL THEN RETURN EXISTS (SELECT 1 FROM public.groupes g WHERE g.id = m.groupe AND v_cle = ANY(g.membres)); END IF;
  IF m.destinataire IS NOT NULL THEN RETURN m.auteur = auth.uid() OR m.destinataire = v_cle; END IF;
  IF m.store IS NULL THEN RETURN false; END IF;
  IF m.equipe AND NOT public.est_equipe() THEN RETURN false; END IF;
  RETURN public.peut_ecrire_magasin(m.store);
END $$;

-- Message dans un fil, en réponse à un message précis (que le compte lit et qui est dans le même fil)
CREATE OR REPLACE FUNCTION public.ecrire_fil(p_fil text, p_texte text, p_mentions text[] DEFAULT '{}', p_pieces jsonb DEFAULT '[]', p_repond_a bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb; v_id bigint; c public.messages; n public.messages;
BEGIN
  v := public.envoyer_fil(p_fil, p_texte, p_mentions, p_pieces);
  v_id := (v->>'id')::bigint;
  IF p_repond_a IS NOT NULL AND public.peut_lire_message(p_repond_a) THEN
    SELECT * INTO c FROM public.messages WHERE id = p_repond_a;
    SELECT * INTO n FROM public.messages WHERE id = v_id;
    IF c.groupe IS NOT DISTINCT FROM n.groupe AND c.destinataire IS NOT DISTINCT FROM n.destinataire
      AND c.store IS NOT DISTINCT FROM n.store AND c.equipe = n.equipe THEN
      UPDATE public.messages SET repond_a = p_repond_a WHERE id = v_id;
    END IF;
  END IF;
  RETURN v;
END $$;

-- Message à une personne, en réponse à un message de cet échange
CREATE OR REPLACE FUNCTION public.ecrire_a(p_destinataire text, p_texte text, p_magasins text[] DEFAULT '{}', p_pieces jsonb DEFAULT '[]', p_repond_a bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb; c public.messages; v_cle text := public.ma_cle();
BEGIN
  v := public.envoyer_a(p_destinataire, p_texte, p_magasins, p_pieces);
  IF p_repond_a IS NOT NULL AND public.peut_lire_message(p_repond_a) THEN
    SELECT * INTO c FROM public.messages WHERE id = p_repond_a;
    IF c.groupe IS NULL AND c.destinataire IS NOT NULL
      AND ((c.destinataire = p_destinataire AND c.auteur = auth.uid()) OR (c.destinataire = v_cle AND c.auteur_cle = p_destinataire)) THEN
      UPDATE public.messages SET repond_a = p_repond_a WHERE id = (v->>'id')::bigint;
    END IF;
  END IF;
  RETURN v;
END $$;

-- Prénom du franchisé d'un magasin (accès ouvert, sinon fiche du magasin) : premier mot du nom
CREATE OR REPLACE FUNCTION public.prenom_franchise(p_store text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(nullif(split_part(btrim(coalesce(
    (SELECT a.franchise FROM public.acces_franchises a WHERE p_store = ANY(a.magasins) ORDER BY a.franchise LIMIT 1),
    (SELECT o.resp FROM public.store_overrides o WHERE o.store_name = p_store LIMIT 1), '')), ' ', 1), ''), '')
$$;

-- Message à plusieurs magasins (équipe) : un message par magasin dans le fil « Avec le franchisé », reliés par un lot
CREATE OR REPLACE FUNCTION public.ecrire_magasins(p_magasins text[], p_texte text, p_pieces jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_lot uuid := gen_random_uuid(); v_mag text; v_ids bigint[] := '{}'; v jsonb; v_texte text; v_prenom text;
  v_liste text[] := (SELECT coalesce(array_agg(DISTINCT x ORDER BY x), '{}') FROM unnest(coalesce(p_magasins, '{}')) x WHERE btrim(x) <> '');
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF cardinality(v_liste) = 0 THEN RAISE EXCEPTION 'aucun_magasin'; END IF;
  IF cardinality(v_liste) > 400 THEN RAISE EXCEPTION 'trop_de_magasins'; END IF;
  FOREACH v_mag IN ARRAY v_liste LOOP
    IF NOT public.peut_ecrire_magasin(v_mag) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  END LOOP;
  FOREACH v_mag IN ARRAY v_liste LOOP
    v_prenom := public.prenom_franchise(v_mag);
    v_texte := replace(replace(replace(replace(coalesce(p_texte, ''), '{prénom}', v_prenom), '{Prénom}', v_prenom), '{prenom}', v_prenom), '{Prenom}', v_prenom);
    v_texte := regexp_replace(v_texte, '(^|\s) +([,.!?])', '\1\2', 'g');
    v := public.envoyer_fil('magasin:' || v_mag, v_texte, '{}', p_pieces);
    UPDATE public.messages SET lot = v_lot WHERE id = (v->>'id')::bigint;
    v_ids := array_append(v_ids, (v->>'id')::bigint);
  END LOOP;
  RETURN jsonb_build_object('lot', v_lot, 'ids', to_jsonb(v_ids));
END $$;

-- Modification par l'auteur, pendant 15 minutes
CREATE OR REPLACE FUNCTION public.modifier_message(p_id bigint, p_texte text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.messages; v_texte text := btrim(coalesce(p_texte, ''));
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = p_id FOR UPDATE;
  IF m.id IS NULL OR m.auteur IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF m.cree_le < now() - interval '15 minutes' THEN RAISE EXCEPTION 'trop_tard'; END IF;
  IF v_texte = '' AND jsonb_array_length(m.pieces) = 0 THEN RAISE EXCEPTION 'message_vide'; END IF;
  IF length(v_texte) > 4000 THEN RAISE EXCEPTION 'message_trop_long'; END IF;
  UPDATE public.messages SET texte = v_texte, modifie_le = now() WHERE id = p_id;
END $$;

-- Épingle d'un message dans sa conversation : toute personne qui le lit
CREATE OR REPLACE FUNCTION public.epingler_message(p_id bigint, p_epingle boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.peut_lire_message(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.messages SET epingle_le = CASE WHEN p_epingle THEN now() END, epingle_par = CASE WHEN p_epingle THEN public.mon_nom() END
  WHERE id = p_id;
END $$;

-- Réaction courte : posée ou retirée (bascule) ; renvoie vrai si elle est posée
CREATE OR REPLACE FUNCTION public.reagir_message(p_id bigint, p_reaction text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_reaction NOT IN ('vu', 'merci', 'accord') THEN RAISE EXCEPTION 'reaction_inconnue'; END IF;
  IF NOT public.peut_lire_message(p_id) THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  DELETE FROM public.messages_reactions WHERE message_id = p_id AND user_id = auth.uid() AND reaction = p_reaction;
  IF FOUND THEN RETURN false; END IF;
  INSERT INTO public.messages_reactions (message_id, user_id, nom, reaction) VALUES (p_id, auth.uid(), public.mon_nom(), p_reaction);
  RETURN true;
END $$;

-- Demande au siège née d'un message du fil « Avec le franchisé » d'un magasin (équipe de ce magasin)
CREATE OR REPLACE FUNCTION public.demande_depuis_message(p_id bigint, p_theme text, p_titre text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.messages; v_titre text := left(regexp_replace(btrim(coalesce(p_titre, '')), '\s+', ' ', 'g'), 200); v_id bigint; v_fr text;
BEGIN
  IF NOT public.est_equipe() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = p_id FOR UPDATE;
  IF m.id IS NULL OR m.store IS NULL OR m.destinataire IS NOT NULL OR m.groupe IS NOT NULL OR m.equipe OR NOT public.peut_ecrire_magasin(m.store) THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  IF m.demande IS NOT NULL THEN RETURN m.demande; END IF;
  IF v_titre = '' THEN RAISE EXCEPTION 'demande_vide'; END IF;
  IF p_theme NOT IN ('achats', 'travaux', 'marketing', 'caisse', 'juridique', 'autre') THEN RAISE EXCEPTION 'theme_invalide'; END IF;
  v_fr := coalesce((SELECT a.franchise FROM public.acces_franchises a WHERE m.store = ANY(a.magasins) ORDER BY a.franchise LIMIT 1),
    CASE WHEN m.auteur_role = 'franchise' THEN m.auteur_nom END, '');
  INSERT INTO public.demandes (magasin, franchise, theme, titre, echanges)
  VALUES (m.store, v_fr, p_theme, v_titre,
    CASE WHEN btrim(m.texte) = '' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('par', m.auteur_nom,
      'role', CASE WHEN m.auteur_role = 'franchise' THEN 'franchise' ELSE 'equipe' END, 'texte', left(m.texte, 5000), 'le', m.cree_le)) END)
  RETURNING id INTO v_id;
  UPDATE public.messages SET demande = v_id WHERE id = p_id;
  RETURN v_id;
END $$;

-- Messages visibles (mêmes règles que 0018), en version 5 : citation, modification, épingle, demande, réactions
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
    'version', 5,
    'cle', v_cle,
    'reference', v_ref,
    'groupes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nom', g.nom, 'membres', to_jsonb(g.membres), 'cree_par', g.cree_par, 'cree_le', g.cree_le) ORDER BY g.nom), '[]'::jsonb)
      FROM public.groupes g WHERE g.id = ANY(v_groupes)),
    'messages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'store', m.store, 'auteur', m.auteur, 'auteur_nom', m.auteur_nom,
        'auteur_role', m.auteur_role, 'texte', m.texte, 'mentions', to_jsonb(m.mentions), 'cree_le', m.cree_le, 'equipe', m.equipe, 'lot', m.lot,
        'destinataire', m.destinataire, 'auteur_cle', m.auteur_cle, 'magasins', to_jsonb(m.magasins), 'pieces', m.pieces, 'groupe', m.groupe,
        'repond_a', m.repond_a, 'modifie_le', m.modifie_le, 'epingle_le', m.epingle_le, 'epingle_par', m.epingle_par, 'demande', m.demande,
        'reactions', (SELECT coalesce(jsonb_agg(jsonb_build_object('reaction', r.reaction, 'nom', r.nom, 'moi', r.user_id = auth.uid()) ORDER BY r.le), '[]'::jsonb)
          FROM public.messages_reactions r WHERE r.message_id = m.id)) ORDER BY m.cree_le, m.id), '[]'::jsonb)
      FROM public.messages m WHERE m.cree_le > now() - interval '18 months' AND (
        (m.destinataire IS NOT NULL AND m.groupe IS NULL AND (m.auteur = auth.uid() OR m.destinataire = v_cle))
        OR (m.groupe IS NOT NULL AND m.groupe = ANY(v_groupes))
        OR (m.destinataire IS NULL AND m.groupe IS NULL AND m.store IS NOT NULL AND (v_mag IS NULL OR m.store = ANY(v_mag)) AND NOT (m.equipe AND v_role = 'franchise')))),
    'lus', (SELECT coalesce(jsonb_object_agg(l.store || '|' || l.sujet, l.lu_le), '{}'::jsonb) FROM public.messages_lus l WHERE l.user_id = auth.uid()));
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['peut_lire_message(bigint)', 'ecrire_fil(text, text, text[], jsonb, bigint)', 'ecrire_a(text, text, text[], jsonb, bigint)',
    'ecrire_magasins(text[], text, jsonb)', 'modifier_message(bigint, text)', 'epingler_message(bigint, boolean)', 'reagir_message(bigint, text)',
    'demande_depuis_message(bigint, text, text)', 'messagerie()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
-- Prénom d'un franchisé : seulement par ecrire_magasins()
REVOKE ALL ON FUNCTION public.prenom_franchise(text) FROM PUBLIC, anon, authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0045', 'messagerie_vague6')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();

-- Vérification : la table des réactions existe, sans accès direct ; les colonnes sont là
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'messages_reactions';
