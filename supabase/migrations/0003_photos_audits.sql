-- ════════════════════════════════════════════════════════════════
-- V and B — Espace photos des audits (Supabase Storage, 15/10/2026)
-- Réexécutable. Seau privé : photos lues par liens temporaires seulement.
-- 5 Mo maximum par photo (l'app envoie ~250 Ko).
-- Règles d'accès : 0004 (équipe ; franchisé pour les photos de ses visites).
-- Les règles « tout compte connecté » de la première version de ce script ont
-- été retirées le 21/10/2026 : rejouées après 0004, elles rouvraient les photos
-- aux comptes franchisés.
-- ════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg'];
