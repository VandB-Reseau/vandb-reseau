-- ════════════════════════════════════════════════════════════════
-- V and B — Carnet du magasin et commentaires du budget « équipe seule » (Joseph, 24/11/2026)
-- Réexécutable ; ne rouvre aucun accès.
--
-- 1. Les notes en off de l'équipe (Carnet du magasin) restent dans suivi_magasins, rubrique « notes » : champs JSON en
--    plus (ton, themes, mentions, quand, reponses, close), sans nouvelle colonne ni nouvelle règle. La rubrique n'est
--    jamais renvoyée au franchisé (espace_franchise() ne la lit pas ; contrôle ajouté dans les tests de la base).
-- 2. Un commentaire du budget marqué « équipe seule » (pilotage.echanges_budget.equipe, migration pilotage 0037) ne part
--    plus en notification vers le téléphone du franchisé. Sans la colonne (0037 pas encore passée), rien ne change.
--    À passer APRÈS la migration pilotage 0037. La fonction Supabase « notifier » ne change pas.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notifications_budget(p_ids bigint[], p_auteur uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v jsonb := '[]'::jsonb;
  v_equipe text := 'false';
BEGIN
  IF to_regclass('pilotage.echanges_budget') IS NULL THEN RETURN v; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'pilotage' AND table_name = 'echanges_budget' AND column_name = 'equipe') THEN
    v_equipe := 'b.equipe';
  END IF;
  EXECUTE format($q$
    WITH e AS (
      SELECT b.id, b.store_name, b.texte, coalesce(nullif(b.auteur_nom, ''), 'Budget') AS nom, %s AS equipe
      FROM pilotage.echanges_budget b
      WHERE b.id = ANY($1[1:20]) AND b.auteur = $2 AND b.cree_le > now() - interval '1 day'
        AND (public.compte_lit_magasin($2, b.store_name, false) OR public.compte_lit_magasin($2, b.store_name, true))),
    d AS (
      SELECT DISTINCT e.id, k AS user_id FROM e, LATERAL public.comptes_concernes(ARRAY[e.store_name], NOT e.equipe, true, true) k
      WHERE k <> $2 AND public.compte_lit_magasin(k, e.store_name, false)
        AND (NOT e.equipe OR NOT EXISTS (SELECT 1 FROM public.acces_franchises f WHERE f.user_id = k)))
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth,
        'titre', 'Budget · ' || e.store_name,
        'texte', e.nom || ' : ' || left(e.texte, 120),
        'lien', '#/magasins/' || replace(e.store_name, ' ', '%%20') || '?vue=budget')), '[]'::jsonb)
    FROM e JOIN d ON d.id = e.id JOIN public.abonnements_push a ON a.user_id = d.user_id
  $q$, v_equipe) INTO v USING p_ids, p_auteur;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.notifications_budget(bigint[], uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.notifications_budget(bigint[], uuid) TO service_role;
  END IF;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0053', 'notes_equipe')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
