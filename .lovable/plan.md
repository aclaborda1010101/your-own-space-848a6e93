
# Sugerencias Proactivas de Plaud: UI de Confirmacion

## Situacion actual

El pipeline backend esta **completo**:
1. Plaud graba audio y envia email a agustin@hustleovertalks.com
2. `email-sync` detecta emails de `plaud.ai` (pre-clasificacion `plaud_transcription`)
3. Automaticamente llama a `plaud-intelligence` que parsea el reporte
4. `plaud-intelligence` crea filas en la tabla `suggestions` con tipos:
   - `task_from_plaud` (tareas detectadas)
   - `event_from_plaud` (citas/reuniones)
   - `opportunity_from_plaud` (oportunidades de negocio)
   - `contact_from_plaud` (datos de contacto)

**Problema**: La tabla `suggestions` tiene 0 filas mostradas en la UI. No existe ningun componente frontend que lea esta tabla ni permita confirmar/rechazar sugerencias.

## Plan de implementacion

### 1. Nuevo componente: SuggestionsCard

Crear `src/components/dashboard/SuggestionsCard.tsx` que:
- Consulte `suggestions` donde `status = 'pending'` al montar
- Muestre cada sugerencia con icono segun tipo (tarea, evento, oportunidad, contacto)
- Botones de **Confirmar** y **Rechazar** por sugerencia
- Al confirmar una tarea: inserte en `tasks` con prioridad mapeada (P0-P2)
- Al confirmar un evento: llame a `useCalendar().createEvent()` con los datos
- Al confirmar una oportunidad: llame a `useProjects().createProject()` con los datos
- Al confirmar un contacto: actualice `people_contacts` con los nuevos datos
- Al rechazar: actualice `status = 'rejected'` en `suggestions`

### 2. Hook: useSuggestions

Crear `src/hooks/useSuggestions.tsx` que encapsule:
- Fetch de sugerencias pendientes
- Logica de aceptar (crear tarea/evento/proyecto segun tipo)
- Logica de rechazar
- Count de pendientes para badge

### 3. Integrar en Dashboard

- Anadir `SuggestionsCard` al Dashboard como una card mas del layout
- Mostrar badge con numero de sugerencias pendientes
- Si hay 0 pendientes, no mostrar la card

### 4. Flujo de confirmacion de eventos

Cuando una sugerencia de tipo `event_from_plaud` no tiene fecha clara:
- Mostrar un mini-formulario inline con selector de fecha/hora antes de confirmar
- Si tiene fecha, mostrarla pre-rellenada para validacion rapida

### 5. Flujo de confirmacion de oportunidades

Cuando se confirma una `opportunity_from_plaud`:
- Crear un `business_project` nuevo con nombre = descripcion, status = "nuevo"
- Pre-rellenar `need_summary` con la necesidad detectada
- Pre-rellenar `estimated_value` si Plaud lo detecto

## Detalles tecnicos

### Tabla suggestions (ya existe)
```text
id: uuid
user_id: uuid
suggestion_type: text (task_from_plaud, event_from_plaud, opportunity_from_plaud, contact_from_plaud)
content: jsonb (datos especificos segun tipo)
status: text (pending, accepted, rejected)
source_transcription_id: uuid
created_at: timestamptz
```

### Mapeo de prioridades Plaud a Tasks
```text
urgent -> P0
high -> P1
medium -> P2
low -> P2
```

### Mapeo de tipo tarea
Se detectara del contenido: si menciona finanzas -> "finance", si menciona familia -> "life", por defecto -> "work"

### Archivos a crear
- `src/hooks/useSuggestions.tsx`
- `src/components/dashboard/SuggestionsCard.tsx`

### Archivos a modificar
- `src/pages/Dashboard.tsx` (importar y renderizar SuggestionsCard)
- `src/hooks/useDashboardLayout.tsx` (anadir 'suggestions' como card disponible si no existe ya)

No se requieren migraciones de base de datos ya que la tabla `suggestions` ya existe con la estructura correcta.
