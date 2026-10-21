-- ════════════════════════════════════════════════════════════════
-- V and B — Communication à la une (21/10/2026)
-- Réexécutable. Suppose 0008 (communications) et 0012 (journal).
--
-- 1) L'auteur d'une communication (ou le Directeur de réseau) la met à la une jusqu'à une date :
--    elle reste en tête du fil et de la page Communications jusqu'à ce jour inclus.
-- 2) Chacun lit la date « à la une » des seules communications qu'il voit (communication_visible).
-- 3) Toujours aucun accès direct à la table : tout passe par les fonctions.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS a_la_une date;

-- Mise à la une jusqu'au jour donné ; NULL la retire
CREATE OR REPLACE FUNCTION public.mettre_a_la_une(p_id bigint, p_jusqu_au date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id bigint;
BEGIN
  IF public.mon_role() NOT IN ('directeur', 'rr') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF p_jusqu_au IS NOT NULL AND (p_jusqu_au < current_date OR p_jusqu_au > current_date + 365) THEN RAISE EXCEPTION 'date_invalide'; END IF;
  UPDATE public.communications SET a_la_une = p_jusqu_au
  WHERE id = p_id AND (auteur = auth.uid() OR public.est_directeur()) RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'acces_refuse'; END IF;
END $$;

-- Communications visibles encore à la une aujourd'hui : [{ id, jusqu_au }]
CREATE OR REPLACE FUNCTION public.a_la_une() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (public.est_equipe() OR public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'jusqu_au', c.a_la_une) ORDER BY c.a_la_une, c.id), '[]'::jsonb)
    FROM public.communications c
    WHERE c.a_la_une >= current_date AND public.communication_visible(c.id));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['mettre_a_la_une(bigint, date)', 'a_la_une()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0014', 'communications_a_la_une')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- Vérification : la colonne existe
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'communications' AND column_name = 'a_la_une';
