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
INSERT INTO public.app_config (key, value) VALUES ('bonnes_pratiques', '[{"id":"bp_t","titre":"Dégustation","magasin":"Lille"}]') ON CONFLICT DO NOTHING;
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
SELECT pg_temp.attendre('Coach : ne voit pas qui a vu les bonnes pratiques', pg_temp.refuse('SELECT public.lectures_pratiques()'), 1);
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
SELECT pg_temp.attendre('Franchisé : ne voit pas qui a vu les bonnes pratiques', pg_temp.refuse('SELECT public.lectures_pratiques()'), 1);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux vues des bonnes pratiques', (SELECT count(*) FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'pratiques_lectures' AND grantee = 'authenticated'), 0);
SELECT pg_temp.attendre('Franchisé : pas d''appel direct à pratiques_existantes()', pg_temp.refuse('SELECT public.pratiques_existantes()'), 1);
SELECT public.lire_pratiques(ARRAY['bp_t', 'inconnue']);
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
SELECT pg_temp.attendre('Directeur : la bonne pratique est vue par le franchisé',
  (SELECT jsonb_array_length(e->'lus') FROM jsonb_array_elements(public.lectures_pratiques()) e WHERE e->>'id' = 'bp_t'), 1);

-- ── Compte sans rôle : rien
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
SELECT pg_temp.attendre('Sans rôle : aucune visite', (SELECT count(*) FROM public.visits), 0);
SELECT pg_temp.attendre('Sans rôle : aucun réglage', (SELECT count(*) FROM public.app_config), 0);
SELECT pg_temp.attendre('Sans rôle : aucune fiche des personnes', (SELECT count(*) FROM public.fiches_personnes), 0);

RESET ROLE;
SELECT pg_temp.attendre('Une pratique inconnue n''est pas notée vue', (SELECT count(*) FROM public.pratiques_lectures WHERE pratique = 'inconnue'), 0);
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

-- Notifications d'une tâche confiée et d'une communication à la une (0024) : fonction d'envoi seule
SELECT pg_temp.attendre('Journal : 0024 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0024'), 1);
UPDATE public.suivi_magasins SET valeur = valeur || jsonb_build_array(
  jsonb_build_object('id', 'l_n', 'action', 'Commander les coffrets', 'porteur', 'Franchisé Test', 'creeLe', current_date::text),
  jsonb_build_object('id', 'l_q', 'action', 'Point marge', 'fil', 'equipe', 'creeLe', current_date::text),
  jsonb_build_object('id', 'l_v', 'action', 'Ancienne', 'creeLe', (current_date - 5)::text))
WHERE store_name = 'Lille' AND cle = 'actions';
UPDATE public.communications SET a_la_une = current_date + 3 WHERE id = :annonce;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne lit pas les notifications d''une tâche', pg_temp.refuse('SELECT public.notifications_tache(''Lille'', ''l_n'', ''{franchise:Franchisé Test}'', auth.uid())'), 1);
SELECT pg_temp.attendre('Coach : ne lit pas les notifications à la une', pg_temp.refuse('SELECT public.notifications_une(ARRAY[' || :annonce || ']::bigint[], auth.uid())'), 1);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.attendre('Tâche confiée au franchisé : une notification',
  (SELECT jsonb_array_length(public.notifications_tache('Lille', 'l_n', '{franchise:Franchisé Test}', '00000000-0000-0000-0000-00000000000c'))), 1);
SELECT pg_temp.attendre('Tâche « Équipe seule » : rien pour le franchisé',
  (SELECT jsonb_array_length(public.notifications_tache('Lille', 'l_q', '{franchise:Franchisé Test}', '00000000-0000-0000-0000-00000000000c'))), 0);
SELECT pg_temp.attendre('Tâche ancienne : rien',
  (SELECT jsonb_array_length(public.notifications_tache('Lille', 'l_v', '{franchise:Franchisé Test}', '00000000-0000-0000-0000-00000000000c'))), 0);
SELECT pg_temp.attendre('Tâche : rien si l''auteur ne voit pas le magasin',
  (SELECT jsonb_array_length(public.notifications_tache('Lille', 'l_n', '{franchise:Franchisé Test}', '00000000-0000-0000-0000-000000000000'))), 0);
SELECT pg_temp.attendre('Tâche inconnue : rien',
  (SELECT jsonb_array_length(public.notifications_tache('Lille', 'inconnue', '{franchise:Franchisé Test}', '00000000-0000-0000-0000-00000000000c'))), 0);
SELECT pg_temp.attendre('À la une par le Directeur : une notification pour le franchisé',
  (SELECT jsonb_array_length(public.notifications_une(ARRAY[:annonce]::bigint[], '00000000-0000-0000-0000-00000000000d'))), 1);
SELECT pg_temp.attendre('À la une : rien si l''auteur annoncé est un Coach',
  (SELECT jsonb_array_length(public.notifications_une(ARRAY[:annonce]::bigint[], '00000000-0000-0000-0000-00000000000c'))), 0);
RESET ROLE;
UPDATE public.communications SET a_la_une = NULL WHERE id = :annonce;
SET ROLE service_role;
SELECT pg_temp.attendre('Plus à la une : rien',
  (SELECT jsonb_array_length(public.notifications_une(ARRAY[:annonce]::bigint[], '00000000-0000-0000-0000-00000000000d'))), 0);
RESET ROLE;

-- Réunions et formations (0025) : invités posés par le Directeur ou un RR, réponse du franchisé, pointage par l'équipe
SELECT pg_temp.attendre('Journal : 0025 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0025'), 1);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : n''invite pas de magasins', pg_temp.refuse('INSERT INTO public.events (title, start_date, invites) VALUES (''Intrus'', current_date, ''{Lille}'')'), 1);
SELECT pg_temp.attendre('Coach : ajoute un événement sans invités', pg_temp.refuse('INSERT INTO public.events (title, start_date) VALUES (''Point Coachs'', current_date)'), 0);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
INSERT INTO public.events (title, start_date, invites) VALUES ('Réunion régionale', current_date + 3, '{Lille,Nice}') RETURNING id AS reunion \gset
INSERT INTO public.events (title, start_date, invites) VALUES ('Formation vente', current_date - 2, '{Lille,Nice}') RETURNING id AS formation \gset
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne change pas les invités', pg_temp.refuse('UPDATE public.events SET invites = ''{Lille}'' WHERE id = ' || :reunion), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : voit les deux réunions de son magasin', (SELECT jsonb_array_length(public.reunions_franchise())), 2);
SELECT pg_temp.attendre('Franchisé : ne voit que son magasin parmi les invités',
  (SELECT count(*) FROM jsonb_array_elements(public.reunions_franchise()) e, jsonb_array_elements_text(e->'magasins') m WHERE m = 'Nice'), 0);
SELECT pg_temp.attendre('Franchisé : répond à une réunion à venir', pg_temp.refuse('SELECT public.repondre_reunion(' || :reunion || ', ''present'')'), 0);
SELECT pg_temp.attendre('Franchisé : ne répond plus après la date', pg_temp.refuse('SELECT public.repondre_reunion(' || :formation || ', ''absent'')'), 1);
SELECT pg_temp.attendre('Franchisé : ne pointe pas', pg_temp.refuse('SELECT public.pointer_presence(' || :formation || ', ''Lille'', true)'), 1);
SELECT pg_temp.attendre('Franchisé : ne lit pas les présences de l''équipe', pg_temp.refuse('SELECT public.presences_reunions()'), 1);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux présences', pg_temp.refuse('SELECT count(*) FROM public.reunions_presences'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : pointe son magasin après la date', pg_temp.refuse('SELECT public.pointer_presence(' || :formation || ', ''Lille'', true)'), 0);
SELECT pg_temp.attendre('Coach : ne pointe pas un autre magasin', pg_temp.refuse('SELECT public.pointer_presence(' || :formation || ', ''Nice'', true)'), 1);
SELECT pg_temp.attendre('Coach : ne pointe pas avant la date', pg_temp.refuse('SELECT public.pointer_presence(' || :reunion || ', ''Lille'', true)'), 1);
SELECT pg_temp.attendre('Coach : lit réponse et présence de son magasin', (SELECT jsonb_array_length(public.presences_reunions())), 2);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.pointer_presence(:formation, 'Nice', false);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne lit pas les présences d''un autre magasin',
  (SELECT count(*) FROM jsonb_array_elements(public.presences_reunions()) e WHERE e->>'magasin' = 'Nice'), 0);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : voit qu''il a été pointé présent',
  (SELECT count(*) FROM jsonb_array_elements(public.reunions_franchise()) e WHERE (e->>'id')::bigint = :formation AND (e->>'present')::boolean), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
SELECT pg_temp.attendre('Sans rôle : aucune réunion', pg_temp.refuse('SELECT public.reunions_franchise()'), 1);
RESET ROLE;

-- Questions éclair (0026) : posées par le Directeur ou un RR (ses magasins), une réponse par franchisé, anonymat en base
SELECT pg_temp.attendre('Journal : 0026 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0026'), 1);
INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES ('00000000-0000-0000-0000-00000000000e', 'rr@exemple.fr', '{"role":"rr","rr":"rr1"}') ON CONFLICT (id) DO NOTHING;
UPDATE public.perimetre_equipe SET rrs = '{rr1}' WHERE store_name = 'Lille';
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne pose pas de question', pg_temp.refuse('SELECT public.publier_question(''Satisfait ?'', ''oui_non'', ''{}'', false, NULL, current_date + 7)'), 1);
SELECT pg_temp.attendre('Coach : ne lit pas les résultats', pg_temp.refuse('SELECT public.resultats_questions()'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.publier_question('Êtes-vous satisfait de l''accompagnement ?', 'oui_non', '{}', true, NULL, current_date + 7) AS q_anonyme \gset
SELECT public.publier_question('Note la formation', 'note', '{}', false, '{Nice}', current_date + 7) AS q_nice \gset
SELECT pg_temp.attendre('Directeur : pas de question déjà close', pg_temp.refuse('SELECT public.publier_question(''Hier'', ''oui_non'', ''{}'', false, NULL, current_date - 1)'), 1);
SELECT pg_temp.attendre('Directeur : un choix demande deux options', pg_temp.refuse('SELECT public.publier_question(''Date ?'', ''choix'', ''{Lundi}'', false, NULL, current_date + 3)'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
SELECT public.publier_question('Quelle date pour la réunion ?', 'choix', '{Lundi,Mardi}', false, NULL, current_date + 3) AS q_rr \gset
SELECT pg_temp.attendre('RR : sa question vise ses seuls magasins', (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e WHERE (e->>'id')::bigint = :q_rr AND e->'magasins' = '["Lille"]'::jsonb), 1);
SELECT pg_temp.attendre('RR : n''interroge pas un magasin d''une autre région', pg_temp.refuse('SELECT public.publier_question(''Intrus'', ''oui_non'', ''{}'', false, ''{Nice}'', current_date + 3)'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : voit les questions de ses magasins', (SELECT jsonb_array_length(public.questions_franchise())), 2);
SELECT pg_temp.attendre('Franchisé : répond', pg_temp.refuse('SELECT public.repondre_question(' || :q_anonyme || ', ''oui'')'), 0);
SELECT pg_temp.attendre('Franchisé : une seule réponse', pg_temp.refuse('SELECT public.repondre_question(' || :q_anonyme || ', ''non'')'), 1);
SELECT pg_temp.attendre('Franchisé : réponse hors des choix refusée', pg_temp.refuse('SELECT public.repondre_question(' || :q_rr || ', ''Jeudi'')'), 1);
SELECT pg_temp.attendre('Franchisé : répond à un choix', pg_temp.refuse('SELECT public.repondre_question(' || :q_rr || ', ''Mardi'')'), 0);
SELECT pg_temp.attendre('Franchisé : pas de réponse à une question d''un autre magasin', pg_temp.refuse('SELECT public.repondre_question(' || :q_nice || ', ''5'')'), 1);
SELECT pg_temp.attendre('Franchisé : sait qu''il a répondu', (SELECT count(*) FROM jsonb_array_elements(public.questions_franchise()) e WHERE (e->>'repondu')::boolean), 2);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux réponses', pg_temp.refuse('SELECT count(*) FROM public.questions_reponses'), 1);
SELECT pg_temp.attendre('Franchisé : ne lit pas les résultats', pg_temp.refuse('SELECT public.resultats_questions()'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT pg_temp.attendre('Directeur : la réponse anonyme est comptée sans nom',
  (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e, jsonb_array_elements(e->'reponses') r
   WHERE (e->>'id')::bigint = :q_anonyme AND r->>'valeur' = 'oui' AND r->'franchise' = 'null'::jsonb AND r->'magasins' = '[]'::jsonb), 1);
SELECT pg_temp.attendre('Directeur : la réponse nominative porte le nom',
  (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e, jsonb_array_elements(e->'reponses') r
   WHERE (e->>'id')::bigint = :q_rr AND r->>'franchise' = 'Franchisé Test'), 1);
SELECT pg_temp.attendre('Directeur : le franchisé qui a répondu n''est pas à relancer',
  (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e WHERE (e->>'id')::bigint = :q_anonyme AND e->'sans_reponse' ? 'Franchisé Test'), 0);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
SELECT pg_temp.attendre('RR : lit la réponse de sa région', (SELECT jsonb_array_length(e->'reponses') FROM jsonb_array_elements(public.resultats_questions()) e WHERE (e->>'id')::bigint = :q_anonyme), 1);
SELECT pg_temp.attendre('RR : ne voit pas la question d''un autre magasin', (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e WHERE (e->>'id')::bigint = :q_nice), 0);
SELECT pg_temp.attendre('RR : ne supprime pas la question du Directeur', (SELECT count(*) FROM (SELECT public.supprimer_question(:q_anonyme)) x), 1);
RESET ROLE;
SELECT pg_temp.attendre('Question du Directeur toujours là', (SELECT count(*) FROM public.questions_eclair WHERE id = :q_anonyme), 1);
SELECT pg_temp.attendre('Anonymat en base : ni nom ni magasin', (SELECT count(*) FROM public.questions_reponses WHERE question = :q_anonyme AND (franchise IS NOT NULL OR magasins <> '{}')), 0);

-- Sondages (0029) : 1 à 5 questions, pour les franchisés, l'équipe ou les deux ; l'ordre inverse a remis 0026 en dernier
\ir ../migrations/0029_sondages.sql
SELECT pg_temp.attendre('Journal : 0029 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0029'), 1);
SELECT pg_temp.attendre('Questions éclair d''avant : un sondage d''une question', (SELECT count(*) FROM public.questions_eclair WHERE jsonb_array_length(questions) <> 1), 0);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.publier_sondage('Point formation', '[{"titre":"Utile ?","genre":"oui_non"},{"titre":"Note","genre":"note"},{"titre":"Format","genre":"choix","choix":["Salle","Visio"]}]',
  'equipe', false, '{Lille}', current_date + 7) AS s_equipe \gset
SELECT public.publier_sondage('Ressenti', '[{"titre":"Charge de travail","genre":"note"}]', 'equipe', true, NULL, current_date + 7) AS s_anonyme \gset
SELECT pg_temp.attendre('Directeur : six questions refusées', pg_temp.refuse('SELECT public.publier_sondage(''Trop'', ''[{"titre":"1","genre":"note"},{"titre":"2","genre":"note"},{"titre":"3","genre":"note"},{"titre":"4","genre":"note"},{"titre":"5","genre":"note"},{"titre":"6","genre":"note"}]'', ''tous'', false, NULL, current_date + 3)'), 1);
SELECT pg_temp.attendre('Directeur : destinataires inconnus refusés', pg_temp.refuse('SELECT public.publier_sondage(''X'', ''[{"titre":"1","genre":"note"}]'', ''partout'', false, NULL, current_date + 3)'), 1);
SELECT pg_temp.attendre('Directeur : ne répond pas à son propre sondage', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_equipe || ', ''{oui,4,Salle}'')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : voit les sondages de l''équipe', (SELECT count(*) FROM jsonb_array_elements(public.questions_equipe()) e WHERE (e->>'id')::bigint IN (:s_equipe, :s_anonyme)), 2);
SELECT pg_temp.attendre('Coach : ne voit pas les questions des franchisés', (SELECT count(*) FROM jsonb_array_elements(public.questions_equipe()) e WHERE (e->>'id')::bigint = :q_anonyme), 0);
SELECT pg_temp.attendre('Coach : une réponse par question', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_equipe || ', ''{oui,4}'')'), 1);
SELECT pg_temp.attendre('Coach : réponse hors des choix refusée', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_equipe || ', ''{oui,4,Bureau}'')'), 1);
SELECT pg_temp.attendre('Coach : répond au sondage', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_equipe || ', ''{oui,4,Salle}'')'), 0);
SELECT pg_temp.attendre('Coach : une seule fois', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_equipe || ', ''{non,2,Visio}'')'), 1);
SELECT pg_temp.attendre('Coach : répond au sondage anonyme', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_anonyme || ', ''{3}'')'), 0);
SELECT pg_temp.attendre('Coach : ne pose pas de sondage', pg_temp.refuse('SELECT public.publier_sondage(''X'', ''[{"titre":"1","genre":"note"}]'', ''tous'', false, NULL, current_date + 3)'), 1);
SELECT pg_temp.attendre('Coach : ne lit pas les résultats', pg_temp.refuse('SELECT public.resultats_questions()'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
SELECT pg_temp.attendre('RR : voit le sondage d''équipe du Directeur', (SELECT count(*) FROM jsonb_array_elements(public.questions_equipe()) e WHERE (e->>'id')::bigint = :s_equipe), 1);
SELECT public.publier_sondage('Vitrines', '[{"titre":"Vitrine refaite ?","genre":"oui_non"}]', 'tous', false, NULL, current_date + 7) AS s_rr \gset
SELECT pg_temp.attendre('RR : ne répond pas à son propre sondage', (SELECT count(*) FROM jsonb_array_elements(public.questions_equipe()) e WHERE (e->>'id')::bigint = :s_rr), 0);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : ne voit pas un sondage de l''équipe', (SELECT count(*) FROM jsonb_array_elements(public.questions_franchise()) e WHERE (e->>'id')::bigint IN (:s_equipe, :s_anonyme)), 0);
SELECT pg_temp.attendre('Franchisé : voit un sondage pour tous', (SELECT count(*) FROM jsonb_array_elements(public.questions_franchise()) e WHERE (e->>'id')::bigint = :s_rr), 1);
SELECT pg_temp.attendre('Franchisé : ne répond pas à un sondage de l''équipe', pg_temp.refuse('SELECT public.repondre_sondage(' || :s_equipe || ', ''{oui,4,Salle}'')'), 1);
SELECT pg_temp.attendre('Franchisé : ne lit pas les sondages de l''équipe', pg_temp.refuse('SELECT public.questions_equipe()'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : voit le sondage pour tous du RR', (SELECT count(*) FROM jsonb_array_elements(public.questions_equipe()) e WHERE (e->>'id')::bigint = :s_rr), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT pg_temp.attendre('Directeur : la réponse du Coach porte son nom et ses trois valeurs',
  (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e, jsonb_array_elements(e->'reponses') r
   WHERE (e->>'id')::bigint = :s_equipe AND r->>'franchise' = 'Coach Nord' AND r->>'role' = 'coach' AND r->'valeurs' = '["oui","4","Salle"]'::jsonb), 1);
SELECT pg_temp.attendre('Directeur : Coach et RR sont destinataires', (SELECT (e->>'concernes')::bigint FROM jsonb_array_elements(public.resultats_questions()) e WHERE (e->>'id')::bigint = :s_equipe), 2);
SELECT pg_temp.attendre('Directeur : le RR est à relancer, pas le Coach',
  (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e WHERE (e->>'id')::bigint = :s_equipe AND e->'sans_reponse' = '["rr1"]'::jsonb), 1);
SELECT pg_temp.attendre('Directeur : la réponse anonyme du Coach est sans nom',
  (SELECT count(*) FROM jsonb_array_elements(public.resultats_questions()) e, jsonb_array_elements(e->'reponses') r
   WHERE (e->>'id')::bigint = :s_anonyme AND r->'franchise' = 'null'::jsonb), 1);
RESET ROLE;
SELECT pg_temp.attendre('Sondages : fonctions internes fermées', (SELECT count(*) FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
    AND routine_name IN ('nom_rr', 'destinataire_sondage', 'question_valable', 'reponse_valable', 'sondages_pour_moi', 'destinataires_sondage')), 0);

-- Bonnes pratiques proposées par les franchisés (0027) : proposées par fonction, relues par l'équipe du magasin
SELECT pg_temp.attendre('Journal : 0027 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0027'), 1);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT public.proposer_pratique('Lille', 'Dégustation du samedi', 'Trois vins ouverts chaque samedi.') AS proposition \gset
SELECT pg_temp.attendre('Franchisé : ne propose pas pour un autre magasin', pg_temp.refuse('SELECT public.proposer_pratique(''Nice'', ''Intrus'', '''')'), 1);
SELECT pg_temp.attendre('Franchisé : suit sa proposition', (SELECT count(*) FROM jsonb_array_elements(public.mes_propositions()) e WHERE e->>'statut' = 'proposee'), 1);
SELECT pg_temp.attendre('Franchisé : ne relit pas', pg_temp.refuse('SELECT public.propositions_pratiques()'), 1);
SELECT pg_temp.attendre('Franchisé : ne publie pas lui-même', pg_temp.refuse('SELECT public.traiter_proposition(' || :proposition || ', ''publiee'', ''bp_x'')'), 1);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux propositions', pg_temp.refuse('SELECT count(*) FROM public.pratiques_proposees'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : voit la proposition de son magasin', (SELECT jsonb_array_length(public.propositions_pratiques())), 1);
SELECT pg_temp.attendre('Coach : publier demande la bonne pratique', pg_temp.refuse('SELECT public.traiter_proposition(' || :proposition || ', ''publiee'')'), 1);
SELECT pg_temp.attendre('Coach : la note publiée', pg_temp.refuse('SELECT public.traiter_proposition(' || :proposition || ', ''publiee'', ''bp_samedi'')'), 0);
SELECT pg_temp.attendre('Coach : déjà traitée', pg_temp.refuse('SELECT public.traiter_proposition(' || :proposition || ', ''refusee'')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : voit sa proposition publiée', (SELECT count(*) FROM jsonb_array_elements(public.mes_propositions()) e WHERE e->>'statut' = 'publiee' AND e->>'pratique' = 'bp_samedi'), 1);
RESET ROLE;
INSERT INTO public.pratiques_proposees (franchise, magasin, titre) VALUES ('Nina NICE', 'Nice', 'Vitrine') RETURNING id AS nice_prop \gset
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne voit pas la proposition d''un autre magasin', (SELECT jsonb_array_length(public.propositions_pratiques())), 0);
SELECT pg_temp.attendre('Coach : ne traite pas la proposition d''un autre magasin', pg_temp.refuse('SELECT public.traiter_proposition(' || :nice_prop || ', ''refusee'')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT pg_temp.attendre('Directeur : voit toutes les propositions', (SELECT jsonb_array_length(public.propositions_pratiques())), 1);
RESET ROLE;

-- Challenge du mois (0028) : classement calculé par la base ; l'équipe voit les chiffres de ses magasins seulement,
-- le franchisé son rang et le podium, sans chiffre
SELECT pg_temp.attendre('Journal : 0028 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0028'), 1);
SELECT (date_trunc('month', current_date) - interval '1 month')::date AS mois_ch \gset
INSERT INTO public.store_finance (store_name, month, ca_cave, pm_bar) VALUES
  ('Lille', :'mois_ch', 120, 10), ('Lille', (:'mois_ch'::date - interval '1 year')::date, 100, 10),
  ('Nice', :'mois_ch', 110, 10), ('Nice', (:'mois_ch'::date - interval '1 year')::date, 100, 10)
ON CONFLICT (store_name, month) DO UPDATE SET ca_cave = excluded.ca_cave, pm_bar = excluded.pm_bar;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne crée pas de challenge', pg_temp.refuse('SELECT public.creer_challenge(''CA'', ''ca'', ''' || :'mois_ch' || ''', ''{Lille,Nice}'', true)'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.creer_challenge('Challenge CA', 'ca', :'mois_ch', '{Lille,Nice}', true) AS ch \gset
SELECT public.creer_challenge('Challenge caché', 'pm_bar', :'mois_ch', '{Lille,Nice}', false) AS ch_cache \gset
SELECT pg_temp.attendre('Directeur : un challenge demande deux magasins', pg_temp.refuse('SELECT public.creer_challenge(''Seul'', ''ca'', ''' || :'mois_ch' || ''', ''{Lille}'', true)'), 1);
SELECT pg_temp.attendre('Directeur : Lille premier, avec sa progression',
  (SELECT count(*) FROM jsonb_array_elements(public.challenges_equipe()) e, jsonb_array_elements(e->'classement') k
   WHERE (e->>'id')::bigint = :ch AND k->>'magasin' = 'Lille' AND (k->>'rang')::int = 1 AND (k->>'valeur')::numeric = 20), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
SELECT pg_temp.attendre('RR : ne lance pas un challenge hors de ses magasins', pg_temp.refuse('SELECT public.creer_challenge(''Nice'', ''ca'', ''' || :'mois_ch' || ''', ''{Nice,Lille}'', true)'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : voit le rang de Nice sans son chiffre',
  (SELECT count(*) FROM jsonb_array_elements(public.challenges_equipe()) e, jsonb_array_elements(e->'classement') k
   WHERE (e->>'id')::bigint = :ch AND k->>'magasin' = 'Nice' AND (k->>'rang')::int = 2 AND k->'valeur' = 'null'::jsonb), 1);
SELECT pg_temp.attendre('Coach : voit le chiffre de son magasin',
  (SELECT count(*) FROM jsonb_array_elements(public.challenges_equipe()) e, jsonb_array_elements(e->'classement') k
   WHERE (e->>'id')::bigint = :ch AND k->>'magasin' = 'Lille' AND k->'valeur' <> 'null'::jsonb), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : voit son rang', (SELECT count(*) FROM jsonb_array_elements(public.challenges_franchise()) e, jsonb_array_elements(e->'mes_rangs') k
   WHERE (e->>'id')::bigint = :ch AND k->>'magasin' = 'Lille' AND (k->>'rang')::int = 1), 1);
SELECT pg_temp.attendre('Franchisé : aucun chiffre', (SELECT count(*) FROM jsonb_array_elements(public.challenges_franchise()) e WHERE e::text LIKE '%valeur%'), 0);
SELECT pg_temp.attendre('Franchisé : pas de challenge fermé aux franchisés', (SELECT count(*) FROM jsonb_array_elements(public.challenges_franchise()) e WHERE (e->>'id')::bigint = :ch_cache), 0);
SELECT pg_temp.attendre('Franchisé : ne lit pas le classement de l''équipe', pg_temp.refuse('SELECT public.challenges_equipe()'), 1);
SELECT pg_temp.attendre('Franchisé : n''appelle pas le calcul du classement', pg_temp.refuse('SELECT count(*) FROM public.classement_challenge(' || :ch || ')'), 1);
SELECT pg_temp.attendre('Franchisé : aucun accès direct aux challenges', pg_temp.refuse('SELECT count(*) FROM public.challenges'), 1);
RESET ROLE;

-- Animation du réseau (0030) : formation avec heure et contenu ; un nouveau contenu notifié une seule fois,
-- aux personnes concernées, jamais à son auteur, par la fonction d'envoi seule. L'ordre inverse a remis 0025 en dernier.
\ir ../migrations/0030_animation_reseau.sql
SELECT pg_temp.attendre('Journal : 0030 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0030'), 1);
INSERT INTO public.abonnements_push (endpoint, user_id, p256dh, auth) VALUES
  ('https://push.exemple.fr/coach', '00000000-0000-0000-0000-00000000000c', 'k', 'a'),
  ('https://push.exemple.fr/directeur', '00000000-0000-0000-0000-00000000000d', 'k', 'a'),
  ('https://push.exemple.fr/rr', '00000000-0000-0000-0000-00000000000e', 'k', 'a')
ON CONFLICT (endpoint) DO NOTHING;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT pg_temp.attendre('Événement : heure mal écrite refusée', pg_temp.refuse('INSERT INTO public.events (title, start_date, heure) VALUES (''Tard'', current_date, ''25:00'')'), 1);
INSERT INTO public.events (title, type, start_date, heure, html, invites) VALUES ('Formation accords mets et vins', 'formation', current_date + 5, '14:30', '<p>Programme</p>', '{Lille,Nice}') RETURNING id AS f30 \gset
INSERT INTO public.communications (titre, auteur, auteur_nom, auteur_role) VALUES ('Nouvelle gamme', '00000000-0000-0000-0000-00000000000d', 'Directeur', 'directeur') RETURNING id AS c30 \gset
UPDATE public.app_config SET value = '[{"id":"bp_t","titre":"Dégustation","magasin":"Lille"},{"id":"bp_30","titre":"Vitrine de Noël","magasin":"Lille"}]' WHERE key = 'bonnes_pratiques';
INSERT INTO public.campagnes_regions (id, rr, valeur) VALUES ('c30', 'rr1', jsonb_build_object('nom', 'Noël', 'debut', current_date::text, 'fin', (current_date + 10)::text, 'rr', 'rr1')) ON CONFLICT (id) DO NOTHING;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : reçoit l''heure et le contenu de la formation',
  (SELECT count(*) FROM jsonb_array_elements(public.reunions_franchise()) e WHERE (e->>'id')::bigint = :f30 AND e->>'type' = 'formation' AND e->>'heure' = '14:30' AND e->>'html' = '<p>Programme</p>'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT public.publier_sondage('Besoin de formation', '[{"titre":"Utile ?","genre":"oui_non"}]', 'tous', false, NULL, current_date + 7) AS s30 \gset
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : ne lit pas les notifications d''un contenu', pg_temp.refuse('SELECT public.notifications_animation(''communication'', ''' || :c30 || ''', NULL, auth.uid())'), 1);
SELECT pg_temp.attendre('Coach : aucun accès direct aux contenus notifiés', pg_temp.refuse('SELECT count(*) FROM public.notifications_envoyees'), 1);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.attendre('Contenu d''avant 0030 : déjà noté comme envoyé',
  (SELECT jsonb_array_length(public.notifications_animation('evenement', :'reunion', NULL, '00000000-0000-0000-0000-00000000000d'))), 0);
SELECT pg_temp.attendre('Formation : un Coach ne l''annonce pas',
  (SELECT jsonb_array_length(public.notifications_animation('evenement', :'f30', NULL, '00000000-0000-0000-0000-00000000000c'))), 0);
SELECT pg_temp.attendre('Formation par le RR : franchisé et Coach de Lille seulement',
  (SELECT jsonb_array_length(public.notifications_animation('evenement', :'f30', NULL, '00000000-0000-0000-0000-00000000000e'))), 2);
SELECT pg_temp.attendre('Formation : une seule fois',
  (SELECT jsonb_array_length(public.notifications_animation('evenement', :'f30', NULL, '00000000-0000-0000-0000-00000000000d'))), 0);
SELECT pg_temp.attendre('Communication : rien si l''auteur annoncé n''est pas le sien',
  (SELECT jsonb_array_length(public.notifications_animation('communication', :'c30', NULL, '00000000-0000-0000-0000-00000000000e'))), 0);
SELECT pg_temp.attendre('Communication du Directeur : franchisé, Coach et RR',
  (SELECT jsonb_array_length(public.notifications_animation('communication', :'c30', NULL, '00000000-0000-0000-0000-00000000000d'))), 3);
SELECT pg_temp.attendre('Bonne pratique du Coach : tout le réseau sauf lui',
  (SELECT jsonb_array_length(public.notifications_animation('pratique', 'bp_30', NULL, '00000000-0000-0000-0000-00000000000c'))), 3);
SELECT pg_temp.attendre('Bonne pratique inconnue : rien',
  (SELECT jsonb_array_length(public.notifications_animation('pratique', 'bp_inconnue', NULL, '00000000-0000-0000-0000-00000000000c'))), 0);
SELECT pg_temp.attendre('Sondage : rien si l''auteur annoncé n''est pas le sien',
  (SELECT jsonb_array_length(public.notifications_animation('sondage', :'s30', NULL, '00000000-0000-0000-0000-00000000000e'))), 0);
SELECT pg_temp.attendre('Sondage pour tous : franchisé, Coach et RR',
  (SELECT jsonb_array_length(public.notifications_animation('sondage', :'s30', NULL, '00000000-0000-0000-0000-00000000000d'))), 3);
SELECT pg_temp.attendre('Campagne du RR : ses magasins seulement (Lille), sans lui',
  (SELECT jsonb_array_length(public.notifications_animation('campagne', 'c30', '{Lille,Nice}', '00000000-0000-0000-0000-00000000000e'))), 3);
SELECT pg_temp.attendre('Campagne : notée comme envoyée',
  (SELECT count(*) FROM public.notifications_envoyees WHERE genre = 'campagne' AND cle = 'c30'), 1);
RESET ROLE;
SELECT pg_temp.attendre('Animation : fonctions d''envoi fermées aux comptes', (SELECT count(*) FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC') AND routine_name IN ('comptes_concernes', 'notifications_animation')), 0);

-- ── 0033 : situation des magasins (une colonne de store_overrides, règles inchangées)
SELECT pg_temp.attendre('Journal : 0033 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0033'), 1);
SELECT pg_temp.attendre('Situations : colonne jsonb ajoutée', (SELECT count(*) FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'store_overrides' AND column_name = 'situations' AND data_type = 'jsonb'), 1);
SELECT pg_temp.attendre('Situations : une liste seulement', (SELECT count(*) FROM pg_constraint WHERE conname = 'store_overrides_situations'), 1);

-- ── 0034 : agenda dans Google Agenda (lien secret par compte de l'équipe, lu par la fonction « agenda » seule)
SELECT pg_temp.attendre('Journal : 0034 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0034'), 1);
INSERT INTO public.visits (store, visit_date, visitor, prevue) VALUES
  ('Lille', current_date + 2, 'Coach Nord', true), ('Nice', current_date + 3, 'Coach Nord', true), ('Lille', current_date + 4, 'Autre COACH', true);
INSERT INTO public.suivi_magasins (store_name, cle, valeur) VALUES ('Lille', 'preparation', '{"heure":"09:30","notes":""}')
ON CONFLICT (store_name, cle) DO UPDATE SET valeur = excluded.valeur;
INSERT INTO public.events (title, start_date) VALUES ('Séminaire 0034', current_date + 5);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT public.mon_agenda('Coach Nord') AS jeton_coach \gset
SELECT pg_temp.attendre('Agenda : même lien au second appel', (SELECT count(*) FROM (SELECT public.mon_agenda('Coach Nord') AS j) x WHERE j = :'jeton_coach'), 1);
SELECT pg_temp.attendre('Agenda : lien de 64 caractères', length(:'jeton_coach'), 64);
SELECT pg_temp.attendre('Agenda : aucun accès direct aux liens', pg_temp.refuse('SELECT count(*) FROM public.agenda_jetons'), 1);
SELECT pg_temp.attendre('Agenda : un compte ne lit pas l''agenda d''un lien', pg_temp.refuse('SELECT public.agenda_du_jeton(''' || :'jeton_coach' || ''')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Agenda : refusé au franchisé', pg_temp.refuse('SELECT public.mon_agenda(''Franchisé'')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
SELECT pg_temp.attendre('Agenda : refusé au compte sans rôle', pg_temp.refuse('SELECT public.mon_agenda(''Personne'')'), 1);
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.attendre('Agenda : rien sans compte', pg_temp.refuse('SELECT public.agenda_du_jeton(''' || :'jeton_coach' || ''')'), 1);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.attendre('Agenda du Coach : ses visites, sur ses magasins seulement',
  (SELECT jsonb_array_length(public.agenda_du_jeton(:'jeton_coach')->'visites')), 1);
SELECT pg_temp.attendre('Agenda du Coach : l''heure préparée de la visite prévue',
  (SELECT count(*) FROM jsonb_array_elements(public.agenda_du_jeton(:'jeton_coach')->'visites') v WHERE v->>'heure' = '09:30'), 1);
SELECT pg_temp.attendre('Agenda : les événements du réseau',
  (SELECT count(*) FROM jsonb_array_elements(public.agenda_du_jeton(:'jeton_coach')->'evenements') e WHERE e->>'titre' = 'Séminaire 0034'), 1);
SELECT pg_temp.attendre('Agenda : lien inconnu, rien', (SELECT count(*) FROM (SELECT public.agenda_du_jeton(repeat('0', 64)) AS a) x WHERE a IS NULL), 1);
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Agenda : un nouveau lien remplace l''ancien', (SELECT count(*) FROM (SELECT public.mon_agenda('Coach Nord', true) AS j) x WHERE j <> :'jeton_coach'), 1);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.attendre('Agenda : l''ancien lien ne marche plus', (SELECT count(*) FROM (SELECT public.agenda_du_jeton(:'jeton_coach') AS a) x WHERE a IS NULL), 1);
RESET ROLE;
SELECT pg_temp.attendre('Agenda : fonction de lecture fermée aux comptes', (SELECT count(*) FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC') AND routine_name = 'agenda_du_jeton'), 0);

-- ── 0035 : ouvertures par étapes, rubrique « ouverture » de suivi_magasins (rejouée ici : l'ordre inverse a remis 0011 en dernier)
\ir ../migrations/0035_ouvertures_etapes.sql
SELECT pg_temp.attendre('Journal : 0035 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0035'), 1);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Ouverture : le Coach écrit les étapes de son magasin',
  pg_temp.refuse('INSERT INTO public.suivi_magasins (store_name, cle, valeur) VALUES (''Lille'', ''ouverture'', ''{"etapes":{}}'')'), 0);
SELECT pg_temp.attendre('Ouverture : pas sur un magasin d''un autre Coach',
  pg_temp.refuse('INSERT INTO public.suivi_magasins (store_name, cle, valeur) VALUES (''Nice'', ''ouverture'', ''{"etapes":{}}'')'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Ouverture : rien pour le franchisé', (SELECT count(*) FROM public.suivi_magasins), 0);
RESET ROLE;
SELECT pg_temp.attendre('Ouverture : rubrique inconnue refusée',
  pg_temp.refuse('INSERT INTO public.suivi_magasins (store_name, cle, valeur) VALUES (''Lille'', ''inconnue'', ''{}'')'), 1);

-- ── 0036 : historique des modifications, lu et remis par le Directeur seul
SELECT pg_temp.attendre('Journal : 0036 notée', (SELECT count(*) FROM public.journal_migrations WHERE numero = '0036'), 1);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT min(id) AS visite_0036 FROM public.visits WHERE store = 'Lille' \gset
UPDATE public.visits SET notes = 'Note du Coach 0036' WHERE id = :visite_0036;
UPDATE public.visits SET notes = 'Note du Coach 0036' WHERE id = :visite_0036;
DELETE FROM public.visits WHERE id = :visite_0036;
SELECT pg_temp.attendre('Historique : aucun accès direct pour l''équipe', pg_temp.refuse('SELECT count(*) FROM public.historique_modifications'), 1);
SELECT pg_temp.attendre('Historique : lecture refusée au Coach', pg_temp.refuse('SELECT public.historique_modifications()'), 1);
SELECT pg_temp.attendre('Historique : le Coach ne remet rien', pg_temp.refuse('SELECT public.remettre_modification(1)'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Historique : lecture refusée au franchisé', pg_temp.refuse('SELECT public.historique_modifications()'), 1);
SELECT pg_temp.attendre('Historique : aucun accès direct pour le franchisé', pg_temp.refuse('SELECT count(*) FROM public.historique_modifications'), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
SELECT pg_temp.attendre('Historique : le changement du Coach, noté une seule fois avec son nom',
  (SELECT count(*) FROM jsonb_array_elements(public.historique_modifications()) h
   WHERE h->>'table_nom' = 'visits' AND h->>'operation' = 'changement' AND h->>'auteur' = 'Coach Nord' AND h->>'magasin' = 'Lille' AND h->'apres'->>'notes' = 'Note du Coach 0036'), 1);
SELECT pg_temp.attendre('Historique : l''identifiant du compte n''est pas renvoyé',
  (SELECT count(*) FROM jsonb_array_elements(public.historique_modifications()) h WHERE h ? 'user_id'), 0);
SELECT h->>'id' AS suppression FROM jsonb_array_elements(public.historique_modifications()) h
WHERE h->>'table_nom' = 'visits' AND h->>'operation' = 'suppression' AND h->>'magasin' = 'Lille' LIMIT 1 \gset
SELECT pg_temp.attendre('Historique : le Directeur remet la visite supprimée', (SELECT count(*) FROM (SELECT public.remettre_modification(:suppression) AS r) x WHERE r), 1);
SELECT pg_temp.attendre('Historique : la visite est revenue', (SELECT count(*) FROM public.visits WHERE store = 'Lille' AND notes = 'Note du Coach 0036'), 1);
SELECT pg_temp.attendre('Historique : remise une seule fois', (SELECT count(*) FROM (SELECT public.remettre_modification(:suppression) AS r) x WHERE NOT r), 1);
RESET ROLE;
SELECT pg_temp.attendre('Historique : la rubrique « preparation » n''est pas notée', (SELECT count(*) FROM public.historique_modifications WHERE rubrique = 'preparation'), 0);
SELECT pg_temp.attendre('Historique : table fermée aux comptes', (SELECT count(*) FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'historique_modifications' AND grantee IN ('anon', 'authenticated', 'PUBLIC')), 0);
