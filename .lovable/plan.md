
# Plan: Corregir Error de Parsing JSON con Claude

## Problema Diagnosticado

Los edge functions `jarvis-publications`, `jarvis-core` y `smart-notifications` fallan al parsear respuestas JSON porque:

1. Usan Claude API (ANTHROPIC_API_KEY existe)
2. Claude devuelve JSON envuelto en markdown: ` ```json {...} ``` `
3. El codigo hace `JSON.parse(content)` sin limpiar el markdown primero
4. Resultado: "Invalid AI response format" -> Error 500

## Solucion

Modificar el `ai-client.ts` para que cuando se use Claude con `responseFormat: "json"`:
- Anada instrucciones explicitas al prompt
- Limpie automaticamente el markdown de la respuesta

---

## Cambios Tecnicos

### 1. Actualizar `supabase/functions/_shared/ai-client.ts`

Modificar la funcion `chatWithClaude()` para:

```typescript
async function chatWithClaude(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  let { system, messages: formattedMessages } = formatMessagesForClaude(messages);

  // Si se requiere JSON, anadir instrucciones explicitas
  if (options.responseFormat === "json") {
    system += "\n\nCRITICAL: You MUST respond with ONLY valid JSON. No markdown code blocks, no explanations, no ```json tags. Just the raw JSON object starting with { and ending with }.";
  }

  // ... resto del codigo existente ...

  let result = textContent?.text || "";
  
  // Limpiar markdown si se solicito JSON
  if (options.responseFormat === "json") {
    result = cleanJsonResponse(result);
  }
  
  return result;
}

// Nueva funcion helper
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();
  
  // Remover bloques markdown
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  
  // Buscar el primer { y ultimo }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }
  
  return cleaned.trim();
}
```

### 2. Actualizar funcion principal `chat()`

Pasar las opciones correctamente a Claude:

```typescript
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (USE_CLAUDE) {
    return chatWithClaude(messages, options); // Ya pasa options
  }
  // ...
}
```

(Esto ya esta bien, solo hay que asegurar que `chatWithClaude` use `options.responseFormat`)

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/_shared/ai-client.ts` | Anadir limpieza de markdown cuando `responseFormat: "json"` |

## Beneficios

- Corrige el error sin modificar los 10+ edge functions existentes
- Solucion centralizada en el cliente AI
- Compatible con ambos backends (Claude y Lovable AI)
- Los prompts ya piden JSON, solo falta la limpieza de respuesta

## Despliegue

Redesplegar los edge functions afectados:
- `jarvis-publications`
- `jarvis-core`
- `smart-notifications`
- `jarvis-contenidos`

---

## Resultado Esperado

Despues de esta correccion:
- Las respuestas JSON de Claude se limpiaran automaticamente
- `JSON.parse()` funcionara correctamente
- Los contenidos se generaran sin error
