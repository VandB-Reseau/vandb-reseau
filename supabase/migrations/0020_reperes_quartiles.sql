-- ════════════════════════════════════════════════════════════════
-- V and B — Repères réseau : le quart inférieur en plus (22/10/2026)
-- Réexécutable. Suppose 0004 (reperes_reseau) et 0005 (reperes_equipe).
--
-- reperes_reseau() renvoie, pour chaque indicateur du dernier mois connu, la médiane, le quart supérieur
-- et désormais le quart inférieur (quartBas), toujours seulement si au moins 5 magasins ont le chiffre.
-- Sert aux leviers du CA (panier et flux, cave et bar) dans la fiche magasin et le filtre Levier de Magasins.
-- Accès inchangés : fonction interne, appelée par espace_franchise() et reperes_equipe() seulement.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reperes_reseau(p_magasins text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH f AS (
    SELECT s.store_name, date_trunc('month', s.month)::date AS mois, s.pm_cave, s.pm_bar, s.flux_cave, s.flux_bar, s.panier, s.marge,
      CASE WHEN s.ca_cave IS NULL AND s.ca_bar IS NULL AND s.ca_ext IS NULL THEN NULL ELSE coalesce(s.ca_cave, 0) + coalesce(s.ca_bar, 0) + coalesce(s.ca_ext, 0) END AS ca
    FROM public.store_finance s
  ),
  m AS (SELECT max(mois) AS mois FROM f WHERE store_name = ANY(p_magasins) AND ca IS NOT NULL),
  valeurs AS (
    SELECT x.ind, x.v FROM f CROSS JOIN m
    CROSS JOIN LATERAL (VALUES ('pmCave', f.pm_cave), ('pmBar', f.pm_bar), ('fluxCave', f.flux_cave), ('fluxBar', f.flux_bar), ('panier', f.panier), ('marge', f.marge)) AS x(ind, v)
    WHERE f.mois = m.mois AND x.v IS NOT NULL
    UNION ALL
    SELECT 'evolution', (c.ca - r.ca) / r.ca * 100 FROM f c CROSS JOIN m
    JOIN f r ON r.store_name = c.store_name AND r.mois = (m.mois - interval '12 months')::date
    WHERE c.mois = m.mois AND c.ca IS NOT NULL AND r.ca > 0
  ),
  stats AS (
    SELECT ind, count(*) AS n, percentile_cont(0.25) WITHIN GROUP (ORDER BY v) AS qb, percentile_cont(0.5) WITHIN GROUP (ORDER BY v) AS med,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY v) AS q
    FROM valeurs GROUP BY ind HAVING count(*) >= 5
  )
  SELECT CASE WHEN (SELECT mois FROM m) IS NULL THEN NULL ELSE jsonb_build_object(
    'mois', to_char((SELECT mois FROM m), 'YYYY-MM'),
    'indicateurs', coalesce((SELECT jsonb_object_agg(ind, jsonb_build_object('n', n, 'quartBas', round(qb::numeric, 2), 'mediane', round(med::numeric, 2), 'quartHaut', round(q::numeric, 2))) FROM stats), '{}'::jsonb)) END
$$;

-- Fonction interne : aucun compte ne l'appelle directement
REVOKE ALL ON FUNCTION public.reperes_reseau(text[]) FROM PUBLIC, anon, authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0020', 'reperes_quartiles')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();
