-- ════════════════════════════════════════════════════════════════
-- V and B — Actualités et animation, refonte vague 5 (10/11/2026, choix 43 à 56 de Joseph, sauf 47)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0004 (acces_franchises, json_sur), 0005 (suivi_magasins),
-- 0006 (magasins_messagerie), 0008 (communications), 0013 (lectures) et 0043 (rubrique « plan »).
--
-- 46 Prise de connaissance : une communication peut demander « J'ai pris connaissance » (colonne connaissance,
--    posée par son auteur ou le Directeur). Le franchisé concerné la donne par prendre_connaissance(), une seule
--    fois, datée. connaissances() renvoie à chacun ce qu'il doit voir : au franchisé sa propre date, à l'équipe la
--    liste des franchisés de ses magasins qui l'ont donnée et de ceux qui manquent. Table fermée.
-- 48 Temps forts de l'année : clé « temps_forts » d'app_config (Directeur, comme les autres réglages) ; les dates
--    clés d'une campagne (commande, réception, facturation…) sont dans la campagne elle-même (clé « campagnes »).
-- 50 Parcours d'intégration : étapes réglées par le Directeur (clé « parcours_integration » d'app_config), suivi
--    par magasin dans la rubrique « integration » de suivi_magasins (même cloisonnement que le reste du suivi).
--    animation_franchise() renvoie au franchisé les temps forts, le parcours et le suivi de ses magasins.
-- ════════════════════════════════════════════════════════════════

-- ── 46) Prise de connaissance ──────────────────────────────────────
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS connaissance boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.communications_connaissances (
  communication bigint NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  le            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (communication, user_id)
);
ALTER TABLE public.communications_connaissances ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communications_connaissances' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.communications_connaissances', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.communications_connaissances FROM anon, authenticated;

-- L'auteur (ou le Directeur) demande ou retire la prise de connaissance
CREATE OR REPLACE FUNCTION public.demander_connaissance(p_id bigint, p_oui boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  UPDATE public.communications SET connaissance = coalesce(p_oui, false)
  WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur()) RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
END $$;

-- Le franchisé connecté a pris connaissance d'une communication qui le demande (vaut aussi lecture)
CREATE OR REPLACE FUNCTION public.prendre_connaissance(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NOT public.communication_visible(p_id) OR NOT EXISTS (SELECT 1 FROM public.communications c WHERE c.id = p_id AND c.connaissance) THEN
    RAISE EXCEPTION 'communication_introuvable';
  END IF;
  INSERT INTO public.communications_connaissances (communication, user_id) VALUES (p_id, auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.communications_lectures (communication, user_id) VALUES (p_id, auth.uid()) ON CONFLICT DO NOTHING;
END $$;

-- Communications visibles qui demandent une prise de connaissance (24 derniers mois) :
-- [{ id, moi (date ou null), pris: [{ franchise, le }], manquants: [franchise] }]
-- Le franchisé ne reçoit que sa propre date ; l'équipe, les franchisés de ses magasins (le Directeur : tous).
CREATE OR REPLACE FUNCTION public.connaissances() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text := public.mon_role(); v_mag text[];
BEGIN
  IF NOT (public.est_equipe() OR v_role = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  v_mag := public.magasins_messagerie(); -- NULL pour le Directeur
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'moi', (SELECT k.le FROM public.communications_connaissances k WHERE k.communication = c.id AND k.user_id = auth.uid()),
      'pris', CASE WHEN v_role = 'franchise' THEN '[]'::jsonb ELSE (
        SELECT coalesce(jsonb_agg(jsonb_build_object('franchise', a.franchise, 'le', k.le) ORDER BY a.franchise), '[]'::jsonb)
        FROM public.acces_franchises a JOIN public.communications_connaissances k ON k.user_id = a.user_id AND k.communication = c.id
        WHERE (c.magasins IS NULL OR a.magasins && c.magasins) AND (v_mag IS NULL OR a.magasins && v_mag)) END,
      'manquants', CASE WHEN v_role = 'franchise' THEN '[]'::jsonb ELSE (
        SELECT coalesce(jsonb_agg(a.franchise ORDER BY a.franchise), '[]'::jsonb) FROM public.acces_franchises a
        WHERE (c.magasins IS NULL OR a.magasins && c.magasins) AND (v_mag IS NULL OR a.magasins && v_mag)
          AND NOT EXISTS (SELECT 1 FROM public.communications_connaissances k WHERE k.communication = c.id AND k.user_id = a.user_id)) END
    ) ORDER BY c.cree_le DESC, c.id DESC), '[]'::jsonb)
    FROM public.communications c
    WHERE c.connaissance AND c.cree_le > now() - interval '24 months' AND public.communication_visible(c.id));
END $$;

-- ── 50) Rubrique « integration » ──────────────────────────────────
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture',
    'concurrence', 'mot_franchise', 'objectifs', 'plan', 'integration'));

-- ── 48 et 50) Ce que le franchisé lit : temps forts, parcours, suivi de ses magasins ─
CREATE OR REPLACE FUNCTION public.animation_franchise() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mag text[];
BEGIN
  IF public.mon_role() IS DISTINCT FROM 'franchise' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT a.magasins INTO v_mag FROM public.acces_franchises a WHERE a.user_id = auth.uid();
  RETURN jsonb_build_object(
    'temps_forts', coalesce((SELECT public.json_sur(c.value) FROM public.app_config c WHERE c.key = 'temps_forts'), '[]'::jsonb),
    'parcours_integration', (SELECT public.json_sur(c.value) FROM public.app_config c WHERE c.key = 'parcours_integration'),
    'integration', (SELECT coalesce(jsonb_object_agg(s.store_name, s.valeur), '{}'::jsonb) FROM public.suivi_magasins s
      WHERE s.cle = 'integration' AND s.store_name = ANY(coalesce(v_mag, '{}'))));
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['demander_connaissance(bigint, boolean)', 'prendre_connaissance(bigint)', 'connaissances()', 'animation_franchise()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0044', 'actualites_vague5')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();

-- Vérification : la table existe, sans accès direct ; la colonne est là
SELECT table_name, (SELECT count(*) FROM information_schema.role_table_grants g WHERE g.table_name = t.table_name AND g.grantee IN ('anon', 'authenticated')) AS acces_direct
FROM information_schema.tables t WHERE table_schema = 'public' AND table_name = 'communications_connaissances';
