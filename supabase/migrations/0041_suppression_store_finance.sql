-- ════════════════════════════════════════════════════════════════
-- V and B — Suppression des chiffres saisis à la main (Joseph, 03/11/2026 décision 1, feu vert le 04/11/2026 : « go »).
-- La caisse est la seule source du CA. Réexécutable. Suppose 0039 (chiffres_mensuels) et 0040 (archive_store_finance).
--
-- 1) Garde-fou : le script s'arrête sans rien toucher si une ligne de store_finance n'est pas dans l'archive à l'identique
--    (repasser alors 0040, puis celui-ci).
-- 2) store_finance est vidée (sans remplir l'historique des modifications : l'archive en garde la copie).
--    La table reste, vide, pour les fonctions qui la lisent encore en secours.
-- 3) Plus aucune ligne ne s'y écrit (déclencheur, qui tient même si une ancienne migration rouvre des règles) ;
--    saisie_chiffres_fermee() le dit à l'app, qui retire la saisie et l'import des chiffres.
-- Retour en arrière : INSERT INTO public.store_finance SELECT (jsonb_populate_record(NULL::public.store_finance, ligne)).*
--   FROM public.archive_store_finance; après avoir retiré le déclencheur store_finance_fermee.
-- ════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF to_regclass('public.archive_store_finance') IS NULL THEN RAISE EXCEPTION 'Passer d''abord 0040_archive_store_finance'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lignes_hors_archive() RETURNS bigint
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT count(*) FROM public.store_finance f
  WHERE NOT EXISTS (SELECT 1 FROM public.archive_store_finance a WHERE a.store_name = f.store_name AND a.month = f.month AND a.ligne = to_jsonb(f))
$$;
REVOKE ALL ON FUNCTION public.lignes_hors_archive() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_manquantes bigint;
BEGIN
  v_manquantes := public.lignes_hors_archive();
  IF v_manquantes > 0 THEN RAISE EXCEPTION '% ligne(s) de store_finance absentes de l''archive : repasser 0040, puis ce script', v_manquantes; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.store_finance_fermee() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'saisie_chiffres_fermee';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'noter_modification' AND tgrelid = 'public.store_finance'::regclass) THEN
    ALTER TABLE public.store_finance DISABLE TRIGGER noter_modification;
  END IF;
  DELETE FROM public.store_finance;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'noter_modification' AND tgrelid = 'public.store_finance'::regclass) THEN
    ALTER TABLE public.store_finance ENABLE TRIGGER noter_modification;
  END IF;
END $$;

DROP TRIGGER IF EXISTS store_finance_fermee ON public.store_finance;
CREATE TRIGGER store_finance_fermee BEFORE INSERT OR UPDATE ON public.store_finance
  FOR EACH ROW EXECUTE FUNCTION public.store_finance_fermee();

CREATE OR REPLACE FUNCTION public.saisie_chiffres_fermee() RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'store_finance_fermee' AND tgrelid = 'public.store_finance'::regclass AND tgenabled <> 'D')
$$;
REVOKE ALL ON FUNCTION public.saisie_chiffres_fermee() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisie_chiffres_fermee() TO authenticated;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0041', 'suppression_store_finance')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

SELECT (SELECT count(*) FROM public.store_finance) AS lignes_restantes, (SELECT count(*) FROM public.archive_store_finance) AS lignes_archivees;
