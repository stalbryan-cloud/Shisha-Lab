#!/usr/bin/env bash
# Apply stub + migrations to a throwaway database and run the SQL tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-shisha_lab_test}"
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/00_supabase_stub.sql 2>&1 | grep -v NOTICE || true
for f in migrations/*.sql; do echo "applying $f"; $P -f "$f"; done
for t in tests/*.test.sql; do echo "running $t"; psql -q -t -A -d $DB -f "$t" 2>&1 | grep -E "NOTICE|ERROR|FAIL|finished" | sed -E 's/^psql:[^ ]+ //'; done
# tests run against an empty schema; the seed is applied afterwards
if [ -f seed.sql ]; then echo "applying seed.sql"; $P -f seed.sql; fi
