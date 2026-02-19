

# Fase 4: Reprocess completo + eliminar limites de IMAP

## Diagnostico actual

Tras revisar `email-sync/index.ts`:

### Gmail: SIN PROBLEMAS
- Query: `newer_than:365d` (12 meses)
- `maxResults: 500` (maximo por pagina)
- Paginacion completa con `nextPageToken` en bucle `do...while`
- Gmail ya descarga TODO el historico disponible

### IMAP (IONOS): LIMITADO A 50 EMAILS
- Fecha: 365 dias (correcto)
- **Linea 380**: `if (count >= IMAP_BATCH_SIZE) break;` con `IMAP_BATCH_SIZE = 50`
- Solo procesa los primeros 50 emails del resultado IMAP y descarta el resto
- No hay paginacion entre invocaciones
- Los 42 emails de IONOS probablemente son todos los que cabian en ese limite

### Upsert: NO ACTUALIZA EXISTENTES
- **Linea 905**: `ignoreDuplicates: true`
- Si un email ya existe (por `message_id`), NO se actualiza con el body nuevo
- El reprocess no serviria de nada sin cambiar esto

### Outlook: 20 emails sin paginacion
- `$top=20`, sin `nextLink` -- pero Outlook esta desactivado, no es prioritario

## Cambios necesarios

### 1. Eliminar limite de IMAP (linea 380)

Cambiar `IMAP_BATCH_SIZE = 50` por un limite mucho mas alto o eliminarlo. El problema es que IMAP es lento y la edge function tiene timeout de ~150s.

Solucion: subir `IMAP_BATCH_SIZE` a 500 y anadir un mecanismo de "has_more":
- Si hay mas de 500 emails, procesar 500 y retornar `{ hasMore: true, processed: 500 }` para que se re-invoque

### 2. Anadir action "reprocess" al handler (tras linea 942)

Nuevo bloque que:
1. Busca cuentas activas del usuario
2. Guarda `last_sync_at` original de cada cuenta
3. Setea `last_sync_at = null` temporalmente (forzar 365d de historico)
4. Ejecuta sync normal (que ya usa `format=full` y body IMAP)
5. Usa `ignoreDuplicates: false` en el upsert para actualizar rows existentes
6. Restaura `last_sync_at` al valor original

### 3. Cambiar upsert en modo reprocess

En el bloque de reprocess, el upsert usa `ignoreDuplicates: false` para que los 138 emails existentes se actualicen con `body_text`, `cc_addr`, `thread_id`, `signature_parsed`, etc.

## Detalle tecnico

### Cambios en email-sync/index.ts:

```text
Linea 52: IMAP_BATCH_SIZE = 50 --> 500
Linea 380: Mantener el break pero con el nuevo limite
Lineas 942+: Nuevo bloque "reprocess":
  - Reutiliza la logica de sync existente
  - Override de last_sync_at a null
  - Override de upsert a ignoreDuplicates: false
  - Log del total reprocesado
  - Retorna { hasMore } si IMAP excede el batch
```

### Flujo de ejecucion:

```text
POST email-sync { action: "reprocess", user_id: "..." }
  |
  |--> Para cada cuenta activa:
  |      1. Guardar last_sync_at original
  |      2. Setear last_sync_at = null
  |      3. Gmail: fetchGmailMessages() con newer_than:365d + paginacion completa
  |      4. IMAP: fetchMessagesSince() con 365d + limite 500
  |      5. Upsert con ignoreDuplicates: false (ACTUALIZA existentes)
  |      6. Restaurar last_sync_at original
  |
  |--> Retorna { results: [...], hasMore: bool }
```

### Pre-clasificacion durante reprocess:

Todos los emails pasan por `preClassifyEmail()` antes del upsert, asi los newsletters y notificaciones se marcan correctamente. `email-intelligence` los ignorara cuando procese.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/email-sync/index.ts` | Subir IMAP_BATCH_SIZE a 500, anadir action "reprocess" con upsert actualizando existentes |

## Resultado esperado

- Gmail: descargara TODOS los emails del ultimo ano (potencialmente cientos o miles), no solo 96
- IONOS/IMAP: descargara hasta 500 por invocacion en vez de 50
- Los 138 emails existentes se actualizaran con body completo, firmas, thread_id, etc.
- Despues, `email-intelligence` podra procesar todos los personales

