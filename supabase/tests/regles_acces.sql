-- Vérifie les règles d'accès après les migrations, avec des données fictives.
-- Chaque contrôle qui échoue arrête le script avec un message clair.
\set ON_ERROR_STOP 1

-- ── Comptes et périmètre fictifs
INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000d', 'directeur@exemple.fr', '{"role":"directeur"}'),
  ('00000000-0000-0000-0000-00000000000c', 'coach@exemple.fr',     '{"role":"coach","coach":"Coach Nord"}'),
  ('00000000-0000-0000-0000-00000000000f', 'franchise@exemple.fr', '{"role":"franchise"}'),
  ('00000000-0000-0000-0000-000000000000', 'sansrole@exemple.fr',  '{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.acces_franchises (user_id, email, franchise, magasins)
VALUES ('00000000-0000-0000-0000-00000000000f', 'franchise@exemple.fr', 'Franchisé Test', '{Lille}') ON CONFLICT DO NOTHING;
INSERT INTO public.perimetre_equipe (store_name, coach, rrs) VALUES ('Lille', 'Coach Nord', '{}'), ('Nice', 'Coach Sud', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.visits (store, visit_date) VALUES ('Lille', '2026-10-01'), ('Nice', '2026-10-02');
INSERT INTO public.store_finance (store_name, month, ca_cave) VALUES ('Lille', '2026-09-01', 1), ('Nice', '2026-09-01', 1) ON CONFLICT DO NOTHING;
INSERT INTO public.app_config (key, value) VALUES ('params', '{}') ON CONFLICT DO NOTHING;
INSERT INTO storage.objects (bucket_id, name) VALUES ('photos', 'audit/Nice/1.jpg');
INSERT INTO public.store_overrides (store_name, resp) VALUES ('Lille', 'Paul LILLE'), ('Nice', 'Nina NICE');
INSERT INTO public.fiches_personnes (cle, fiche) VALUES ('directeur', '{}'), ('coach:Coach Nord', '{}'), ('coach:Coach Sud', '{}'), ('rr:rr1', '{}'),
  ('franchise:Paul LILLE', '{"telephone":"0600000000"}'), ('franchise:Franchisé Test', '{}'), ('franchise:Nina NICE', '{"naissance":"1980-01-01"}') ON CONFLICT DO NOTHING;
INSERT INTO public.communications (titre, auteur_nom, auteur_role) VALUES ('Annonce réseau', 'Directeur', 'directeur') RETURNING id AS annonce \gset
CREATE OR REPLACE FUNCTION pg_temp.refuse(appel text) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE appel; RETURN 0;
EXCEPTION WHEN others THEN RETURN 1;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.refuse(text) TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.attendre(libelle text, obtenu bigint, attendu bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF obtenu IS DISTINCT FROM attendu THEN RAISE EXCEPTION 'ÉCHEC : % (obtenu %, attendu %)', libelle, obtenu, attendu; END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.attendre(text, bigint, bigint) TO authenticated;

-- ── Directeur : voit tout
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT pg_temp.attendre('Directeur : toutes les visites', (SELECT count(*) FROM public.visits), 2);
SELECT pg_temp.attendre('Directeur : tous les chiffres', (SELECT count(*) FROM public.store_finance), 2);
SELECT pg_temp.attendre('Directeur : toutes les fiches des personnes', (SELECT count(*) FROM public.fiches_personnes), 7);

-- ── Coach : seulement ses magasins ; lit les référentiels sans les modifier
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : visites de ses magasins seulement', (SELECT count(*) FROM public.visits), 1);
SELECT pg_temp.attendre('Coach : chiffres de ses magasins seulement', (SELECT count(*) FROM public.store_finance), 1);
SELECT pg_temp.attendre('Coach : fiches de l''équipe et des franchisés de ses magasins', (SELECT count(*) FROM public.fiches_personnes), 6);
SELECT pg_temp.attendre('Coach : pas la fiche d''un franchisé d''un autre magasin', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'franchise:Nina NICE'), 0);
WITH m AS (UPDATE public.fiches_personnes SET fiche = '{}' WHERE cle = 'franchise:Paul LILLE' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas une fiche', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : n''ajoute pas de fiche', pg_temp.refuse('INSERT INTO public.fiches_personnes (cle) VALUES (''coach:Intrus'')'), 1);
SELECT pg_temp.attendre('Coach : plus de fiches dans app_config', (SELECT count(*) FROM public.app_config WHERE key = 'fiches_personnes'), 0);
SELECT pg_temp.attendre('Coach : lit les réglages', (SELECT count(*) FROM public.app_config WHERE key = 'params'), 1);
WITH m AS (UPDATE public.app_config SET value = '{"x":1}' WHERE key = 'params' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas les réglages', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : ne voit pas qui a lu les communications', pg_temp.refuse('SELECT public.lectures_communications()'), 1);
SELECT pg_temp.attendre('Coach : ne met pas une communication à la une', pg_temp.refuse('SELECT public.mettre_a_la_une(' || :annonce || ', current_date)'), 1);
SELECT pg_temp.attendre('Coach : aucun accès direct aux messages', (SELECT count(*) FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'messages' AND grantee = 'authenticated'), 0);

-- ── Franchisé : aucune table, mais son espace par la fonction
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : aucune visite en direct', (SELECT count(*) FROM public.visits), 0);
SELECT pg_temp.attendre('Franchisé : aucun chiffre en direct', (SELECT count(*) FROM public.store_finance), 0);
SELECT pg_temp.attendre('Franchisé : aucun réglage en direct', (SELECT count(*) FROM public.app_config), 0);
SELECT pg_temp.attendre('Franchisé : aucune photo d''un autre magasin', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'photos'), 0);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux comptes franchisés', (SELECT count(*) FROM public.acces_franchises), 0);
SELECT pg_temp.attendre('Franchisé : aucun accès direct au périmètre', (SELECT count(*) FROM public.perimetre_equipe), 0);
SELECT pg_temp.attendre('Franchisé : aucun accès direct au suivi', (SELECT count(*) FROM public.suivi_magasins), 0);
SELECT pg_temp.attendre('Franchisé : aucune fiche des personnes', (SELECT count(*) FROM public.fiches_personnes), 0);
SELECT pg_temp.attendre('Franchisé : aucun accès au journal des migrations', (SELECT count(*) FROM public.journal_migrations), 0);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux lectures', (SELECT count(*) FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'communications_lectures' AND grantee = 'authenticated'), 0);
SELECT pg_temp.attendre('Franchisé : ne met pas une communication à la une', pg_temp.refuse('SELECT public.mettre_a_la_une(' || :annonce || ', current_date)'), 1);
SELECT pg_temp.attendre('Franchisé : ne voit pas qui a lu les communications', pg_temp.refuse('SELECT public.lectures_communications()'), 1);
SELECT public.lire_communications(ARRAY[:annonce]::bigint[]);
SELECT pg_temp.attendre('Franchisé : ses visites par espace_franchise()', (SELECT jsonb_array_length(public.espace_franchise()->'visits')), 1);

-- ── Directeur : voit la lecture du franchisé, met à la une
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.mettre_a_la_une(:annonce, current_date + 7);
SELECT pg_temp.attendre('Directeur : la communication est à la une', (SELECT jsonb_array_length(public.a_la_une())), 1);
SELECT pg_temp.attendre('Directeur : la communication est lue par le franchisé',
  (SELECT jsonb_array_length(e->'lus') FROM jsonb_array_elements(public.lectures_communications()) e LIMIT 1), 1);

-- ── Compte sans rôle : rien
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
SELECT pg_temp.attendre('Sans rôle : aucune visite', (SELECT count(*) FROM public.visits), 0);
SELECT pg_temp.attendre('Sans rôle : aucun réglage', (SELECT count(*) FROM public.app_config), 0);
SELECT pg_temp.attendre('Sans rôle : aucune fiche des personnes', (SELECT count(*) FROM public.fiches_personnes), 0);

RESET ROLE;
SELECT pg_temp.attendre('Aucune règle « tout compte connecté »', (SELECT count(*) FROM pg_policies
  WHERE schemaname IN ('public', 'storage') AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')), 0);
SELECT pg_temp.attendre('Journal : 0001 à 0015 notées', (SELECT count(*) FROM public.journal_migrations WHERE numero <= '0015'), 15);

-- Fiches encore rangées dans app_config (base pas encore passée en 0015) : reprises, la clé disparaît,
-- une fiche déjà dans la table n'est pas écrasée
INSERT INTO public.app_config (key, value) VALUES ('fiches_personnes', '{"coach:Lou NOUVEAU":{"prenom":"Lou"},"franchise:Paul LILLE":{"telephone":"autre"},"intrus":{}}');
\ir ../migrations/0015_fiches_personnes.sql
SELECT pg_temp.attendre('Reprise : fiche ajoutée depuis app_config', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'coach:Lou NOUVEAU' AND fiche->>'prenom' = 'Lou'), 1);
SELECT pg_temp.attendre('Reprise : fiche existante conservée', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'franchise:Paul LILLE' AND fiche->>'telephone' = '0600000000'), 1);
SELECT pg_temp.attendre('Reprise : clé inconnue ignorée', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'intrus'), 0);
SELECT pg_temp.attendre('Reprise : clé retirée d''app_config', (SELECT count(*) FROM public.app_config WHERE key = 'fiches_personnes'), 0);
