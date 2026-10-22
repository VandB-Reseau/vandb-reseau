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
INSERT INTO public.suivi_magasins (store_name, cle, valeur) VALUES ('Lille', 'actions',
  '[{"id":"l_a","action":"Refaire la vitrine"},{"id":"l_e","action":"Préparer le point marge","fil":"equipe","pieces":[{"chemin":"00000000-0000-0000-0000-00000000000c/marge.pdf"}]}]')
ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur;
INSERT INTO public.communications (titre, auteur_nom, auteur_role) VALUES ('Annonce réseau', 'Directeur', 'directeur') RETURNING id AS annonce \gset
CREATE OR REPLACE FUNCTION pg_temp.refuse(appel text) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE appel; RETURN 0;
EXCEPTION WHEN others THEN RETURN 1;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.refuse(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION pg_temp.attendre(libelle text, obtenu bigint, attendu bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF obtenu IS DISTINCT FROM attendu THEN RAISE EXCEPTION 'ÉCHEC : % (obtenu %, attendu %)', libelle, obtenu, attendu; END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.attendre(text, bigint, bigint) TO authenticated, service_role;

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
SELECT pg_temp.attendre('Coach : écrit au franchisé', pg_temp.refuse('SELECT public.envoyer_a(''franchise:Franchisé Test'', ''Bonjour'', ''{}'')'), 0);
SELECT pg_temp.attendre('Coach : aucun accès direct aux appareils', pg_temp.refuse('SELECT count(*) FROM public.abonnements_push'), 1);
SELECT pg_temp.attendre('Coach : lit les réglages', (SELECT count(*) FROM public.app_config WHERE key = 'params'), 1);
WITH m AS (UPDATE public.app_config SET value = '{"x":1}' WHERE key = 'params' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas les réglages', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : ne voit pas qui a lu les communications', pg_temp.refuse('SELECT public.lectures_communications()'), 1);
SELECT pg_temp.attendre('Coach : ne met pas une communication à la une', pg_temp.refuse('SELECT public.mettre_a_la_une(' || :annonce || ', current_date)'), 1);
SELECT pg_temp.attendre('Coach : lit le fichier d''une tâche de l''équipe seule',
  (SELECT count(*) FROM (SELECT public.piece_visible('00000000-0000-0000-0000-00000000000c/marge.pdf') AS v) x WHERE v), 1);
INSERT INTO public.preferences (valeur) VALUES ('{"suivis":{"favoris":["Lille"]}}');
SELECT pg_temp.attendre('Coach : ses préférences', (SELECT count(*) FROM public.preferences), 1);
SELECT pg_temp.attendre('Coach : pas de préférences au nom d''un autre', pg_temp.refuse('INSERT INTO public.preferences (user_id) VALUES (''00000000-0000-0000-0000-00000000000d'')'), 1);
SELECT pg_temp.attendre('Coach : repères du réseau par reperes_equipe()', pg_temp.refuse('SELECT public.reperes_equipe(''{Lille}'')'), 0);
SELECT pg_temp.attendre('Coach : pas d''appel direct à reperes_reseau()', pg_temp.refuse('SELECT public.reperes_reseau(''{Nice}'')'), 1);
SELECT pg_temp.attendre('Coach : aucun accès direct aux messages', (SELECT count(*) FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'messages' AND grantee = 'authenticated'), 0);

-- ── Franchisé : aucune table, mais son espace par la fonction
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT public.abonner_appareil('https://push.exemple.test/franchise', 'cle', 'secret');
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux appareils', pg_temp.refuse('SELECT count(*) FROM public.abonnements_push'), 1);
SELECT pg_temp.attendre('Franchisé : aucune clé d''envoi', pg_temp.refuse('SELECT count(*) FROM public.cles_push'), 1);
SELECT pg_temp.attendre('Franchisé : ne liste pas les notifications à envoyer', pg_temp.refuse('SELECT public.notifications_a_envoyer(''message'', ''{1}'', auth.uid())'), 1);
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
SELECT pg_temp.attendre('Franchisé : aucune préférence en base', pg_temp.refuse('INSERT INTO public.preferences (valeur) VALUES (''{}'')'), 1);
SELECT pg_temp.attendre('Franchisé : ne lit pas les préférences', (SELECT count(*) FROM public.preferences), 0);
SELECT pg_temp.attendre('Franchisé : pas d''appel direct à reperes_reseau()', pg_temp.refuse('SELECT public.reperes_reseau(''{Nice}'')'), 1);
SELECT pg_temp.attendre('Franchisé : pas de repères de l''équipe', pg_temp.refuse('SELECT public.reperes_equipe(''{Nice}'')'), 1);
SELECT pg_temp.attendre('Franchisé : ses visites par espace_franchise()', (SELECT jsonb_array_length(public.espace_franchise()->'visits')), 1);
SELECT pg_temp.attendre('Franchisé : ses tâches, sans celles de l''équipe seule', (SELECT jsonb_array_length(e->'value'->'Lille')
  FROM jsonb_array_elements(public.espace_franchise()->'app_config') e WHERE e->>'key' = 'actions'), 1);
SELECT pg_temp.attendre('Franchisé : ne coche pas une tâche de l''équipe seule', pg_temp.refuse('SELECT public.marquer_action_franchise(''Lille'', true, ''l_e'')'), 1);
SELECT pg_temp.attendre('Franchisé : coche une tâche partagée', pg_temp.refuse('SELECT public.marquer_action_franchise(''Lille'', true, ''l_a'')'), 0);
SELECT pg_temp.attendre('Franchisé : ne lit pas le fichier d''une tâche de l''équipe seule',
  (SELECT count(*) FROM (SELECT public.piece_visible('00000000-0000-0000-0000-00000000000c/marge.pdf') AS v) x WHERE v), 0);

-- ── Directeur : voit la lecture du franchisé, met à la une
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.mettre_a_la_une(:annonce, current_date + 7);
SELECT pg_temp.attendre('Directeur : ne lit pas les préférences du Coach', (SELECT count(*) FROM public.preferences), 0);
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
SELECT pg_temp.attendre('Journal : 0001 à 0016 notées', (SELECT count(*) FROM public.journal_migrations WHERE numero <= '0016'), 16);

-- Notifications sur le téléphone : la fonction d'envoi (service_role) trouve l'appareil du franchisé
SELECT pg_temp.attendre('Appareil du franchisé enregistré', (SELECT count(*) FROM public.abonnements_push WHERE user_id = '00000000-0000-0000-0000-00000000000f'), 1);
INSERT INTO public.visits (store, visit_date, type) VALUES ('Lille', current_date, 'terrain') RETURNING id AS visite \gset
INSERT INTO public.visits (store, visit_date, type) VALUES ('Lille', current_date + 3, 'terrain') RETURNING id AS prevue \gset
SET ROLE service_role;
SELECT pg_temp.attendre('Message du Coach : une notification pour le franchisé',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('message', (SELECT array_agg(id) FROM public.messages WHERE destinataire = 'franchise:Franchisé Test'), '00000000-0000-0000-0000-00000000000c'))), 1);
SELECT pg_temp.attendre('Message : rien si l''auteur annoncé n''est pas le bon',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('message', (SELECT array_agg(id) FROM public.messages WHERE destinataire = 'franchise:Franchisé Test'), '00000000-0000-0000-0000-00000000000d'))), 0);
SELECT pg_temp.attendre('Compte rendu : une notification pour le franchisé du magasin',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('visite', ARRAY[:visite]::bigint[], '00000000-0000-0000-0000-00000000000c'))), 1);
SELECT pg_temp.attendre('Visite seulement planifiée : rien',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('visite', ARRAY[:prevue]::bigint[], '00000000-0000-0000-0000-00000000000c'))), 0);
SELECT pg_temp.attendre('Compte rendu : rien si l''auteur est un franchisé',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('visite', ARRAY[:visite]::bigint[], '00000000-0000-0000-0000-00000000000f'))), 0);
RESET ROLE;

-- Fiches encore rangées dans app_config (base pas encore passée en 0015) : reprises, la clé disparaît,
-- une fiche déjà dans la table n'est pas écrasée
INSERT INTO public.app_config (key, value) VALUES ('fiches_personnes', '{"coach:Lou NOUVEAU":{"prenom":"Lou"},"franchise:Paul LILLE":{"telephone":"autre"},"intrus":{}}');
\ir ../migrations/0015_fiches_personnes.sql
SELECT pg_temp.attendre('Reprise : fiche ajoutée depuis app_config', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'coach:Lou NOUVEAU' AND fiche->>'prenom' = 'Lou'), 1);
SELECT pg_temp.attendre('Reprise : fiche existante conservée', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'franchise:Paul LILLE' AND fiche->>'telephone' = '0600000000'), 1);
SELECT pg_temp.attendre('Reprise : clé inconnue ignorée', (SELECT count(*) FROM public.fiches_personnes WHERE cle = 'intrus'), 0);
SELECT pg_temp.attendre('Reprise : clé retirée d''app_config', (SELECT count(*) FROM public.app_config WHERE key = 'fiches_personnes'), 0);

-- Visite prévue (0017) : à la reprise, une visite à venir sans compte rendu est planifiée ; une visite passée reste faite
SELECT pg_temp.attendre('Journal : 0017 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0017'), 1);
UPDATE public.visits SET prevue = false;
INSERT INTO public.visits (store, visit_date, type, notes) VALUES ('Nice', current_date + 5, 'terrain', 'Compte rendu déjà écrit') RETURNING id AS ecrite \gset
\ir ../migrations/0017_visites_prevues.sql
SELECT pg_temp.attendre('Reprise : visite à venir sans compte rendu = prévue', (SELECT count(*) FROM public.visits WHERE id = :prevue AND prevue), 1);
SELECT pg_temp.attendre('Reprise : visite passée = faite', (SELECT count(*) FROM public.visits WHERE visit_date <= current_date AND prevue), 0);
SELECT pg_temp.attendre('Reprise : visite à venir avec compte rendu = faite', (SELECT count(*) FROM public.visits WHERE id = :ecrite AND prevue), 0);

-- Échanges en groupe (0018) : deux fils par magasin, groupes libres (rejouée ici : la suite a fini dans l'ordre inverse)
\ir ../migrations/0018_echanges_groupes.sql
SELECT pg_temp.attendre('Journal : 0018 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0018'), 1);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : écrit dans le groupe de son magasin', pg_temp.refuse('SELECT public.envoyer_fil(''magasin:Lille'', ''Bonjour à tous'')'), 0);
SELECT pg_temp.attendre('Coach : écrit dans « Équipe seule » de son magasin', pg_temp.refuse('SELECT public.envoyer_fil(''equipe:Lille'', ''Entre nous'', ''{franchise:Franchisé Test}'')'), 0);
SELECT pg_temp.attendre('Coach : pas dans le groupe d''un autre magasin', pg_temp.refuse('SELECT public.envoyer_fil(''magasin:Nice'', ''Intrus'')'), 1);
SELECT pg_temp.attendre('Coach : ne crée pas de groupe libre', pg_temp.refuse('SELECT public.creer_groupe(''Coachs'', ''{}'')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.creer_groupe('Équipe Nord', ARRAY['coach:Coach Nord']) AS groupe \gset
SELECT pg_temp.attendre('Directeur : écrit dans son groupe', pg_temp.refuse('SELECT public.envoyer_fil(''groupe:' || :groupe || ''', ''Réunion lundi'')'), 0);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : lit le groupe dont il est membre',
  (SELECT count(*) FROM jsonb_array_elements(public.messagerie()->'messages') e WHERE (e->>'groupe')::bigint = :groupe), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : n''écrit pas dans « Équipe seule »', pg_temp.refuse('SELECT public.envoyer_fil(''equipe:Lille'', ''Coucou'')'), 1);
SELECT pg_temp.attendre('Franchisé : ne lit pas « Équipe seule »',
  (SELECT count(*) FROM jsonb_array_elements(public.messagerie()->'messages') e WHERE (e->>'equipe')::boolean), 0);
SELECT pg_temp.attendre('Franchisé : ne lit pas un groupe dont il n''est pas membre',
  (SELECT count(*) FROM jsonb_array_elements(public.messagerie()->'messages') e WHERE e->>'groupe' IS NOT NULL), 0);
SELECT pg_temp.attendre('Franchisé : lit le groupe de son magasin',
  (SELECT count(*) FROM jsonb_array_elements(public.messagerie()->'messages') e WHERE e->>'store' = 'Lille' AND NOT (e->>'equipe')::boolean), 1);
SELECT pg_temp.attendre('Franchisé : n''écrit pas dans un groupe libre', pg_temp.refuse('SELECT public.envoyer_fil(''groupe:' || :groupe || ''', ''Intrus'')'), 1);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux groupes', pg_temp.refuse('SELECT count(*) FROM public.groupes'), 1);
RESET ROLE;
SELECT pg_temp.attendre('« Équipe seule » : le franchisé cité est retiré', (SELECT count(*) FROM public.messages WHERE equipe AND 'franchise:Franchisé Test' = ANY(mentions)), 0);
SET ROLE service_role;
SELECT pg_temp.attendre('Groupe du magasin : notification au franchisé',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('message', (SELECT array_agg(id) FROM public.messages WHERE store = 'Lille' AND NOT equipe AND texte = 'Bonjour à tous'), '00000000-0000-0000-0000-00000000000c'))), 1);
SELECT pg_temp.attendre('« Équipe seule » : rien pour le franchisé',
  (SELECT jsonb_array_length(public.notifications_a_envoyer('message', (SELECT array_agg(id) FROM public.messages WHERE equipe), '00000000-0000-0000-0000-00000000000c'))), 0);
RESET ROLE;
-- Rejouée après 0018, l'ancienne messagerie (0006) ne montre pas les messages d'un groupe libre au Directeur
\ir ../migrations/0006_messagerie.sql
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('0006 rejouée : le message de groupe reste caché',
  (SELECT count(*) FROM jsonb_array_elements(public.messagerie()->'messages') e WHERE e->>'texte' = 'Réunion lundi'), 0);
RESET ROLE;
\ir ../migrations/0018_echanges_groupes.sql

-- J'aime et commentaires sur les comptes rendus (0022) : chacun sur les visites qu'il voit
SELECT pg_temp.attendre('Journal : 0022 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0022'), 1);
SELECT id AS nice FROM public.visits WHERE store = 'Nice' ORDER BY id LIMIT 1 \gset
INSERT INTO public.visits (store, visit_date, type) VALUES ('Lille', current_date, 'appel') RETURNING id AS appel \gset
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : aime le compte rendu de son magasin', pg_temp.refuse('SELECT public.basculer_pouce_visite(' || :visite || ')'), 0);
SELECT pg_temp.attendre('Franchisé : commente le compte rendu de son magasin', pg_temp.refuse('SELECT public.commenter_visite(' || :visite || ', ''Merci pour la visite'')'), 0);
SELECT pg_temp.attendre('Franchisé : pas de réaction sur un autre magasin', pg_temp.refuse('SELECT public.commenter_visite(' || :nice || ', ''Intrus'')'), 1);
SELECT pg_temp.attendre('Franchisé : pas de réaction sur un appel', pg_temp.refuse('SELECT public.basculer_pouce_visite(' || :appel || ')'), 1);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux commentaires', pg_temp.refuse('SELECT count(*) FROM public.visites_commentaires'), 1);
RESET ROLE;
SELECT id AS commentaire FROM public.visites_commentaires WHERE visite = :visite \gset
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : lit le commentaire du franchisé',
  (SELECT jsonb_array_length(public.reactions_visites()->'commentaires'->(:visite)::text)), 1);
SELECT pg_temp.attendre('Coach : pas de réaction sur un magasin d''un autre Coach', pg_temp.refuse('SELECT public.basculer_pouce_visite(' || :nice || ')'), 1);
SELECT public.supprimer_commentaire_visite(:commentaire);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.commenter_visite(:nice, 'Bien vu');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : ne lit pas les réactions d''un autre magasin',
  (SELECT count(*) FROM jsonb_object_keys(public.reactions_visites()->'commentaires') k WHERE k = (:nice)::text), 0);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
SELECT pg_temp.attendre('Sans rôle : aucune réaction', pg_temp.refuse('SELECT public.reactions_visites()'), 1);
RESET ROLE;
SELECT pg_temp.attendre('Commentaire du franchisé toujours là', (SELECT count(*) FROM public.visites_commentaires WHERE visite = :visite), 1);
