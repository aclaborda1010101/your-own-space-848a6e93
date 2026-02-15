

# Cambiar modelo de transcripciones a Gemini Flash (30x mas barato)

## Problema actual

La funcion `process-transcription` usa `claude-sonnet-4-20250514` directamente via la API de Anthropic. Para una transcripcion larga de 30.000 palabras dividida en 5 bloques, cada bloque genera 2 llamadas (segmentacion + extraccion), lo que son ~10 llamadas a Claude Sonnet a $3/$15 por millon de tokens. Muy caro para una tarea sencilla.

## Solucion

Reemplazar la funcion `callClaude` por `callGemini` que usa **Gemini 2.0 Flash** via la API de Google. Este modelo cuesta $0.10/$0.40 por millon de tokens (30x mas barato) y es mas que suficiente para segmentar y extraer datos de transcripciones.

## Comparativa de costes

```text
Transcripcion de 30K palabras (~40K tokens input):

Claude Sonnet 4:  ~$0.12 input + ~$0.30 output = ~$0.42 por transcripcion
Gemini 2.0 Flash: ~$0.004 input + ~$0.008 output = ~$0.012 por transcripcion

Ahorro: ~97% por transcripcion
```

## Cambios tecnicos

### Archivo: `supabase/functions/process-transcription/index.ts`

1. **Linea 9**: Cambiar `ANTHROPIC_API_KEY` por `GOOGLE_AI_API_KEY`

2. **Lineas 101-124**: Reemplazar la funcion `callClaude` por `callGemini` que usa el endpoint de Gemini con el modelo `gemini-2.0-flash`

3. **Lineas 147, 168 y todas las demas llamadas a `callClaude`**: Renombrar a `callGemini`

La nueva funcion `callGemini`:
- Usa `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Convierte system prompt + user message al formato de Gemini (systemInstruction + contents)
- Parsea la respuesta del formato Gemini (candidates[0].content.parts[0].text)
- Mantiene temperature 0.3 para consistencia

### Archivos modificados

- `supabase/functions/process-transcription/index.ts` - Cambiar de Claude a Gemini Flash
- Redesplegar edge function

