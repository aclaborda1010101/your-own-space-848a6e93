
Objetivo: dejar el pipeline del PRD robusto y volver a lanzarlo para que el proyecto genere bien el PRD completo, el manifest y el `forge_architecture`.

1. Endurecer el parseo del manifest
- Revisar y reforzar `safeParseManifest()` en `supabase/functions/project-wizard-step/manifest-schema.ts`.
- Aunque ya limpia fences al inicio/final, el log demuestra que aún entra texto con ```json en alguna ruta de reparación.
- Haré una limpieza más robusta antes de cualquier `JSON.parse`:
  - quitar fences markdown en cualquier posición relevante
  - normalizar marcadores `===ARCHITECTURE_MANIFEST=== ... ===END_MANIFEST===`
  - extraer el bloque JSON entre la primera `{` y la última `}`
  - mantener la reparación de comas finales y cierres faltantes
- Así se elimina el error `JSON repair failed: Unexpected token '`'`.

2. Corregir la Auditoría IA para que siempre incluya lo obligatorio
- El problema actual ya no es de tokens: `callGeminiPro` está en 32768.
- El fallo real que muestran los logs es de contrato/prompt: la auditoría sigue devolviendo un JSON sin `demo` y `funcionalidades excluidas`.
- En `supabase/functions/project-wizard-step/index.ts`, dentro del bloque `generate_prd_chained` / Fase 2:
  - ampliaré el prompt de auditoría para exigir explícitamente esos campos obligatorios del contrato
  - añadiré una instrucción de autocheck final antes de responder: no devolver el JSON si faltan `demo` o `funcionalidades excluidas`
  - si tras el primer parseo/validación faltan secciones obligatorias, haré un segundo intento automático de “repair/regenerate JSON” usando `callGatewayRetry(...)` con foco solo en completar campos faltantes, en vez de aceptar un audit incompleto

3. Hacer que el pipeline falle de forma útil si el audit queda inválido
- Ahora mismo el flujo sigue aunque la validación del audit detecte huecos.
- Cambiaré la lógica para que, tras la reparación automática:
  - si el audit sigue sin cumplir mínimos, no continúe silenciosamente
  - se guarde un error claro en el step correspondiente
- Esto evita PRDs “medio buenos” con contexto roto.

4. Aumentar margen en las rutas de reparación JSON
- Revisar `callGatewayRetry()` en `supabase/functions/project-wizard-step/llm-helpers.ts`.
- Subiré su `maxTokens` si hace falta, porque ahora está bastante más bajo que `callGeminiPro` y podría quedarse corto justo en la reparación estructurada.
- Mantendré timeout y patrón de ejecución asíncrona tal como están, porque eso ya resolvió el atasco principal del pipeline.

5. Confirmar que el resultado enriquecido sigue llegando al paso visible
- Verificaré la ruta que copia el PRD generado del step interno 5 al step visible 3 en `project-wizard-step/index.ts`.
- Me aseguraré de que el `architecture_manifest`, `forge_architecture` y metadatos de validación se propaguen correctamente al output final que ve la UI.

6. Regeneración del PRD del proyecto actual
- No hace falta una migración ni cambios de base de datos.
- Tras aplicar el fix, usaré el flujo existente de regeneración del wizard:
  - `runChainedPRD(...)`
  - nueva versión en `project_wizard_steps`
  - regeneración completa Alcance → Auditoría → PRD → Manifest enrichment
- El resultado esperado es:
  - PRD generado en step visible 3
  - manifest parseado sin fallos por backticks
  - `forge_architecture` compilado correctamente

7. Qué comprobaré después
- Que en logs desaparezca `Manifest parse failed`
- Que la Auditoría IA no vuelva a reportar `missing_required: demo, funcionalidades excluidas`
- Que el PRD final incluya `architecture_manifest` y `forge_architecture`
- Que la UI siga mostrando el estado correcto del paso PRD y su nueva versión

Detalles técnicos
- Archivos a tocar:
  - `supabase/functions/project-wizard-step/manifest-schema.ts`
  - `supabase/functions/project-wizard-step/index.ts`
  - `supabase/functions/project-wizard-step/llm-helpers.ts`
- No preveo cambios en frontend ni en esquema Supabase.
- La regeneración debe hacerse sobre el proyecto actual, creando una nueva versión del PRD y no sobrescribiendo la trazabilidad previa.
