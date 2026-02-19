

# Pestaña de Email en la pagina de Importacion de Datos

## Resumen

Anadir una quinta pestana "Email" en `/data-import` que permita sincronizar correos electronicos desde las cuentas configuradas en `email_accounts` y ver los ultimos emails sincronizados.

## Estado actual

- Hay 1 cuenta de email configurada: `agustin@hustleovertalks.com` (IMAP, activa)
- Hay 40 emails en `jarvis_emails_cache`
- La edge function `email-sync` ya existe y funciona correctamente
- La pagina tiene 4 pestanas: WhatsApp, Contactos, Audio, Plaud

## Cambios en `src/pages/DataImport.tsx`

### 1. Nuevo estado
- `emailSyncing: boolean` - loading del boton
- `emailList: array` - ultimos 10 emails de `jarvis_emails_cache`
- `emailAccounts: array` - cuentas de email del usuario (para mostrar info)

### 2. Pestana Email
- Cambiar `grid-cols-4` a `grid-cols-5` en TabsList
- Anadir TabsTrigger con icono `Mail` de lucide-react

### 3. Funciones
- `handleEmailSync()`: llama a `supabase.functions.invoke('email-sync', { body: { user_id } })`, muestra toast con resultado, recarga la lista
- `fetchRecentEmails()`: consulta `jarvis_emails_cache` ordenado por `synced_at DESC LIMIT 10`
- `fetchEmailAccounts()`: consulta `email_accounts` para mostrar las cuentas configuradas

### 4. UI del TabsContent "email"
- Card con info de cuentas configuradas (email, proveedor, ultima sincronizacion)
- Boton "Sincronizar Emails" con Loader2 mientras carga
- Lista de los ultimos 10 emails mostrando:
  - Remitente (`from_addr`)
  - Asunto (`subject`)
  - Fecha formateada (`synced_at`)
  - Badge de leido/no leido

### 5. Importacion del icono
- Anadir `Mail` a los imports de lucide-react

## Archivo a modificar

Solo `src/pages/DataImport.tsx`

