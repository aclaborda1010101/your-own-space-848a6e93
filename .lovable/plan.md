

# Auto-clasificar transcripciones familiares por speakers

## Objetivo
Cualquier transcripcion donde Juany o Bosco aparezcan como speakers (interlocutores) se clasificara automaticamente como cerebro **familiar** (`bosco`), independientemente de lo que decida la IA.

## Cambios

### 1. Prompt de extraccion (supabase/functions/process-transcription/index.ts)
Anadir una regla explicita al `EXTRACTION_PROMPT` indicando que si entre los speakers estan "Juany" o "Bosco", el brain debe ser `bosco`.

Linea ~58, despues de la definicion del cerebro `bosco`, anadir:
> **REGLA OBLIGATORIA**: Si entre los speakers (interlocutores que hablan) aparece "Juany" o "Bosco", el brain DEBE ser "bosco" sin excepcion.

### 2. Override en codigo (misma funcion)
Como red de seguridad, anadir logica post-extraccion que fuerce `brain = "bosco"` si los speakers contienen "juany" o "bosco" (case-insensitive). Esto se hara en la funcion `saveExtractedData` (~linea 302), justo despues del sanitizado de brain:

```typescript
// Force family brain if Juany or Bosco are speakers
const speakerNames = (extracted.speakers || []).map(s => s.toLowerCase());
if (speakerNames.some(s => s.includes("juany") || s.includes("bosco"))) {
  safeBrain = "bosco";
}
```

### 3. Redesplegar la edge function
Desplegar `process-transcription` para que aplique a nuevas transcripciones.

## Seccion tecnica

- Archivo: `supabase/functions/process-transcription/index.ts`
- Lineas afectadas: ~58 (prompt) y ~303-305 (override en codigo)
- No requiere migracion de base de datos
- Las transcripciones ya procesadas no se reclasifican automaticamente (se puede usar "Reprocesar" desde la UI para las existentes)

