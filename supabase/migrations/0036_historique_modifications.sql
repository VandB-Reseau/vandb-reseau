-- ════════════════════════════════════════════════════════════════
-- V and B — Historique des modifications (26/10/2026, sprint 26, F3)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (rôles), 0005 (périmètre, suivi_magasins), 0012 (journal).
--
-- Depuis l'ouverture des comptes Coach et RR, plusieurs personnes écrivent dans les données des magasins. La base garde
-- désormais une trace de chaque changement, pour savoir qui a changé quoi et remettre une suppression faite par erreur.
--
-- 1) historique_modifications : une ligne par ajout, changement ou suppression dans visits, store_finance,
--    suivi_magasins (sauf les rubriques « preparation » et « sante_sauvegarde »), store_overrides et reassigns :
--    quand, qui (compte, rôle, nom du Coach, identifiant du RR ou nom du franchisé), quelle table, quel magasin,
--    la ligne avant et après (jsonb). Un enregistrement qui ne change rien n'est pas noté (la date de mise à jour seule
--    ne compte pas). Gardé 12 mois. Table fermée : aucune règle, aucun droit pour les comptes.
-- 2) Déclencheur noter_modification() posé sur les cinq tables ; il écrit même quand la modification vient d'une
--    fonction (franchisé qui coche une tâche, par exemple).
-- 3) historique_modifications(p_depuis, p_limite) : lecture, Directeur seul, du plus récent au plus ancien.
-- 4) remettre_modification(p_id) : Directeur seul ; remet une ligne supprimée (visite, chiffres d'un mois, rubrique
--    de suivi, affectation, fiche de magasin) si rien n'a pris sa place depuis. Une tâche retirée d'une liste est
--    remise par l'app (la liste des tâches d'un magasin est une seule ligne de suivi_magasins).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.historique_modifications (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  le         timestamptz NOT NULL DEFAULT now(),
  user_id    uuid,
  role       text NOT NULL DEFAULT '',
  auteur     text NOT NULL DEFAULT '',  -- nom du Coach, identifiant du RR, nom du franchisé ; vide pour le Directeur
  table_nom  text NOT NULL,
  operation  text NOT NULL CHECK (operation IN ('ajout', 'changement', 'suppression')),
  magasin    text NOT NULL DEFAULT '',
  rubrique   text NOT NULL DEFAULT '',  -- cle de suivi_magasins, mois des chiffres
  avant      jsonb,
  apres      jsonb,
  remis_le   timestamptz
);
CREATE INDEX IF NOT EXISTS historique_modifications_le ON public.historique_modifications (le DESC);
ALTER TABLE public.historique_modifications ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'historique_modifications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.historique_modifications', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.historique_modifications FROM PUBLIC, anon, authenticated;

-- ── Déclencheur : note chaque changement réel
CREATE OR REPLACE FUNCTION public.noter_modification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_avant jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_apres jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_ligne jsonb := coalesce(v_apres, v_avant);
  v_role text := public.mon_role();
  v_meta jsonb;
BEGIN
  -- Rubriques de travail sans intérêt pour l'historique
  IF TG_TABLE_NAME = 'suivi_magasins' AND v_ligne->>'cle' IN ('preparation', 'sante_sauvegarde') THEN RETURN NULL; END IF;
  -- Un enregistrement identique (seule la date de mise à jour bouge) n'est pas un changement
  IF TG_OP = 'UPDATE' AND (v_avant - 'maj_le' - 'updated_at') = (v_apres - 'maj_le' - 'updated_at') THEN RETURN NULL; END IF;
  SELECT u.raw_app_meta_data INTO v_meta FROM auth.users u WHERE u.id = auth.uid();
  INSERT INTO public.historique_modifications (user_id, role, auteur, table_nom, operation, magasin, rubrique, avant, apres)
  VALUES (
    auth.uid(), v_role,
    CASE v_role
      WHEN 'coach' THEN coalesce(v_meta->>'coach', '')
      WHEN 'rr' THEN coalesce(v_meta->>'rr', '')
      WHEN 'franchise' THEN coalesce((SELECT a.franchise FROM public.acces_franchises a WHERE a.user_id = auth.uid()), '')
      ELSE '' END,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'INSERT' THEN 'ajout' WHEN 'UPDATE' THEN 'changement' ELSE 'suppression' END,
    coalesce(v_ligne->>'store', v_ligne->>'store_name', ''),
    coalesce(v_ligne->>'cle', left(v_ligne->>'month', 7), ''),
    v_avant, v_apres
  );
  -- Ménage de temps en temps : 12 mois gardés
  IF random() < 0.01 THEN DELETE FROM public.historique_modifications WHERE le < now() - interval '12 months'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.noter_modification() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['visits', 'store_finance', 'suivi_magasins', 'store_overrides', 'reassigns'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS noter_modification ON public.%I', t);
    EXECUTE format('CREATE TRIGGER noter_modification AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.noter_modification()', t);
  END LOOP;
END $$;

-- ── Lecture, Directeur seul
CREATE OR REPLACE FUNCTION public.historique_modifications(p_depuis timestamptz DEFAULT now() - interval '90 days', p_limite integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(h) - 'user_id' ORDER BY h.le DESC, h.id DESC)
    FROM (SELECT * FROM public.historique_modifications
          WHERE le >= coalesce(p_depuis, now() - interval '12 months')
          ORDER BY le DESC, id DESC LIMIT least(greatest(coalesce(p_limite, 500), 1), 2000)) h
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.historique_modifications(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historique_modifications(timestamptz, integer) TO authenticated;

-- ── Remettre une ligne supprimée, Directeur seul
CREATE OR REPLACE FUNCTION public.remettre_modification(p_id bigint) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE h public.historique_modifications; n integer;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT * INTO h FROM public.historique_modifications WHERE id = p_id;
  IF h.id IS NULL OR h.operation <> 'suppression' OR h.avant IS NULL THEN RAISE EXCEPTION 'introuvable'; END IF;
  IF h.remis_le IS NOT NULL THEN RETURN false; END IF;
  CASE h.table_nom
    WHEN 'visits' THEN
      INSERT INTO public.visits OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_record(NULL::public.visits, h.avant) ON CONFLICT DO NOTHING;
    WHEN 'reassigns' THEN
      INSERT INTO public.reassigns OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_record(NULL::public.reassigns, h.avant) ON CONFLICT DO NOTHING;
    WHEN 'store_finance' THEN
      INSERT INTO public.store_finance OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_record(NULL::public.store_finance, h.avant) ON CONFLICT DO NOTHING;
    WHEN 'suivi_magasins' THEN
      INSERT INTO public.suivi_magasins OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_record(NULL::public.suivi_magasins, h.avant) ON CONFLICT DO NOTHING;
    WHEN 'store_overrides' THEN
      INSERT INTO public.store_overrides OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_record(NULL::public.store_overrides, h.avant) ON CONFLICT DO NOTHING;
    ELSE RAISE EXCEPTION 'introuvable';
  END CASE;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- Une ligne a pris sa place depuis (même visite, même mois, même rubrique) : rien n'est écrasé
  IF n = 0 THEN RAISE EXCEPTION 'deja_remplace'; END IF;
  UPDATE public.historique_modifications SET remis_le = now() WHERE id = p_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.remettre_modification(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remettre_modification(bigint) TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0036', 'historique_modifications')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
