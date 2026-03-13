

# Plan: Chat flotante compacto, proactivo y conectado a agentes

## Resumen

Transformar el chat flotante de POTUS de un Drawer a pantalla completa a un **widget compacto tipo popup** (estilo Intercom/Crisp) que:
- Se abre en pequeño (400x500px aprox) en la esquina inferior derecha
- Puede abrirse solo de forma proactiva (sistema lo controla)
- Ejecuta tareas dentro del sistema (crear tareas, navegar, cambiar estado)
- Conecta con todos los agentes via Supabase Realtime

## Cambios

### 1. `src/components/potus/PotusFloatingChat.tsx` — Rediseño completo

Reemplazar el `Drawer` por un **popup compacto posicionado fixed** en la esquina inferior derecha:
- Dimensiones: ~380px ancho x 500px alto (responsive en mobile)
- Animación slide-up al abrir
- Header mínimo con nombre del agente activo + estado de conexión
- Chat simplificado (sin la Card de header de `PotusChatMvp`)
- Input compacto integrado
- Notificación/badge de mensajes proactivos en el botón FAB

### 2. `src/hooks/usePotusProactive.ts` — Nuevo hook para mensajes proactivos

- Suscripción a Supabase Realtime en canal `potus-proactive` (broadcast)
- También escucha inserts en `conversation_history` donde `agent_type = 'potus'` y `role = 'assistant'`
- Cuando llega un mensaje proactivo: abre el chat automáticamente y muestra el mensaje
- Expone `proactiveMessage`, `dismiss()`, `hasUnread`

### 3. `src/hooks/usePotusActions.ts` — Nuevo hook para ejecutar acciones del sistema

El chat puede ejecutar acciones reales parseando la respuesta del backend o via tool-calling:
- `createTask(title, priority)` → insert en `todos`
- `navigateTo(route)` → `useNavigate`
- `restartAgent(nodeId)` → llama a `openclaw-ops`
- `getAgentStatus()` → lee estado de agentes
- `markTaskDone(taskId)` → update en `todos`

### 4. `src/hooks/usePotusAgentSync.ts` — Nuevo hook para estado de agentes en tiempo real

- Canal Supabase Realtime `openclaw-agents` (broadcast/presence)
- Mantiene mapa de estado: `{ potus: 'healthy', jarvis: 'running', ... }`
- El backend (potus-core o bridge) emite heartbeats
- El widget muestra indicadores de estado de los agentes conectados

### 5. `src/components/potus/PotusCompactChat.tsx` — Nuevo componente de chat compacto

UI compacta para el popup:
- Lista de mensajes con scroll (sin las Cards/Badges de `PotusChatMvp`)
- Renderizado markdown con `react-markdown`
- Indicador de agente activo (POTUS/JARVIS/ATLAS/TITAN) con dot de color
- Botones de acción inline cuando el mensaje contiene acciones ejecutables
- Input con placeholder contextual

### 6. `supabase/functions/potus-core/index.ts` — Ampliar con tool-calling

Añadir al system prompt capacidad de emitir acciones estructuradas:
- El response incluye un campo `actions?: Array<{type, params}>` opcional
- Tipos: `create_task`, `navigate`, `agent_command`, `notify`
- El frontend parsea y ejecuta las acciones

## Ficheros

| Fichero | Acción |
|---|---|
| `src/components/potus/PotusFloatingChat.tsx` | Reescribir: popup compacto + proactivo |
| `src/components/potus/PotusCompactChat.tsx` | Crear: UI de chat compacta |
| `src/hooks/usePotusProactive.ts` | Crear: suscripción realtime proactiva |
| `src/hooks/usePotusActions.ts` | Crear: ejecución de acciones del sistema |
| `src/hooks/usePotusAgentSync.ts` | Crear: estado de agentes en tiempo real |
| `supabase/functions/potus-core/index.ts` | Ampliar: tool-calling + acciones |

## Flujo

```text
Usuario/Sistema
      │
      ▼
┌─────────────┐     Supabase Realtime      ┌──────────────┐
│  FAB Button  │◄──── broadcast ────────────│  potus-core   │
│  (badge: 1)  │     "potus-proactive"      │  (backend)    │
└──────┬──────┘                             └──────┬───────┘
       │ click / auto-open                         │
       ▼                                           │
┌─────────────────┐    invoke()              ┌─────┴────────┐
│ Compact Popup    │──────────────────────────│  openclaw-ops │
│ 380x500px        │    actions[]             │  (restart,    │
│ - chat messages  │◄─────────────────────────│   status)     │
│ - agent status   │                          └──────────────┘
│ - action buttons │
└─────────────────┘
```

