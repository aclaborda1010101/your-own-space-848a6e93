#!/bin/bash
# Execute SQL via Supabase REST API
# Usage: ./execute_sql_api.sh "SQL QUERY"

SUPABASE_URL="https://xfjlwxssxfvhbiytcoar.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY0MjgwNSwiZXhwIjoyMDg1MjE4ODA1fQ.x2tP1uZhU_F2Jr1PPqw5OpeBKiSb80SHpErp17wrcAw"

SQL_QUERY="$1"

if [ -z "$SQL_QUERY" ]; then
  echo "Error: No SQL query provided"
  echo "Usage: $0 \"SELECT * FROM table\""
  exit 1
fi

curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_QUERY" | jq -Rs .)}"
