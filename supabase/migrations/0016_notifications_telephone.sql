-- ════════════════════════════════════════════════════════════════
-- V and B — Notifications sur le téléphone (21/10/2026, lot L8)
-- Réexécutable. Suppose 0004 (franchisés), 0006 (messagerie) et 0012 (journal).
--
-- 1) abonnements_push : les appareils où une personne a activé les notifications (un appareil = un compte).
--    Aucun accès direct : abonner_appareil() et desabonner_appareil() pour le compte connecté.
-- 2) cles_push : la paire de clés d'envoi, créée par la fonction Supabase « notifier » à son premier appel.
--    Lue par cette fonction seule (service_role), jamais par un compte.
-- 3) notifications_a_envoyer() : pour la fonction « notifier » seule. Pour un message privé, son destinataire ;
--    pour un compte rendu de visite, les franchisés du magasin. Rien n'est envoyé à l'auteur.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.abonnements_push (
  endpoint text PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh   text NOT NULL,
  auth     text NOT NULL,
  cree_le  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS abonnements_push_user ON public.abonnements_push (user_id);

CREATE TABLE IF NOT EXISTS public.cles_push (
  id       integer PRIMARY KEY CHECK (id = 1),
  publique text NOT NULL,
  privee   text NOT NULL,
  cree_le  timestamptz NOT NULL DEFAULT now()
);

-- Tables fermées : RLS sans aucune règle, aucun droit pour les comptes
ALTER TABLE public.abonnements_push ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cles_push ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('abonnements_push', 'cles_push') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;
REVOKE ALL ON public.abonnements_push, public.cles_push FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.abonnements_push, public.cles_push TO service_role;
  END IF;
END $$;

-- L'appareil du compte connecté reçoit désormais ses notifications (il quitte un autre compte s'il y était)
CREATE OR REPLACE FUNCTION public.abonner_appareil(p_endpoint text, p_p256dh text, p_auth text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF coalesce(p_endpoint, '') !~ '^https://' OR length(p_endpoint) > 1000 OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = ''
     OR length(p_p256dh) > 200 OR length(p_auth) > 100 THEN RAISE EXCEPTION 'format'; END IF;
  INSERT INTO public.abonnements_push (endpoint, user_id, p256dh, auth) VALUES (p_endpoint, auth.uid(), p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE SET user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, cree_le = now();
END $$;

CREATE OR REPLACE FUNCTION public.desabonner_appareil(p_endpoint text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.abonnements_push WHERE endpoint = p_endpoint AND user_id = auth.uid();
END $$;

-- Comptes qui portent une clé de personne : directeur, rr:<id>, coach:<nom>, franchise:<nom>
CREATE OR REPLACE FUNCTION public.comptes_de_cle(p_cle text) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id FROM auth.users u WHERE
       (p_cle = 'directeur' AND u.raw_app_meta_data->>'role' = 'directeur')
    OR (p_cle LIKE 'rr:%' AND u.raw_app_meta_data->>'role' = 'rr' AND u.raw_app_meta_data->>'rr' = substr(p_cle, 4))
    OR (p_cle LIKE 'coach:%' AND u.raw_app_meta_data->>'role' = 'coach' AND u.raw_app_meta_data->>'coach' = substr(p_cle, 7))
  UNION
  SELECT a.user_id FROM public.acces_franchises a WHERE p_cle LIKE 'franchise:%' AND a.franchise = substr(p_cle, 11)
$$;

-- Notifications à envoyer, avec les appareils de chaque destinataire.
-- p_type 'message' : messages écrits par p_auteur il y a moins de 10 minutes.
-- p_type 'visite' : comptes rendus (hors appels et points téléphoniques) d'une visite des 7 derniers jours,
-- envoyés par un membre de l'équipe (pas de notification pour une visite seulement planifiée).
CREATE OR REPLACE FUNCTION public.notifications_a_envoyer(p_type text, p_ids bigint[], p_auteur uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb := '[]'::jsonb; v_role text;
BEGIN
  SELECT u.raw_app_meta_data->>'role' INTO v_role FROM auth.users u WHERE u.id = p_auteur;
  IF p_type = 'message' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', m.auteur_nom,
        'texte', CASE WHEN m.texte = '' THEN 'Pièce jointe' ELSE left(m.texte, 140) END,
        'lien', '#/messages/personne/' || replace(coalesce(m.auteur_cle, ''), ' ', '%20'))), '[]'::jsonb) INTO v
    FROM public.messages m
    JOIN LATERAL public.comptes_de_cle(m.destinataire) d(user_id) ON true
    JOIN public.abonnements_push a ON a.user_id = d.user_id
    WHERE m.id = ANY(p_ids) AND m.auteur = p_auteur AND m.destinataire IS NOT NULL
      AND m.cree_le > now() - interval '10 minutes' AND d.user_id <> p_auteur;
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

REVOKE ALL ON FUNCTION public.abonner_appareil(text, text, text), public.desabonner_appareil(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abonner_appareil(text, text, text), public.desabonner_appareil(text) TO authenticated;
REVOKE ALL ON FUNCTION public.comptes_de_cle(text), public.notifications_a_envoyer(text, bigint[], uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.comptes_de_cle(text), public.notifications_a_envoyer(text, bigint[], uuid) TO service_role;
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0016', 'notifications_telephone')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : les deux tables existent
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('abonnements_push', 'cles_push') ORDER BY 1;
