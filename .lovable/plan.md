

# Plan: Mejorar diagnóstico y visibilidad del panel WhatsApp Live

## Problemas detectados

1. **Solo muestra mensajes 24h, no total** -- el usuario no sabe cuántos mensajes hay en total, solo ve "0" si no hubo actividad reciente
2. **"Último mensaje" usa `created_at` en vez de `message_date`** -- el webhook Evolution inserta `message_date` con el timestamp real del mensaje. La query ordena por `created_at` (timestamp de inserción en BD), lo que puede mostrar fechas incorrectas
3. **0 de 833 vinculados** -- la mayoría de contactos importados por VCF no tienen `wa_id`. Esto es correcto pero confuso; falta contexto
4. **No hay forma de saber si el webhook está recibiendo mensajes** -- el webhook dice "OK" pero no hay evidencia de actividad reciente

## Cambios en `src/pages/DataImport.tsx`

### 1. Añadir query de total de mensajes WhatsApp
En `loadWaLiveStats`, añadir una 5ta query:
```typescript
// Total mensajes WA (sin filtro de fecha)
supabase.from('contact_messages')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('source', 'whatsapp')
```

### 2. Corregir query de último mensaje: usar `message_date` en vez de `created_at`
```typescript
// Antes: .order('created_at', { ascending: false })
// Después:
.select('message_date')
.order('message_date', { ascending: false })
```

### 3. Ampliar la UI de stats
- Cambiar grid de 3 a 4 columnas (o 2x2):
  - **Total mensajes WA** (nuevo)
  - **Mensajes (24h)** (existente)
  - **Contactos vinculados** (existente, con barra)
  - **Último mensaje** (existente, corregido)

### 4. Añadir sección "Últimos mensajes recibidos" como diagnóstico
Query de los últimos 5 mensajes WhatsApp con `sender`, `message_date` y `content` (truncado). Esto permite verificar de un vistazo que el webhook está funcionando y qué mensajes están llegando.

### 5. Mejorar texto explicativo de cobertura
Cambiar "de X vinculados" por "X contactos con WhatsApp de Y totales" y añadir nota: "Los contactos se vinculan automáticamente cuando se recibe un mensaje de un número conocido."

## Archivo tocado

| Archivo | Cambio |
|---------|--------|
| `src/pages/DataImport.tsx` | Ampliar `loadWaLiveStats` con total de mensajes y últimos 5 mensajes; corregir ordenación por `message_date`; actualizar UI con 4 stats + lista de últimos mensajes |

