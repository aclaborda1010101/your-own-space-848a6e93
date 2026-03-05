

## Plan: Filtro de transcripción pre-extracción (Paso 1.5)

### Concepto
Antes de ejecutar la extracción (paso 2), si el input es de audio/transcripción, se ejecuta una llamada previa a Gemini Flash para filtrar el contenido irrelevante. Esto evita que conversaciones sobre otros proyectos, temas personales o menciones a terceros contaminen el briefing.

### Cambios

**1. Edge Function `supabase/functions/project-wizard-step/index.ts`**

Dentro del bloque `action === "extract"` (línea ~212), antes de llamar a `callGeminiFlash` para la extracción:

- Detectar si necesita filtrado: `inputType === "audio"` o el contenido tiene marcadores de transcripción (múltiples "Speaker", timestamps, "Conversación #")
- Si sí, ejecutar una llamada previa a Gemini Flash con el prompt de filtrado proporcionado
- Registrar el coste como `service: "gemini-flash", operation: "transcript_filter"`
- Usar el texto filtrado como input para la extracción real
- Guardar tanto `filtered_content` como `was_filtered: true` en el `input_data` del step para que el frontend pueda mostrar ambos

**2. Hook `src/hooks/useProjectWizard.ts`**

En `runExtraction()` (línea ~240), pasar `inputType` dentro de `stepData` para que la edge function sepa si es audio.

**3. Componente `src/components/projects/wizard/ProjectWizardStep2.tsx`**

- En el estado `generating` (línea ~166): mostrar dos fases — primero "Filtrando transcripción..." y luego "Extrayendo briefing..." (controlado por un estado de progreso devuelto o simplemente un mensaje genérico de 2 fases)
- En la vista del briefing completado: si `briefing._was_filtered`, mostrar el `inputContent` actual como "Filtrado para proyecto" y añadir un toggle/botón para ver "Original completo" vs "Filtrado". El original ya está disponible en `inputContent` del proyecto, y el filtrado se guarda en el step's `input_data.filtered_content`
- Cambiar el texto del preview del material de entrada para reflejar si está filtrado

### Prompt de filtrado
Se usa exactamente el proporcionado por el usuario, inyectando `project_name`, `company_name` e `input_content`.

### Coste
Se registra como una entrada adicional en `project_costs` con `service: "gemini-flash"`, `operation: "transcript_filter"`, step 2.

### Detección de transcripción
```typescript
function needsTranscriptFilter(inputType: string, content: string): boolean {
  if (inputType === "audio") return true;
  const markers = [/Speaker\s*\d/i, /\d{1,2}:\d{2}/, /Conversación\s*#/i];
  return markers.filter(m => m.test(content)).length >= 2;
}
```

### Flujo resultante
1. Usuario pulsa "Extraer briefing"
2. Edge function detecta que es transcripción → ejecuta filtrado → registra coste
3. Con el texto filtrado, ejecuta la extracción normal → registra coste
4. Devuelve `{ briefing, filtered_content, was_filtered, cost }`
5. Frontend muestra el briefing con toggle Original/Filtrado

