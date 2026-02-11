

# Notas de Voz y Modo Realtime en el Chat

## Que se va a hacer

Mejorar la pagina de Chat con dos funcionalidades de voz:

1. **Notas de voz (envio directo)**: Al grabar audio, se transcribe y se envia automaticamente como mensaje (sin rellenar el input). El mensaje del usuario mostrara un icono de microfono para indicar que fue enviado por voz.

2. **Modo voz en tiempo real**: Un boton para activar el modo "conversacion por voz" donde JARVIS responde con voz (TTS con ElevenLabs) ademas de texto. Se reutiliza el hook `useJarvisRealtimeVoice` que ya tiene todo el pipeline STT + Claude + TTS.

## Cambios en la interfaz

- El boton de microfono actual pasara a grabar y enviar directamente (en lugar de rellenar el input).
- Se anade un boton de "modo voz" (icono de auriculares/volumen) junto al selector de agente que activa/desactiva las respuestas habladas.
- Cuando el modo voz esta activo, las respuestas de JARVIS se reproducen automaticamente con la voz de JARVIS (ElevenLabs TTS).
- Un indicador visual muestra el estado: escuchando, transcribiendo, pensando, hablando.

## Flujo del usuario

```text
[Modo texto normal]
1. Pulsa microfono -> Graba audio
2. Pulsa de nuevo -> Para grabacion
3. Se transcribe automaticamente (Groq Whisper)
4. Se envia como mensaje de texto al agente
5. Respuesta aparece como texto

[Modo voz activado]
1. Pulsa microfono -> Graba audio
2. Pulsa de nuevo -> Para grabacion  
3. Se transcribe y envia automaticamente
4. Respuesta aparece como texto Y se reproduce con voz JARVIS
5. Se puede detener la voz en cualquier momento
```

## Detalles tecnicos

**Archivo modificado**: `src/pages/Chat.tsx`

- Importar `useJarvisTTS` para reproducir respuestas con voz
- Cambiar `transcribeAndSend` para que envie el mensaje directamente en lugar de rellenar `setInput`
- Anadir estado `voiceMode` (boolean) que controla si las respuestas se reproducen con TTS
- Anadir boton toggle de modo voz en el header junto al selector de agente
- Mostrar indicador de estado de voz (grabando/transcribiendo/hablando) en la barra de input
- Anadir boton para detener la reproduccion de voz cuando JARVIS esta hablando
- Marcar mensajes enviados por voz con un icono de microfono

No se necesitan nuevas edge functions ni cambios en el backend - todo el pipeline ya existe.

