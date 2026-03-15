

# Plan: Importación server-side de WhatsApp Backup CSV

## Diagnóstico del problema actual

La función `storeContactMessages` re-parsea el CSV completo (393K líneas) **por cada chat** (844 veces), resultando en ~332 millones de iteraciones de línea. Además, no actualiza `importProgress`, por lo que "chats importados" sube pero "mensajes almacenados" queda en 0. El navegador se bloquea o timeout antes de completar.

## Solución: Edge Function `import-whatsapp-backup`

Mover todo el procesamiento pesado al servidor. El frontend solo sube el archivo y muestra progreso via polling.

### Componentes

#### 1. Nueva tabla `import_jobs`

```sql
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT 'whatsapp_backup',
  status text NOT NULL DEFAULT 'pending', -- pending, processing, done, error
  file_name text,
  total_chats int DEFAULT 0,
  processed_chats int DEFAULT 0,
  messages_stored int DEFAULT 0,
  messages_failed int DEFAULT 0,
  contacts_created int DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own jobs" ON public.import_jobs FOR ALL USING (user_id = auth.uid());
```

#### 2. Edge Function `import-whatsapp-backup`

- Recibe: `{ job_id, csv_text }` (el CSV como texto, o la referencia en Storage)
- Parsea el CSV una sola vez con `parseCSVFields` + `detectBackupColumns` (lógica portada del frontend)
- Pre-agrupa todos los mensajes por `chatName` en un Map (1 pasada)
- Para cada chat: crea/encuentra contacto, inserta mensajes en lotes de 500
- Actualiza `import_jobs` con progreso cada N chats
- Si se acerca al timeout de 60s, persiste estado y se auto-reinvoca para continuar
- Patrón de auto-invocación: guarda `last_processed_chat_index` en `import_jobs.metadata` y continúa

#### 3. Frontend (`DataImport.tsx`)

- Al pulsar "Importar": sube CSV a Storage (bucket `import-files`), crea `import_jobs` row, invoca la Edge Function fire-and-forget
- Muestra panel de progreso con polling cada 2s a `import_jobs` (lee `processed_chats`, `messages_stored`, etc.)
- El usuario puede navegar a otra página; al volver a `/data-import`, detecta jobs activos y muestra progreso
- Al completar (`status = 'done'`), muestra resumen final

#### 4. Optimización clave del parser

En la Edge Function, el CSV se parsea **una sola vez** y los mensajes se agrupan por chatName en un `Map<string, Message[]>`. Esto elimina el problema O(N×M) actual.

### Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Crear tabla `import_jobs` + RLS + Storage bucket `import-files` |
| `supabase/functions/import-whatsapp-backup/index.ts` | Nueva Edge Function con parser, inserción batch, auto-reinvocación |
| `supabase/config.toml` | Añadir `[functions.import-whatsapp-backup]` con `verify_jwt = false` |
| `src/pages/DataImport.tsx` | Reemplazar lógica de backup import: subir a Storage → crear job → polling → mostrar progreso |

### Flujo de auto-reinvocación (timeout handling)

```text
Frontend ──POST──> import-whatsapp-backup (job_id, start_index=0)
                    ├── Procesa chats 0..99 (~50s)
                    ├── Actualiza import_jobs (processed_chats=100)
                    └── Auto-invoca: import-whatsapp-backup (job_id, start_index=100)
                         ├── Procesa chats 100..199
                         └── ... hasta completar
```

### Detalle de la Edge Function

- Usa `createClient` con service role key para acceso completo
- Valida auth via `getClaims()`
- Implementa el mismo matching de contactos que el frontend (`matchContactByName`)
- Soporta grupos (múltiples speakers → múltiples contactos)
- Actualiza `wa_message_count`, `last_contact`, `metadata.groups` como hace el frontend actual

