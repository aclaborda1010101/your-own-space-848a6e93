
Pauso lote estético. Ejecuto **OpenClaw Hub funcional** ahora.

## Diagnóstico rápido
Ya existen tablas reales: `cloudbot_nodes`, `cloudbot_tasks_log`, hook `useOpenClawData`, edge `openclaw-ops`. Falta: tareas recurrentes, logs por ejecución, crear tarea manual desde UI, tokens por nodo, seed POTUS/TITAN, página `/openclaw/hub` viva.

## Plan de ejecución

### 1. Migración DB (nueva tabla + columnas)
- `cloudbot_recurring_tasks` (id, user_id, title, description, target_node, schedule_cron, schedule_label, priority, enabled, last_run_at, next_run_at, created_at).
- `cloudbot_task_executions` (id, task_id, node_id, started_at, finished_at, status, output, tokens_used, model_used, error).
- Añadir columna `tokens_total` y `tokens_today` a `cloudbot_nodes` (jsonb `usage_stats`).
- RLS: lectura abierta autenticados, escritura solo owner (recurring) / service_role (executions).
- Seed: upsert POTUS y TITAN con metadata real.

### 2. Hook nuevo `useOpenClawHub`
- Carga nodos (filtrados a POTUS+TITAN), tareas activas, tareas recurrentes, ejecuciones recientes.
- Realtime en las 4 tablas.
- Acciones: `createTask`, `createRecurringTask`, `toggleRecurring`, `deleteRecurring`, `executeNow`.

### 3. Página `/openclaw/hub` (rebuild)
Sustituye el panel mock actual por:
- **Header**: 2 nodos (POTUS · TITAN) como cards con: status dot online/offline, last seen, modelo activo, tokens hoy/total, queue.
- **Tab "Tareas"**: lista cloudbot_tasks_log filtrable + botón "Nueva tarea" → modal (título, nodo destino, prioridad, descripción).
- **Tab "Recurrentes"**: lista de recurring_tasks con toggle on/off, badge schedule, botón "Ejecutar ahora", crear nueva.
- **Tab "Logs"**: stream de cloudbot_task_executions más recientes (timestamp, nodo, task, status, tokens, modelo).
- Banner honesto: "Bridge live: pendiente. Tareas se persisten y agendan; ejecución real se conectará con potus-bridge."

### 4. Edge function `openclaw-task-create` (mínima)
- Recibe `{title, node, priority, description, recurring?}`.
- Inserta en cloudbot_tasks_log (status=queued) o en cloudbot_recurring_tasks.
- Crea registro inicial en task_executions cuando se dispara.

### 5. Ruta
- Confirmar que `/openclaw/hub` existe en App.tsx, si no añadirla.
- Eliminar/reemplazar componente mock actual.

## Lo que NO toco
- Lote estético móvil pendiente (lo retomo después).
- potus-core, jarvis-gateway, lógica WHOOP.
- Bridge físico POTUS (queda como adapter listo).

## Entregable final
Resumen estructurado: operativo / seeded / pendiente live.
