

## Plan: Acción unificada `create_and_architect` + Botón de arquitectura manual

### Problema
JARVIS crea proyectos en Expert Forge con un simple INSERT pero nunca invoca el pipeline de arquitectura (`architect`). Los proyectos quedan con 0 RAGs, 0 especialistas, 0 routers.

### Cambios

**1. Actualizar `publish-to-forge` edge function para soportar acción `create_and_architect`**

Añadir lógica que:
- Acepta un campo opcional `action` (default: `"architect"`)
- Si `action === "create_and_architect"`: envía al gateway primero un `create` y luego un `architect` en secuencia, usando el `project_id` devuelto por el create
- Si `action === "architect"` (actual): comportamiento sin cambios
- Logs detallados en cada fase para diagnóstico

**2. Añadir botón "Arquitecturar en Expert Forge" en el wizard**

En `ProjectWizard.tsx`, junto al botón existente "Publicar en Expert Forge":
- Añadir un segundo botón visible cuando el paso 3 (PRD) esté aprobado
- Este botón invoca `publish-to-forge` con `action: "create_and_architect"` directamente, usando el PRD completo como `document_text`
- Reutiliza el `PublishToForgeDialog` existente pero con un modo simplificado (sin textarea editable, solo confirmación + progreso)

**3. Actualizar `PublishToForgeDialog` para soportar modo "auto"**

Añadir prop opcional `autoMode?: boolean`:
- Si `autoMode = true`: no muestra textarea editable, usa `prdText` directamente, y envía `action: "create_and_architect"`
- Si `autoMode = false` (default): comportamiento actual (textarea + `action: "architect"`)

### Archivos afectados
- `supabase/functions/publish-to-forge/index.ts` — añadir lógica `create_and_architect`
- `src/components/projects/wizard/PublishToForgeDialog.tsx` — añadir `autoMode` prop
- `src/pages/ProjectWizard.tsx` — añadir botón de arquitectura manual

