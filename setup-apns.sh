#!/bin/bash
set -e

echo "🔐 Configurando APNs en Supabase..."

SUPABASE_PROJECT_ID="xfjlwxssxfvhbiytcoar"
SUPABASE_URL="https://xfjlwxssxfvhbiytcoar.supabase.co"

# Secrets a configurar
APNS_KEY_ID="LK5KA3BF68"
APNS_TEAM_ID="KLXF6GTQ85"
APNS_KEY="MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgyzJzGAoq7PD9VWlXFCTomBTRfhME9tNiUQJEhRwMBbugCgYIKoZIzj0DAQehRANCAAT5aTlegcehA7dTr9RrhXwGmID6wwi8xoOnnQlXy9LUkwNDZbMsEerhSXdqgAccJUbsyYt/+j7xRHUQPLyoj6+h"
APNS_BUNDLE_ID="com.maniasstudio.jarvis"
APNS_ENDPOINT="https://api.sandbox.push.apple.com"

echo "📋 Secrets a configurar:"
echo "  - APNS_KEY_ID: $APNS_KEY_ID"
echo "  - APNS_TEAM_ID: $APNS_TEAM_ID"
echo "  - APNS_BUNDLE_ID: $APNS_BUNDLE_ID"
echo "  - APNS_ENDPOINT: $APNS_ENDPOINT"
echo ""

echo "⚠️  NOTA: Los secrets deben configurarse manualmente en Supabase Dashboard:"
echo "  URL: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/settings/functions"
echo ""
echo "  Agregar estos 4 secrets:"
echo "  1. APNS_KEY_ID = $APNS_KEY_ID"
echo "  2. APNS_TEAM_ID = $APNS_TEAM_ID"
echo "  3. APNS_KEY = $APNS_KEY"
echo "  4. APNS_BUNDLE_ID = $APNS_BUNDLE_ID"
echo "  5. APNS_ENDPOINT = $APNS_ENDPOINT"
echo ""

read -p "¿Has configurado los secrets? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Configura los secrets primero y vuelve a ejecutar este script"
    exit 1
fi

echo ""
echo "📊 Aplicando migration BD (user_devices)..."
psql "$DATABASE_URL" -f supabase/migrations/user_devices.sql 2>/dev/null || echo "⚠️  Aplica la migration manualmente en Supabase SQL Editor"

echo ""
echo "🚀 Desplegando Edge Function..."
npx supabase functions deploy send-push-notification --project-ref $SUPABASE_PROJECT_ID

echo ""
echo "✅ Setup completado!"
echo ""
echo "📱 Siguiente paso: Build en Xcode"
echo "   cd ~/clawd/pure-logic-flow"
echo "   npx cap open ios"
echo ""
echo "   En Xcode:"
echo "   1. Target 'App' → Signing & Capabilities"
echo "   2. Agregar: Push Notifications"
echo "   3. Agregar: Background Modes → Remote notifications"
echo "   4. Build & Run en dispositivo físico"
