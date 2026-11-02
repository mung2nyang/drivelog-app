#!/usr/bin/env bash
# 로컬 Supabase에 운영 구조(시작점 + 0032 이후 변경)를 만들고 DB 시험을 하나씩 돌린다.
set -euo pipefail

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
BASELINE_UPTO=31

run_sql() {
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$1"
}

for file in supabase/baseline/*.sql; do
  echo "시작점: $file"
  run_sql "$file"
done

for file in supabase/migrations/*.sql; do
  number=$(basename "$file")
  number=${number%%_*}
  if [ "$((10#$number))" -gt "$BASELINE_UPTO" ]; then
    echo "변경: $file"
    run_sql "$file"
  fi
done

for file in supabase/tests/*.sql; do
  echo "시험: $file"
  run_sql "$file"
done
