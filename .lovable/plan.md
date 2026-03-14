

## Problem

The JARVIS agent is a **text-only LLM** — it has no ability to execute actions. When you ask "agéndame X," it generates text saying "hecho" but never actually calls the iCloud calendar API. It's hallucinating actions.

## Solution: Add Tool/Function Calling to jarvis-agent

Give the agent real "tools" it can invoke via the LLM's function-calling capability. When the LLM decides to use a tool, the edge function intercepts the tool call, executes it server-side, and returns the result to the LLM for a natural confirmation.

### Tools to implement

1. **`create_calendar_event`** — Calls the `icloud-calendar` edge function internally (server-to-server) with `action: "create"`
2. **`create_task`** — Inserts into the `tasks` table
3. **`complete_task`** — Updates `completed = true` on a task
4. **`list_today_events`** — Calls `icloud-calendar` with `action: "fetch"` for today

### Architecture (jarvis-agent edge function)

```text
User message
    ↓
LLM (with tools defined)
    ↓
Tool call detected? ──yes──→ Execute tool (DB insert / fetch icloud-calendar)
    │                              ↓
    │                        Return result to LLM
    │                              ↓
    no                       LLM generates final response with confirmation
    ↓
Stream text response
```

### Changes

**File: `supabase/functions/jarvis-agent/index.ts`**

1. Define tools array for the LLM request (Gemini supports OpenAI-compatible function calling):
   - `create_calendar_event(title, date, time, duration?, location?, description?)`
   - `create_task(title, priority?, due_date?, type?)`
   - `complete_task(task_id)`

2. After the first LLM call, check if response contains `tool_calls`. If so:
   - Execute the tool (e.g., fetch the `icloud-calendar` function internally using service role + user credentials from `user_integrations`)
   - Send the tool result back to the LLM in a second call
   - Stream that final response to the user

3. For `create_calendar_event`: load iCloud credentials from `user_integrations` table, then call the icloud-calendar edge function server-to-server.

4. For `create_task`: insert directly into the `tasks` table using the service client.

5. Add calendar events to the context in `buildContext` — fetch today's events from iCloud so the agent knows what's already scheduled.

### System prompt update

Add to SYSTEM_PROMPT:
- "Tienes herramientas reales para crear eventos en calendario y tareas. SIEMPRE usa las herramientas cuando te pidan crear, agendar, o completar algo. NUNCA digas que lo hiciste si no usaste la herramienta."

### Files touched
- `supabase/functions/jarvis-agent/index.ts` — major refactor to add tool calling loop + tool execution functions

