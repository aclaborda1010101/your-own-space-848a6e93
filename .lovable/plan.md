

## Plan: Integrar reglas de interpretación Expert Forge en el payload de publicación

### Contexto
Actualmente, `publish-to-forge` envía el PRD con parámetros de contrato (build_mode, source_of_truth, etc.) pero no incluye las reglas de interpretación que Expert Forge debe seguir al procesar el documento. Estas reglas (PASO 0-5, clasificación de componentes, validaciones V01-V08, antipatrones) deben viajar como un campo dedicado en el payload.

### Cambios

**1. Crear constante con las reglas en `publish-to-forge/index.ts`**
- Añadir una constante `EXPERT_FORGE_INTERPRETATION_RULES` con el texto completo de las reglas proporcionadas (system prompt genérico).

**2. Incluir en el payload al gateway**
- Añadir el campo `interpretation_rules` al `basePayload` con el valor de la constante.
- Expert Forge recibirá este bloque como instrucción de sistema junto con el `document_text`.

### Detalle técnico
- El campo `interpretation_rules` se envía como string en el JSON del payload.
- No afecta al flujo existente: si Expert Forge no lo consume, lo ignora.
- El texto se recorta a ~15K chars (el bloque completo cabe holgadamente).
- No requiere cambios en frontend, contratos, ni en la generación del PRD.

### Archivo afectado
- `supabase/functions/publish-to-forge/index.ts` — añadir constante + campo en payload.

