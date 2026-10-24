-- ════════════════════════════════════════════════════════════════
-- V and B — Ouvertures suivies par étapes (24/10/2026, sprint 25, F3)
-- Réexécutable ; ne rouvre aucun accès. Suppose 0005 (suivi_magasins) et 0011 (rubrique « preparation »).
--
-- Une rubrique de plus dans suivi_magasins : « ouverture », une ligne par magasin à ouvrir :
--   { etapes: { contrat|local|travaux|recrutement|formation: { prevu: AAAA-MM-JJ, fait: AAAA-MM-JJ } }, par, maj }
-- La dernière étape, l'ouverture, reste la date d'ouverture du magasin (store_adds). Même cloisonnement que le
-- reste du suivi : le Directeur partout, un Coach ou un RR sur ses magasins ; jamais renvoyée au franchisé
-- (espace_franchise() ne lit pas suivi_magasins). L'app réserve la saisie au Directeur et aux RR.
-- ════════════════════════════════════════════════════════════════

-- Retire l'ancienne liste des rubriques, quel que soit le nom donné à la contrainte
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.suivi_magasins'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cle%' LOOP
    EXECUTE format('ALTER TABLE public.suivi_magasins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.suivi_magasins ADD CONSTRAINT suivi_magasins_cle_check
  CHECK (cle IN ('sante', 'sante_sauvegarde', 'notes', 'audits', 'associes', 'actions', 'deploiements', 'constats', 'preparation', 'ouverture'));

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0035', 'ouvertures_etapes')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
