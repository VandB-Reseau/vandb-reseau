#!/usr/bin/env bash
# Rejoue toutes les migrations de la base sur un PostgreSQL local vide, deux fois de suite
# (elles doivent être réexécutables), puis vérifie les règles d'accès.
# Deux séries dans ce dépôt :
#   supabase/migrations/NNNN_*.sql            série unique de l'app (schéma public, et tout schéma à partir de 0055)
#   supabase/migrations/pilotage/NNNN_*.sql   historique du schéma pilotage (0001 à 0038), figé le 25/11/2026
# Trois bases locales :
#   1. app seule : ses migrations et supabase/tests/regles_acces.sql (comme avant la réunion des dépôts) ;
#   2. pilotage seul : les fonctions de l'app dont il dépend (pilotage/dependances_reseau.sql), ses migrations et
#      supabase/tests/pilotage/regles_acces.sql (comme dans l'ancien dépôt vandb-pilotage) ;
#   3. les deux séries ensemble, dans l'ordre de passage en ligne (app jusqu'à 0038, pilotage, puis app 0039 et
#      suivantes), deux fois : prouve qu'elles cohabitent dans la même base.
# Usage : npm run test:base   (PostgreSQL 16 installé localement, aucun accès réseau)
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$ICI/../migrations"
PILOTAGE="$MIGRATIONS/pilotage"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || { echo "PostgreSQL introuvable (initdb). Indiquer son dossier dans PG_BIN."; exit 1; }

DOSSIER="$(mktemp -d)"
PORT="${PG_PORT:-54329}"
# initdb refuse de tourner en root : on passe par l'utilisateur postgres
if [ "$(id -u)" = 0 ]; then chown postgres "$DOSSIER"; EN=(runuser -u postgres --); else EN=(); fi
arreter() { "${EN[@]}" "$BIN/pg_ctl" -D "$DOSSIER/donnees" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DOSSIER"; }
trap arreter EXIT

"${EN[@]}" "$BIN/initdb" -D "$DOSSIER/donnees" -U postgres -A trust >/dev/null
"${EN[@]}" "$BIN/pg_ctl" -D "$DOSSIER/donnees" -o "-p $PORT -k $DOSSIER -c listen_addresses=''" -l "$DOSSIER/journal" start -w >/dev/null

psql_() { PGOPTIONS="-c client_min_messages=warning" psql -h "$DOSSIER" -p "$PORT" -U postgres -d "$BASE" -v ON_ERROR_STOP=1 -q "$@"; }
nouvelle_base() { BASE="$1"; PGOPTIONS="-c client_min_messages=warning" psql -h "$DOSSIER" -p "$PORT" -U postgres -d postgres -q -c "CREATE DATABASE $1" >/dev/null; psql_ -f "$ICI/supabase_minimal.sql" >/dev/null; }
app() { ls "$MIGRATIONS"/[0-9][0-9][0-9][0-9]_*.sql; }
pilotage() { ls "$PILOTAGE"/[0-9][0-9][0-9][0-9]_*.sql; }
# Ordre de passage en ligne : les migrations 0039 et suivantes de l'app lisent le schéma pilotage
ensemble() { app | awk -F/ '$NF < "0039"'; pilotage; app | awk -F/ '$NF >= "0039"'; }

# Rejoue une liste deux fois, puis chaque migration seule dans l'ordre inverse (rien ne doit se rouvrir), puis l'ordre normal
rejouer() {
  local liste="$1" nom="$2" passage f
  for passage in 1 2; do
    for f in $($liste); do psql_ -f "$f" >/dev/null || { echo "$nom, échec au passage $passage : $f"; exit 1; }; done
  done
  echo "$nom : migrations passées deux fois : OK"
  for f in $($liste | tac); do psql_ -f "$f" >/dev/null; done
  # Une migration ancienne rejouée seule peut remettre ses règles d'origine, plus strictes, sur une table qu'une migration
  # plus récente a ouverte : la base en ligne suit l'ordre normal, on y revient avant les contrôles
  for f in $($liste); do psql_ -f "$f" >/dev/null; done
  echo "$nom : migrations rejouées dans l'ordre inverse : OK"
}

# 1. App seule
nouvelle_base app_seule
rejouer app "App"
# Incident du 21/10/2026 : un ancien script rouvre tout ; la suite rejouée doit tout refermer
psql_ -f "$ICI/ancien_verrouillage.sql" >/dev/null
for f in $(app); do psql_ -f "$f" >/dev/null || { echo "Échec après l'ancien verrouillage : $f"; exit 1; }; done
echo "App : suite rejouée après l'ancien verrouillage : OK"
psql_ -f "$ICI/regles_acces.sql" >/dev/null
echo "App : règles d'accès : OK"

# 2. Pilotage seul
nouvelle_base pilotage_seul
psql_ -f "$ICI/pilotage/dependances_reseau.sql" >/dev/null
rejouer pilotage "Pilotage"
psql_ -f "$ICI/pilotage/regles_acces.sql" >/dev/null
echo "Pilotage : règles d'accès : OK"

# 3. Les deux séries dans la même base
nouvelle_base ensemble
rejouer ensemble "App et pilotage ensemble"
