#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PGBIN:-}" ]]; then
  if command -v initdb >/dev/null; then
    PGBIN="$(dirname "$(command -v initdb)")"
  elif command -v pg_config >/dev/null; then
    PGBIN="$(pg_config --bindir)"
  elif command -v brew >/dev/null; then
    PGBIN="$(brew --prefix postgresql@16)/bin"
  fi
fi
if [[ ! -x "${PGBIN:-}/initdb" ]]; then
  printf 'Install PostgreSQL locally or set TEST_DATABASE_URL for a dedicated migrated test database.\n' >&2
  exit 1
fi

tempdir="$(mktemp -d)"
port="$(node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
trap '"$PGBIN/pg_ctl" -D "$tempdir/db" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$tempdir"' EXIT
"$PGBIN/initdb" -D "$tempdir/db" -U postgres -A trust --no-locale --encoding=UTF8 >/dev/null
"$PGBIN/pg_ctl" -D "$tempdir/db" -l "$tempdir/postgres.log" -o "-h 127.0.0.1 -p $port -k $tempdir" -w start >/dev/null
"$PGBIN/createdb" -U postgres -h 127.0.0.1 -p "$port" rtc_test
"$PGBIN/psql" -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 -p "$port" -d rtc_test -f db/local-role.sql >/dev/null
export MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:$port/rtc_test"
export TEST_DATABASE_URL="postgresql://rtc_app@127.0.0.1:$port/rtc_test"
export RTC_RUNTIME_ROLE=rtc_app
npm run db:setup
npm test
