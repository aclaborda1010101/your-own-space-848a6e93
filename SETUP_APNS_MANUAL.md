# Setup APNs Manual - JARVIS iOS

**Datos obtenidos:**
- ✅ Key ID: `LK5KA3BF68`
- ✅ Team ID: `KLXF6GTQ85`
- ✅ Archivo .p8: guardado en `~/clawd/pure-logic-flow/keys/AuthKey.p8`

---

## PASO 1: Configurar Secrets en Supabase (5 min)

### 1.1. Acceder a Supabase
URL: https://supabase.com/dashboard/project/xfjlwxssxfvhbiytcoar/settings/functions

### 1.2. Scroll a "Function Secrets"

### 1.3. Agregar 5 secrets (click "+ Add new secret"):

**Secret 1:**
- Name: `APNS_KEY_ID`
- Value: `LK5KA3BF68`

**Secret 2:**
- Name: `APNS_TEAM_ID`
- Value: `KLXF6GTQ85`

**Secret 3:**
- Name: `APNS_KEY`
- Value: `MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgyzJzGAoq7PD9VWlXFCTomBTRfhME9tNiUQJEhRwMBbugCgYIKoZIzj0DAQehRANCAAT5aTlegcehA7dTr9RrhXwGmID6wwi8xoOnnQlXy9LUkwNDZbMsEerhSXdqgAccJUbsyYt/+j7xRHUQPLyoj6+h`

**Secret 4:**
- Name: `APNS_BUNDLE_ID`
- Value: `com.maniasstudio.jarvis`

**Secret 5:**
- Name: `APNS_ENDPOINT`
- Value: `https://api.sandbox.push.apple.com`

### 1.4. Click "Save" en cada uno

---

## PASO 2: Aplicar Migration BD (5 min)

### 2.1. Acceder a SQL Editor
URL: https://supabase.com/dashboard/project/xfjlwxssxfvhbiytcoar/sql/new

### 2.2. Copiar y ejecutar SQL
Abrir archivo: `~/clawd/pure-logic-flow/supabase/migrations/user_devices.sql`

Copiar TODO el contenido y pegarlo en SQL Editor.

Click **RUN**.

Debe crear:
- Tabla `user_devices`
- 4 policies RLS
- Trigger `updated_at`

---

## PASO 3: Deploy Edge Function (2 min)

```bash
cd ~/clawd/pure-logic-flow
npx supabase login
npx supabase link --project-ref xfjlwxssxfvhbiytcoar
npx supabase functions deploy send-push-notification
```

Si pide token, generar aquí: https://supabase.com/dashboard/account/tokens

---

## PASO 4: Configurar Xcode (10 min)

### 4.1. Abrir proyecto
```bash
cd ~/clawd/pure-logic-flow
npx cap open ios
```

### 4.2. En Xcode - Target "App"
1. Click en target **App** (azul, arriba en la lista)
2. Tab **"Signing & Capabilities"**

### 4.3. Configurar Team
- **Team:** Seleccionar tu equipo (debería aparecer con KLXF6GTQ85)

### 4.4. Agregar Push Notifications
1. Click **"+ Capability"** (arriba izquierda)
2. Buscar: **"Push Notifications"**
3. Double click para agregar
4. Aparecerá en la lista (sin configuración adicional)

### 4.5. Agregar Background Modes
1. Click **"+ Capability"** otra vez
2. Buscar: **"Background Modes"**
3. Double click
4. Habilitar (☑️):
   - **Remote notifications**
   - **Background fetch**

### 4.6. Verificar Bundle ID
- Debe ser: `com.maniasstudio.jarvis`
- Si dice "Automatically manage signing": ✅ OK

---

## PASO 5: Integrar servicio en App (2 min)

### 5.1. Editar src/App.tsx (o main.tsx)

Agregar al inicio:
```typescript
import { PushNotificationService } from './services/pushNotifications'
```

Agregar en useEffect (o componentDidMount):
```typescript
useEffect(() => {
  // Inicializar push notifications
  PushNotificationService.initialize()
}, [])
```

### 5.2. Rebuild
```bash
cd ~/clawd/pure-logic-flow
npm run build
npx cap sync ios
```

---

## PASO 6: Test en dispositivo físico (15 min)

### 6.1. Conectar iPhone/iPad via USB

### 6.2. En Xcode
- Selector de dispositivo (arriba): Seleccionar tu iPhone/iPad
- Click **▶️ Play** (o Cmd+R)

### 6.3. Primera ejecución
- Si pide "Trust Computer" en iPhone → Confiar
- Si pide permisos notificaciones → Permitir

### 6.4. Verificar en logs
Xcode Debug Console debería mostrar:
```
Push registration success, token: xxxx...
Token sent to backend: true
```

### 6.5. Verificar en BD
SQL Editor:
```sql
SELECT * FROM user_devices;
```
Debe aparecer 1 fila con tu device_token.

---

## PASO 7: Test de notificación manual (5 min)

### 7.1. Copiar device_token de la BD

### 7.2. Ejecutar desde terminal:
```bash
curl -X POST \
  "https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/send-push-notification" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY0MjgwNSwiZXhwIjoyMDg1MjE4ODA1fQ.x2tP1uZhU_F2Jr1PPqw5OpeBKiSb80SHpErp17wrcAw" \
  -H "Content-Type: application/json" \
  -d '{
    "device_token": "TU_DEVICE_TOKEN_AQUI",
    "title": "🤖 Jarvis",
    "body": "Primera notificación IA proactiva!",
    "badge": 1
  }'
```

### 7.3. Verificar
- Debería llegar notificación al iPhone/iPad
- Si no llega: revisar logs de Edge Function

---

## ✅ CHECKLIST COMPLETO

- [ ] 5 secrets configurados en Supabase
- [ ] Migration BD ejecutada (user_devices creada)
- [ ] Edge Function deployed
- [ ] Xcode: Push Notifications capability
- [ ] Xcode: Background Modes capability
- [ ] Código integrado (PushNotificationService.initialize())
- [ ] Build & Run en dispositivo físico
- [ ] Device token registrado en BD
- [ ] Test manual de notificación funcionando

---

## 🎯 SIGUIENTE: TestFlight

Una vez todo funcione:
1. App Store Connect → New App
2. Xcode → Product → Archive
3. Distribute → App Store Connect
4. TestFlight → Agregar testers

---

**Tiempo total:** 45-60 minutos

**Estado actual:** Listo para ejecutar paso a paso
