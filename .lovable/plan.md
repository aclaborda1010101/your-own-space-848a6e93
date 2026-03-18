

## Plan: Borrar tareas y anadir popup de sugerencias inteligentes en la pagina de Tareas

### 1. Borrar todas las tareas existentes

Ejecutar un DELETE sobre la tabla `tasks` para el usuario actual. Esto se hara via la herramienta de insercion de datos.

### 2. Anadir seccion "Tareas Sugeridas" en la pagina de Tareas

En la pagina `src/pages/Tasks.tsx`, anadir un boton junto al header que muestre el count de sugerencias pendientes (de tipo tarea: `task_from_plaud`, `missing_task`, `urgency_alert`, `forgotten_followup`). Al hacer click, abre un Dialog/popup con la lista de sugerencias filtradas solo por tipos de tarea.

**Componente nuevo**: `src/components/tasks/SuggestedTasksDialog.tsx`
- Usa `useSuggestions` pero filtra solo sugerencias de tipo tarea (excluye eventos, oportunidades, contactos)
- Muestra cada sugerencia con: titulo, descripcion, fuente (WhatsApp/Email/Plaud), prioridad
- Dos botones por sugerencia: Aprobar (crea tarea real) / Descartar (marca como rejected)
- Badge con count en el boton del header

**Cambios en `src/pages/Tasks.tsx`**:
- Importar el nuevo dialog
- Anadir boton "Sugerencias" con badge de count junto a los botones Hoy/Semana
- Estado para abrir/cerrar el dialog

**Cambios en `src/hooks/useSuggestions.tsx`**:
- Anadir filtro opcional por tipos de sugerencia para poder filtrar solo task-related suggestions
- O simplemente filtrar en el componente (mas simple)

### Estructura del popup

```text
┌─────────────────────────────────────────────┐
│ Tareas Sugeridas                    [X]     │
│ Extraidas de WhatsApp, Email y Plaud        │
├─────────────────────────────────────────────┤
│ ⚡ Enviar propuesta a Carlos       [high]   │
│    Fuente: WhatsApp · "te mando la..."      │
│    [Aprobar ✓]  [Descartar ✕]               │
├─────────────────────────────────────────────┤
│ 📋 Revisar contrato ABC            [medium] │
│    Fuente: Email · "adjunto el contrato..." │
│    [Aprobar ✓]  [Descartar ✕]               │
└─────────────────────────────────────────────┘
```

### Archivos
- **Borrar datos**: DELETE de tasks via herramienta
- **Crear**: `src/components/tasks/SuggestedTasksDialog.tsx`
- **Editar**: `src/pages/Tasks.tsx` (anadir boton + dialog)

