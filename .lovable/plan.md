

# Dashboards por Brain (Profesional / Personal / Familiar)

## Situacion actual

Ahora mismo, al pulsar "Profesional", "Personal" o "Familiar" en el sidebar, se va a `/contacts?brain=X` que solo muestra una lista de contactos filtrada. Eso no es lo que quieres.

Lo que necesitas es un **dashboard completo por cada brain** que muestre toda la informacion extraida de las transcripciones de ese ambito.

## Que vamos a hacer

### Nueva pagina: `BrainDashboard`

Crear una unica pagina parametrizada `/brain/:brainType` (professional, personal, family) que funcione como dashboard completo. Cada dashboard mostrara:

1. **Conversaciones recientes** - Ultimos hilos de `conversation_embeddings` filtrados por `brain`, con summary, fecha y personas detectadas
2. **Sugerencias pendientes** - De la tabla `suggestions` vinculadas via `source_transcription_id` a transcripciones de ese brain (tareas sugeridas, follow-ups, eventos, ideas)
3. **Compromisos** - De `commitments` vinculados via `source_transcription_id` a ese brain
4. **Follow-ups abiertos** - De `follow_ups` vinculados via `source_transcription_id`
5. **Contactos** - Lista compacta de `people_contacts` filtrada por brain
6. **Temas clave** - Extraidos de los summaries de conversaciones recientes

### Cambios en el Sidebar

Los items "Profesional", "Personal" y "Familiar" cambian su path:
- Profesional: `/brain/professional`
- Personal: `/brain/personal`  
- Familiar: `/brain/family`

"Contactos" sigue en `/contacts` mostrando todos los contactos (CRM general).

### Pagina Contacts sin cambios

`/contacts` se queda como esta: vista general de todos los contactos con tabs, clickables, con dialog de detalle y edicion.

## Detalles tecnicos

### Archivos a crear
1. **`src/pages/BrainDashboard.tsx`** - Pagina principal del dashboard por brain

### Archivos a modificar
1. **`src/components/layout/SidebarNew.tsx`** - Cambiar paths de Profesional/Personal/Familiar a `/brain/X`
2. **`src/App.tsx`** - Agregar ruta `/brain/:brainType` con el nuevo componente

### Estructura del BrainDashboard

La pagina recibe el `brainType` de los params de la URL y hace las siguientes queries:

**Conversaciones** (directo):
```text
conversation_embeddings WHERE brain = :brainType ORDER BY date DESC LIMIT 20
```

**Sugerencias, Compromisos, Follow-ups** (via join con transcripciones):
Como `suggestions`, `commitments` y `follow_ups` tienen `source_transcription_id`, se hace un paso intermedio: primero obtener los IDs de transcripciones de ese brain desde `conversation_embeddings`, y luego filtrar las tablas por esos IDs.

**Contactos** (directo):
```text
people_contacts WHERE brain = :dbBrain
```

### Layout del dashboard

El dashboard se organiza en secciones tipo cards, similar al dashboard principal:
- Card de resumen rapido (total conversaciones, contactos, sugerencias pendientes)
- Card de conversaciones recientes (scrollable, con summary y personas)
- Card de sugerencias pendientes con acciones (aceptar/rechazar)
- Card de follow-ups abiertos
- Card de compromisos activos
- Card de contactos del brain (lista compacta, clickable al dialog de detalle)

### Mapeo brain family a bosco

Se mantiene la logica existente: el sidebar usa "family" pero en la base de datos el valor es "bosco". La pagina hace la conversion automaticamente.

### Sin cambios de esquema

Todas las tablas ya existen con la estructura necesaria. No se requieren migraciones.
