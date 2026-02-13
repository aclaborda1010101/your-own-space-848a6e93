# 🎯 SIGUIENTE PASO - JARVIS iOS Push Notifications

**Estado actual:** Keys APNs configurados ✅

---

## 📝 LO QUE NECESITAS HACER (45-60 minutos)

### OPCIÓN A: Guía paso a paso completa
Abrir: `~/clawd/pure-logic-flow/SETUP_APNS_MANUAL.md`

Seguir 7 pasos documentados (con screenshots mentales y comandos exactos).

---

### OPCIÓN B: Resumen rápido

**1. Supabase Secrets (5 min)**
- URL: https://supabase.com/dashboard/project/xfjlwxssxfvhbiytcoar/settings/functions
- Copiar/pegar desde: `SECRETS_COPY_PASTE.txt`
- Agregar 5 secrets

**2. Base de datos (5 min)**
- URL: https://supabase.com/dashboard/project/xfjlwxssxfvhbiytcoar/sql/new
- Copiar SQL desde: `supabase/migrations/user_devices.sql`
- Ejecutar (RUN)

**3. Deploy función (2 min)**
```bash
cd ~/clawd/pure-logic-flow
npx supabase login
npx supabase link --project-ref xfjlwxssxfvhbiytcoar
npx supabase functions deploy send-push-notification
```

**4. Xcode (10 min)**
```bash
npx cap open ios
```
- Target "App" → Signing & Capabilities
- Agregar: Push Notifications
- Agregar: Background Modes → Remote notifications

**5. Build & Test (15 min)**
- Build en iPhone/iPad físico (Cmd+R)
- Permitir notificaciones
- Verificar device token en logs

**6. Test manual (5 min)**
- Copiar device_token de BD
- Ejecutar curl (ver `SETUP_APNS_MANUAL.md` paso 7)

---

## 🤖 RESULTADO FINAL

Una vez completado, la app podrá recibir:
- 📅 Recordatorios inteligentes
- 💰 Alertas financieras
- ✅ Notificaciones de tareas
- 🧠 Sugerencias IA proactivas

---

## 📁 ARCHIVOS DE REFERENCIA

- `SETUP_APNS_MANUAL.md` - Guía completa con todos los detalles
- `SECRETS_COPY_PASTE.txt` - Valores listos para copiar
- `supabase/migrations/user_devices.sql` - SQL migration
- `supabase/functions/send-push-notification/index.ts` - Edge Function

---

**¿Listo para empezar?** Abre `SETUP_APNS_MANUAL.md` y sigue paso a paso.

**¿Necesitas ayuda?** Avisa en qué paso estás y te asisto.
