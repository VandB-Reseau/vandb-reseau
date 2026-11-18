-- ════════════════════════════════════════════════════════════════
-- V and B — Ajout d'un Coach réparé (Joseph, 18/11/2026)
-- Réexécutable ; ne touche à aucune règle d'accès.
--
-- La base en ligne a hérité de l'ancienne app une colonne « id » sur cs_overrides (et recruits) sans valeur
-- par défaut. 0001 l'ajoute « si elle n'existe pas » : déjà présente, elle est restée obligatoire et vide à
-- l'ajout d'un Coach, d'où le refus « colonne attendue ». La modification d'un Coach existant passait (mise à jour).
--   1. id sans valeur par défaut : numéro automatique (suite à partir du plus grand numéro existant), ou
--      identifiant aléatoire si la colonne est un uuid.
--   2. Toute autre colonne obligatoire sans valeur par défaut, hors nom du Coach / de la recrue, devient facultative :
--      l'app n'envoie que nom, téléphone, courriel, ville, poste à pourvoir, arrivée.
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
  c record;
  v_seq text;
  v_max bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['cs_overrides', 'recruits'] LOOP
    -- 1. Colonne id sans valeur par défaut
    SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS typ, a.attidentity, a.attnotnull,
           pg_get_expr(d.adbin, d.adrelid) AS defaut
      INTO c
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = format('public.%I', t)::regclass AND a.attname = 'id' AND NOT a.attisdropped;
    IF FOUND AND c.attidentity = '' AND c.defaut IS NULL THEN
      IF c.typ = 'uuid' THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()', t);
      ELSIF c.typ IN ('bigint', 'integer', 'smallint') THEN
        v_seq := t || '_id_seq';
        EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I', v_seq);
        EXECUTE format('ALTER SEQUENCE public.%I OWNED BY public.%I.id', v_seq, t);
        EXECUTE format('SELECT coalesce(max(id), 0) FROM public.%I', t) INTO v_max;
        PERFORM setval(format('public.%I', v_seq), greatest(v_max, 1), v_max > 0);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT nextval(%L)', t, 'public.' || v_seq);
        -- Le rôle de l'app doit pouvoir tirer un numéro
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', v_seq);
      ELSE
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id DROP NOT NULL', t);
      END IF;
    END IF;

    -- 2. Autres colonnes obligatoires sans valeur par défaut (hors clé de nom et hors id)
    FOR c IN
      SELECT a.attname
        FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = format('public.%I', t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attnotnull AND a.attidentity = '' AND d.adbin IS NULL
         AND a.attname NOT IN ('id', 'cs_name', 'name')
         AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = a.attrelid AND i.indisprimary AND a.attnum = ANY (i.indkey))
    LOOP
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', t, c.attname);
    END LOOP;
  END LOOP;
END $$;

INSERT INTO public.journal_migrations (numero, nom) VALUES ('0052', 'ajout_coach')
ON CONFLICT (numero) DO UPDATE SET nom = EXCLUDED.nom, passee_le = now();
