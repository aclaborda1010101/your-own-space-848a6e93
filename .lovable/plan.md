

## Lo que voy a hacer

### 1. Transcripción con Groq (ya casi hecho, solo unificar)
La función principal `speech-to-text` **ya usa Groq `whisper-large-v3`** (rápido y barato). Lo que queda:
- Unificar `jarvis-stt` (que aún usa OpenAI `whisper-1`) para que también use Groq.
- Migrar también el STT de transcripción dentro de la sesión Realtime de OpenAI: cambiar `transcription: { model: "whisper-1" }` por `gpt-4o-mini-transcribe` (el actual de OpenAI Realtime, mucho más rápido que whisper-1, ya que dentro de la sesión Realtime no podemos meter Groq directamente — es OpenAI quien transcribe internamente).
- Resultado: toda la transcripción del chat será rápida (Groq) y la transcripción interna de la voz en tiempo real también será rápida (modelo nuevo de OpenAI).

### 2. Voz masculina para JARVIS Realtime
Cambiar la voz `alloy` por una voz masculina del catálogo OpenAI Realtime. Opciones masculinas reales:
- `ash` — masculina, tono cálido, ideal mayordomo (mi recomendación)
- `verse` — masculina, expresiva
- `ballad` — masculina, británica seria
- `echo` — masculina, neutra

Voy a poner `ash` por defecto y dejar la voz **configurable** (UI con selector dentro del chat de JARVIS) para que pueda probar y elegir en caliente.

### 3. Por qué se queda colgado al pedir "analiza la relación con X"
Causa raíz que veo en el código:
- Cuando preguntas por una relación, JARVIS llama a `search_contacts` (bien). Pero después necesita tirar del histórico de mensajes/transcripciones de esa persona y no tiene una función específica para eso, así que cae en `query_table` o se queda esperando → el watchdog tarda 4.5s en reaccionar y a veces se atasca.
- Además la sesión Realtime tiene un watchdog corto pero **no hay timeout para `executeFunction`**: si una invocación a una edge function (ej. `ask_specialist`) tarda 2 minutos, JARVIS se queda mudo.

Arreglo:
- Añadir nueva tool `analyze_contact_relationship(name)` que en el cliente:
  1. Resuelve el contacto (fuzzy).
  2. Trae en paralelo: últimos mensajes WhatsApp con ese número, emails con ese email, transcripciones donde aparezca el nombre, notas/observaciones del contacto, last_interaction.
  3. Devuelve un dossier compacto al modelo.
- Envolver `executeFunction` en un **timeout de 12s**: si una tool tarda más, devuelve `{ error: "timeout" }` al modelo y libera el turno → nunca más silencio de 2 minutos.
- Recortar el watchdog de respuesta para forzar `response.create` antes y devolver al estado `listening` si pasan 8s sin progreso.

### 4. Que JARVIS sí pueda mandar tareas a OpenClaw
Hoy NO tiene tool para OpenClaw (por eso te dijo que no). Añadir tres tools nuevas dentro de `useJarvisRealtime.tsx`:
- `openclaw_create_task({ title, node, priority })` → inserta en `openclaw_tasks` ligado a tu `user_id` (mismo flujo que el Hub).
- `openclaw_list_nodes()` → devuelve nodos disponibles (POTUS, TITAN, JARVIS, ATLAS y los que tengas) con su estado.
- `openclaw_run_now({ task_title })` → busca la recurrente o tarea pendiente y la dispara como ejecución inmediata.

Con eso podrás decir literalmente "JARVIS, manda a POTUS que haga X" y él lo crea en OpenClaw Hub.

### 5. Modelo más potente sin escatimar (lo pediste)
- **Voz Realtime**: `gpt-realtime` (es lo top que hay ahora mismo en Realtime; "GPT-4.7" no existe como modelo público, así que uso lo más capaz disponible).
- **Especialistas vía `ask_specialist`**: forzar que `jarvis-gateway` use Gemini 3.1 Pro (ya disponible vía Lovable AI Gateway) como modelo principal en vez de Flash, para análisis de relaciones serios.
- Esto consume más créditos pero responde en segundos.

### 6. Endurecer el flujo
- Añadir logs claros de tool latency (`[JARVIS] tool=X took Yms`) para ver en qué se atasca.
- Limitar `executeFunction` con `Promise.race(timeout 12s)`.
- Asegurar `response.create` siempre tras `function_call_output` (ya está, pero confirmaré que no se duplique).

### 7. Validación al terminar
- Probar "JARVIS, analiza mi relación con [contacto]" → debe responder en <8s con dossier real.
- Probar "JARVIS, manda a POTUS que rastree X" → debe crear tarea en OpenClaw Hub visible.
- Probar selector de voz en UI → cambia en caliente sin reiniciar sesión completa.
- Probar transcripción del chat normal sigue funcionando (Groq).

### Archivos a tocar
- `src/hooks/useJarvisRealtime.tsx` (nuevas tools, timeout, voz configurable, watchdog ajustado)
- `src/components/jarvis/JarvisChat.tsx` (selector de voz en la barra del modo en vivo)
- `supabase/functions/jarvis-voice/index.ts` (voz por defecto `ash`, modelo de transcripción interno mejorado, aceptar voz desde body)
- `supabase/functions/jarvis-stt/index.ts` (migrar a Groq para coherencia)
- `supabase/functions/jarvis-gateway/index.ts` (forzar Gemini 3.1 Pro para análisis profundos cuando viene de Realtime)

### Resultado esperado
- Transcripción rápida y barata (Groq) en todos los puntos del chat.
- Voz masculina por defecto (`ash`) y selector para probar otras (verse, ballad, echo).
- Análisis de relación con un contacto responde en segundos, no en 2 minutos.
- JARVIS puede crear y disparar tareas en OpenClaw directamente desde el chat de voz.
- Si una tool se cuelga, JARVIS lo detecta a los 12s y sigue hablando, no se queda mudo.

