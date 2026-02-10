

## Plan: Conversacion en tiempo real con ElevenLabs Conversational AI

### Problema actual
El modo de voz usa `jarvis-hybrid-voice` que sigue un flujo batch (grabar completo -> transcribir -> pensar -> generar audio). Esto introduce latencia de varios segundos. El sistema realtime con OpenAI (`useJarvisRealtime`) funciona pero falla por quota (429).

### Solucion: ElevenLabs Conversational AI Agent

ElevenLabs ofrece agentes conversacionales que manejan STT + LLM + TTS en una sola conexion WebRTC, con latencia de ~1 segundo. El usuario habla y el agente responde en tiempo real, igual que un chat de voz.

### Requisitos previos (usuario)

1. **Crear un agente en ElevenLabs**: Ir a [platform.elevenlabs.io](https://platform.elevenlabs.io) y crear un Conversational AI Agent con:
   - Idioma: Espanol
   - Voz: elegir una voz adecuada para JARVIS
   - System prompt: el prompt de JARVIS (mayordomo, productividad, etc.)
   - Configurar las client tools que el agente puede llamar (create_task, complete_task, etc.)
2. **Obtener el Agent ID** del agente creado
3. **Tener ELEVENLABS_API_KEY** como secreto en Supabase

### Paso 1: Anadir secreto ELEVENLABS_API_KEY
Configurar `ELEVENLABS_API_KEY` en los secretos de Supabase (se pedira al usuario que lo proporcione).

### Paso 2: Crear edge function para generar token
Nueva edge function `elevenlabs-conversation-token/index.ts` que:
- Recibe el agent_id
- Llama a `https://api.elevenlabs.io/v1/convai/conversation/token` con la API key
- Devuelve el token al cliente

### Paso 3: Instalar `@elevenlabs/react`
Agregar la dependencia del SDK de React de ElevenLabs que proporciona el hook `useConversation`.

### Paso 4: Crear hook `useJarvisElevenLabs`
Nuevo hook que usa `useConversation` de `@elevenlabs/react`:
- Solicita token via la edge function
- Inicia sesion WebRTC con el agente
- Expone: `status`, `isSpeaking`, `startSession`, `endSession`
- Configura `clientTools` para ejecutar acciones locales (crear tareas, consultar datos en Supabase)
- Maneja eventos `onMessage` para mostrar transcripciones en la UI

### Paso 5: Actualizar el panel de voz
Modificar `JarvisFloatingPanel.tsx` (modo voz) para usar el nuevo hook:
- Al entrar en modo voz, conecta automaticamente al agente
- Muestra el orb animado segun `isSpeaking`
- Muestra transcripciones del usuario y respuestas del agente en tiempo real
- Boton para desconectar

### Flujo resultante

```text
Usuario habla
    |
    v
[WebRTC -> ElevenLabs Agent]
    |
    +---> STT (automatico)
    +---> LLM (configurado en el agente)
    +---> TTS (voz seleccionada)
    |
    v
Audio de respuesta en tiempo real (~1s latencia)
    |
    +---> Si el agente necesita datos -> clientTool callback
          -> ejecuta query Supabase localmente
          -> devuelve resultado al agente
          -> agente continua hablando
```

### Detalles tecnicos

**Archivos nuevos:**
- `supabase/functions/elevenlabs-conversation-token/index.ts` - Edge function para tokens
- `src/hooks/useJarvisElevenLabs.tsx` - Hook con `useConversation`

**Archivos a modificar:**
- `src/components/voice/JarvisFloatingPanel.tsx` - Integrar nuevo hook en modo voz
- `package.json` - Agregar `@elevenlabs/react`

**Client tools** (ejecutados en el navegador, no en el server):
- `create_task` - Inserta tarea en Supabase
- `complete_task` - Marca tarea como completada
- `list_pending_tasks` - Consulta tareas pendientes
- `get_today_summary` - Resumen del dia
- `get_my_stats` - Estadisticas semanales

Estas tools se reutilizarian del codigo existente en `useJarvisRealtime.tsx` (lineas 71-271).

**Configuracion del agente (en ElevenLabs dashboard):**
- Definir cada client tool con su schema JSON
- Configurar el system prompt de JARVIS
- Seleccionar voz y modelo de LLM
- Habilitar eventos de transcripcion

### Pregunta necesaria
Se necesita que el usuario:
1. Tenga cuenta de ElevenLabs con plan que soporte Conversational AI
2. Cree el agente en el dashboard y proporcione el Agent ID
3. Proporcione la ELEVENLABS_API_KEY

