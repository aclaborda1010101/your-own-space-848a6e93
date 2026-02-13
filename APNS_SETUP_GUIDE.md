# APNs Setup Guide - JARVIS iOS App

**Objetivo:** Habilitar notificaciones push proactivas de la IA

---

## 🔑 PASO 1: Generar APNs Key (Apple Developer)

### 1.1. Acceder a Apple Developer
- URL: https://developer.apple.com/account/resources/authkeys/list
- Iniciar sesión con Apple ID del equipo

### 1.2. Crear nueva Key
1. Click "+" para crear nueva key
2. **Name:** JARVIS Push Notifications
3. **Enable:** Apple Push Notifications service (APNs)
4. Click "Continue" → "Register"
5. **DESCARGAR** el archivo `.p8` (solo se puede descargar UNA VEZ)
6. **Anotar:**
   - Key ID (ej: `P2VYL2J92Y`)
   - Team ID (ej: `KLXF6GTQ85`)

---

## 📱 PASO 2: Configurar App ID

### 2.1. Verificar App ID
- URL: https://developer.apple.com/account/resources/identifiers/list
- Buscar: `com.maniasstudio.jarvis`

### 2.2. Habilitar Push Notifications
1. Click en el App ID
2. **Capabilities** → Buscar "Push Notifications"
3. Si no está habilitado → Habilitar
4. Click "Save"

---

## 🔐 PASO 3: Configurar Xcode Project

### 3.1. Abrir proyecto
```bash
cd ~/clawd/pure-logic-flow
open ios/App/App.xcodeproj
```

### 3.2. Signing & Capabilities
1. Seleccionar target "App"
2. Tab "Signing & Capabilities"
3. **Team:** Seleccionar tu equipo
4. Click "+ Capability"
5. Agregar: **Push Notifications**
6. Agregar: **Background Modes** → Habilitar:
   - Remote notifications
   - Background fetch

### 3.3. Verificar Bundle ID
- Debe ser: `com.maniasstudio.jarvis`

---

## ☁️ PASO 4: Configurar Supabase Secrets

### 4.1. Acceder a Supabase Dashboard
- URL: https://supabase.com/dashboard/project/xfjlwxssxfvhbiytcoar
- Settings → Edge Functions → Secrets

### 4.2. Agregar secrets
```bash
# Key ID (del paso 1.2)
APNS_KEY_ID=P2VYL2J92Y

# Team ID (del paso 1.2)
APNS_TEAM_ID=KLXF6GTQ85

# Contenido del archivo .p8 (sin headers BEGIN/END)
APNS_KEY=MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...

# Bundle ID
APNS_BUNDLE_ID=com.maniasstudio.jarvis

# Endpoint (sandbox para testing, production para live)
APNS_ENDPOINT=https://api.sandbox.push.apple.com
```

### 4.3. Deployar Edge Function
```bash
cd ~/clawd/pure-logic-flow
npx supabase functions deploy send-push-notification
```

---

## 🗄️ PASO 5: Aplicar Migration BD

### 5.1. Ejecutar SQL
- Dashboard: https://supabase.com/dashboard/project/xfjlwxssxfvhbiytcoar/editor
- Copiar contenido de: `supabase/migrations/user_devices.sql`
- Ejecutar en SQL Editor

---

## 📲 PASO 6: Integrar en App

### 6.1. Inicializar en App.tsx (o main entry)
```typescript
import { PushNotificationService } from './services/pushNotifications'

// Dentro de useEffect o componentDidMount
PushNotificationService.initialize()
```

---

## 🧪 PASO 7: Testing

### 7.1. Build & Run en dispositivo físico
```bash
cd ~/clawd/pure-logic-flow
npx cap open ios
```

**NOTA:** Notificaciones push NO funcionan en Simulator, requiere dispositivo físico.

### 7.2. Test manual desde Supabase
```bash
curl -X POST \
  https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "device_token": "TOKEN_DEL_DISPOSITIVO",
    "title": "Test Jarvis",
    "body": "Notificación de prueba"
  }'
```

---

## 🤖 PASO 8: Triggers IA Proactivos

### Ejemplos de triggers automáticos:
- Recordatorio reunión 15 min antes
- Presupuesto al 80%
- Tarea prioritaria no completada
- Sugerencia inteligente según hora del día

### Implementar en Edge Function separada:
```typescript
// supabase/functions/ai-triggers/index.ts
// Cron job o trigger basado en eventos
```

---

## 🚀 PASO 9: TestFlight

### 9.1. App Store Connect
1. https://appstoreconnect.apple.com
2. My Apps → "+" → New App
3. Bundle ID: `com.maniasstudio.jarvis`
4. Name: JARVIS

### 9.2. Archive & Upload
```bash
# En Xcode
Product → Archive
→ Distribute App → App Store Connect
→ Upload
```

### 9.3. TestFlight
1. En App Store Connect → TestFlight
2. Agregar testers (email)
3. Enviar invitaciones

---

## 📋 CHECKLIST COMPLETO

- [ ] APNs Key generada (.p8 descargado)
- [ ] Key ID y Team ID anotados
- [ ] App ID con Push Notifications habilitado
- [ ] Xcode: Push Notifications capability agregada
- [ ] Xcode: Background Modes configurado
- [ ] Supabase secrets configurados (4 variables)
- [ ] Edge Function deployed
- [ ] Migration BD ejecutada (user_devices table)
- [ ] PushNotificationService integrado en app
- [ ] Build en dispositivo físico
- [ ] Test manual funcionando
- [ ] TestFlight configurado
- [ ] Triggers IA implementados

---

**Tiempo estimado:** 2-3 horas (con cuenta Apple Developer activa)

**BLOCKER:** Requiere Apple Developer Program activo ($99/año)
