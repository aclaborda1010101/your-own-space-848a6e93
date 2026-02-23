

# 4 Bloques: Temporal Fix + Bio-to-Tasks Bridge + SQL Indices + Prompt Enhancement

## Bloque 3: SQL Indices -- YA IMPLEMENTADO

Los 3 indices que pides ya fueron creados en la migración anterior:
- `idx_people_contacts_category` (user_id, category)
- `idx_people_contacts_is_favorite` (user_id) WHERE is_favorite = true
- `idx_people_contacts_personality_gin` GIN (personality_profile)

La tabla `rag_domain_intelligence` tambien ya existe (con esquema flat compatible con el edge function). No se necesita ninguna accion SQL adicional.

---

## Bloque 1: Correccion de duracion_relacion

### Problema actual
La `duracion_relacion` la calcula la IA (Gemini) en el prompt de consolidacion historica (linea 483: `"duracion_relacion": "X anos y Y meses"`). No hay calculo programatico -- depende de que el modelo interprete correctamente `primer_contacto` vs la fecha actual. Esto explica los errores ("1 mes" cuando son anos).

### Solucion
Calcular `duracion_relacion` programaticamente en TypeScript DESPUES de recibir la respuesta de la IA, sobreescribiendo lo que el modelo haya puesto. Tambien proteger que `primer_contacto` no sea sobreescrito durante updates incrementales.

### Cambios en `supabase/functions/contact-analysis/index.ts`:

1. **Nueva funcion helper** `calculateDuration(firstDate: string): string`:
   - Parsea `primer_contacto` (YYYY-MM-DD)
   - Compara con `new Date()`
   - Retorna formato "X anos y Y meses" o "X meses" si menos de 1 ano

2. **Post-procesado en `processHistoricalAnalysis`** (despues de linea 518):
   - Recalcular: `result.duracion_relacion = calculateDuration(result.primer_contacto)`
   - Si `result.primer_contacto` es invalido, usar la fecha del primer mensaje: `allMessages[0]?.message_date`

3. **Proteccion en `updateHistoricalWithNewMessages`** (linea 567):
   - Preservar `existing.primer_contacto` si el modelo lo cambia
   - Recalcular duracion: `result.duracion_relacion = calculateDuration(result.primer_contacto || existing.primer_contacto)`

---

## Bloque 2: Puente Bio-to-Tasks (acciones_pendientes -> tasks)

### Problema actual
- La tabla `tasks` no tiene columna `contact_id` -- no puede vincular tareas a contactos
- El perfil genera `acciones_pendientes` y `proxima_accion` pero nunca se persisten como tareas

### Cambios necesarios:

**SQL Migration:**
- Agregar columna `contact_id UUID REFERENCES people_contacts(id) ON DELETE SET NULL` a la tabla `tasks`
- Indice en `(user_id, contact_id)`

**Edge Function (`contact-analysis/index.ts`):**
Despues de guardar el `personality_profile` (linea 1046), agregar logica de sincronizacion:

```text
Para cada scope en profileByScope:
  1. Leer acciones_pendientes[] del perfil generado
  2. Leer proxima_accion del perfil
  3. Para cada accion:
     - Buscar en tasks WHERE user_id = X AND contact_id = Y AND title ILIKE '%accion%'
     - Si no existe, INSERT con:
       title: accion.accion
       description: proxima_accion.pretexto (si aplica)
       due_date: accion.fecha_sugerida
       contact_id: contact_id
       source: 'ai-analysis'
       type: 'work' (profesional) | 'life' (personal/familiar)
       priority: 'P1'
  4. Log: "Sincronizadas X tareas nuevas para [contacto]"
```

**Frontend (`useTasks.tsx`):**
- Agregar `contactId?: string` y `contactName?: string` al interface Task
- Actualizar `fetchTasks` para incluir `people_contacts(name)` join cuando `contact_id` presente
- Las tareas creadas por la IA aparecen automaticamente en la vista de Tasks

---

## Bloque 4: Refuerzo del Prompt Profesional (Deteccion Empatica)

### Cambio en `PROFESSIONAL_LAYER` (linea 24-54):
Agregar nueva seccion de patrones:

```text
## DETECCION DE ESTRES Y HUMANIDAD -- PRIORIDAD SOBRE PIPELINE
Si detectas palabras como 'ansiedad', 'estres', 'fiebre', 'agotamiento', 
'no puedo mas', 'quemado', 'saturado', 'enfermo' en mensajes del contacto:
- Genera una ALERTA nivel "rojo" tipo "contacto" antes que cualquier alerta de negocio
- La proxima_accion debe ser EMPATICA (preguntar como esta, ofrecer ayuda) 
  ANTES de cualquier seguimiento comercial
- Patron: emoji rojo "Senal de estres detectada" con evidencia y fecha
```

---

## Resumen de archivos afectados

| Archivo | Cambio |
|---------|--------|
| Nueva migracion SQL | ADD COLUMN contact_id + indice en tasks |
| `supabase/functions/contact-analysis/index.ts` | (1) calculateDuration helper, (2) post-proceso duracion, (3) sync acciones->tasks, (4) prompt empatico |
| `src/hooks/useTasks.tsx` | Agregar contactId/contactName al interface + join |
| `src/integrations/supabase/types.ts` | Auto-update por migracion |

## Orden de ejecucion

1. SQL migration (contact_id en tasks)
2. Edge function: calculateDuration + proteccion primer_contacto
3. Edge function: sync acciones_pendientes -> tasks
4. Edge function: prompt empatico en PROFESSIONAL_LAYER
5. Frontend: useTasks con contactId

