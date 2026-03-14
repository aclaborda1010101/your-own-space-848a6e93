

# Plan: OpenClaw Hub Completo con Agente Proactivo (OpenAI API Key)

Ya tienes `OPENAI_API_KEY` configurado como secret en Supabase. Usaremos ese directamente para el chat proactivo con streaming SSE.

## Archivos a crear

### 1. `src/hooks/useOpenClawData.ts` -- Hook de datos reales
- Queries a `cloudbot_nodes` y `cloudbot_tasks_log` via Supabase client
- Suscripcion Realtime a ambas tablas para actualizacion automatica
- Funciones expuestas: `deleteTask(taskId)`, `pauseTask(taskId)`, `createTask(title, priority, agent)`, `changeModel(nodeId, model)`
- `changeModel` escribe en `cloudbot_nodes.metadata` con `pendingModelChange: true` + intenta bridge local como fallback
- Mapea datos de Supabase al formato de tipos existentes (`AgentCardData`, `TaskItem`)
- Fallback a mock data si las tablas estan vacias

### 2. `supabase/functions/openclaw-chat/index.ts` -- Backend del agente proactivo
- Usa `OPENAI_API_KEY` directamente para llamar a `https://api.openai.com/v1/chat/completions`
- Modelo: `gpt-4o` (disponible con API key)
- Streaming SSE: retorna `response.body` directamente al cliente
- Acepta `{ messages, action }` donde action puede ser `proactive_summary` o `chat`
- Para `proactive_summary`: consulta Supabase con `SUPABASE_SERVICE_ROLE_KEY`:
  - `cloudbot_nodes` (estado de agentes)
  - `cloudbot_tasks_log` (tareas activas)
  - `business_projects` (proyectos recientes)
  - `tasks` (tareas personales)
- Inyecta contexto como system prompt en espanol
- Tool-calling con funciones: `cancel_task`, `create_task`, `change_model`
- Manejo de errores 429/401
- CORS headers completos

### 3. `src/components/openclaw/OpenClawChat.tsx` -- Panel de chat proactivo
- Panel lateral desplegable dentro de OpenClaw (boton toggle)
- Streaming token-a-token con `react-markdown` para renderizar respuestas
- Al montar, llama automaticamente a `proactive_summary` y muestra mensaje sin que el usuario pregunte
- Input de texto para chat normal
- Estado: mensajes, isLoading, error
- Manejo de errores 429/402 con toast

### 4. Modificar `src/pages/OpenClaw.tsx`
- Importar y usar `useOpenClawData` en lugar de mock data
- Integrar `OpenClawChat` como panel lateral toggle (boton en header)
- Simplificar `deleteTask`, `handleModelChange`, `togglePause` delegando al hook
- Mantener toda la UI existente de tabs, costes, agentes
- Anadir tab o boton de "Chat" que abre/cierra el panel

### 5. Modificar `supabase/config.toml`
- Anadir `[functions.openclaw-chat]` con `verify_jwt = false`

## Flujo de datos

```text
Usuario abre /openclaw
        │
        ├─► useOpenClawData hook
        │   ├─ query cloudbot_nodes → agentes reales
        │   ├─ query cloudbot_tasks_log → tareas reales
        │   └─ Realtime subscriptions (auto-update)
        │
        └─► OpenClawChat (auto)
            ├─ POST openclaw-chat {action: "proactive_summary"}
            │   ├─ lee cloudbot_nodes, tasks, business_projects
            │   ├─ inyecta contexto en system prompt
            │   └─ OpenAI gpt-4o streaming SSE
            └─ respuesta: "Agustin, tienes 3 tareas pendientes..."
```

## Orden de implementacion

1. Hook `useOpenClawData` + refactor OpenClaw.tsx
2. Edge function `openclaw-chat` con OpenAI streaming
3. Componente `OpenClawChat` con proactividad
4. Integracion final + config.toml

