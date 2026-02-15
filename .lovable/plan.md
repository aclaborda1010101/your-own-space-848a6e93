
# Mejorar aceptacion de sugerencias: clasificacion correcta + eventos al calendario

## Problemas detectados

1. **Tipo de tarea siempre "work"**: Al aceptar una sugerencia de tipo task, el codigo siempre inserta `type: "work"` en la tabla tasks. Tareas familiares como "Cumpleanos de Bosco" o personales se marcan como laborales. Deberia usar el campo `brain` de la transcripcion original (professional -> work, personal -> life, bosco -> life).

2. **Eventos no se procesan al aceptar**: Cuando aceptas una sugerencia de tipo `event`, el sistema solo marca el estado como "accepted" en la tabla pero NO crea ningun evento en el calendario. Solo las sugerencias tipo `task` generan una accion real.

3. **Sin selector de fecha para eventos sin fecha**: Algunas sugerencias de evento tienen fecha en `content.data.date`, pero otras no. El usuario necesita poder elegir la fecha antes de confirmar.

## Solucion

### Paso 1 - Clasificar tipo de tarea segun brain

En los handlers de aceptacion (Inbox.tsx y BrainDashboard.tsx), deducir el tipo de tarea a partir del campo `brain` de la sugerencia o de la transcripcion asociada:

- `brain: "professional"` -> `type: "work"`
- `brain: "personal"` -> `type: "life"`
- `brain: "bosco"` -> `type: "life"`
- Si no hay brain disponible, usar heuristicas del contenido o mantener "work" como fallback

Ademas, leer `content.data.priority` para mapear a P0-P3 en vez de siempre poner P1.

### Paso 2 - Procesar eventos al aceptar sugerencias tipo "event"

Al aceptar una sugerencia tipo `event`:
- Si tiene fecha (`content.data.date`), crear el evento directamente via la edge function `google-calendar` (o icloud-calendar segun el proveedor conectado)
- Si NO tiene fecha, mostrar un dialogo/datepicker para que el usuario elija fecha y hora antes de confirmar

### Paso 3 - Dialogo de fecha para eventos sin fecha

Crear un componente `DatePickerDialog` que se muestre cuando:
- Se acepta una sugerencia tipo `event` y no tiene fecha
- Se acepta una sugerencia tipo `task` y el usuario quiere asignarle due_date

El dialogo muestra titulo del evento, un date picker y opcionalmente hora. Al confirmar, se crea el evento/tarea con la fecha seleccionada.

## Seccion tecnica

### Archivos a modificar

**`src/pages/Inbox.tsx`** y **`src/pages/BrainDashboard.tsx`**:
- Actualizar `updateSuggestion.mutationFn` para manejar `suggestion_type === "event"`
- Inferir `type` (work/life) desde `content.data.brain` o `content.data.category`
- Anadir estado para dialogo de fecha pendiente (`pendingEventSuggestion`)
- Al hacer click en aceptar un evento sin fecha, abrir dialogo en vez de aceptar directamente

**Nuevo componente `src/components/suggestions/AcceptEventDialog.tsx`**:
- Dialog con DatePicker + TimePicker opcinal
- Titulo del evento pre-rellenado
- Boton "Crear evento" que llama a la edge function de calendario
- Maneja tanto Google Calendar como iCloud Calendar segun lo que este conectado

### Logica de clasificacion de tipo de tarea

```text
Al aceptar sugerencia tipo "task":
  1. Leer content.data.brain o content.data.category
  2. Si brain == "professional" o category contiene "ventas/tech/negocio" -> type = "work"
  3. Si brain == "personal" o brain == "bosco" -> type = "life"
  4. Si category contiene "finanzas/inversion" -> type = "finance"
  5. Fallback -> "work"
```

### Flujo al aceptar evento

```text
Click "Aceptar" en sugerencia tipo event
    |
    v
Tiene fecha en content.data.date?
    |-- Si --> Crear evento en calendario directamente
    |          (google-calendar o icloud-calendar)
    |          Marcar sugerencia como accepted
    |
    |-- No --> Abrir AcceptEventDialog
               Usuario elige fecha y hora
               Click "Crear" --> Crear evento en calendario
                                 Marcar sugerencia como accepted
```

### Resultado

- Las tareas se clasifican correctamente como work/life/finance segun el contexto
- Las sugerencias de evento se convierten en eventos reales del calendario
- Si falta la fecha, el usuario puede elegirla antes de confirmar
