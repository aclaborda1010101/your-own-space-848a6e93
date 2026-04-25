## Objetivo

Añadir un botón en la UI autenticada del wizard que ejecute `action: build_registry` sobre el proyecto actual y muestre `STATUS` + `RAW` + `JSON parseado` directamente en pantalla, sin necesidad de pegar snippets en la consola del navegador.

## Cambios

### 1. Nuevo componente `src/components/projects/wizard/BuildRegistryPanel.tsx`

Card con título **"QA · Pipeline v2 — Build Registry (Step 25)"**, que contiene:

- Botón **"Ejecutar build_registry"** (variant `holo`, deshabilitado mientras corre).
- Indicador de duración en segundos (cuenta hacia arriba mientras corre, para vigilar el límite de 150 s).
- Estado tras la respuesta:
  - `STATUS: <code>` con color (verde 200, ámbar 4xx, rojo 5xx).
  - Bloque `<pre>` con `RAW` (texto plano de la respuesta).
  - Bloque `<pre>` con `JSON.stringify(parsed, null, 2)` si es JSON válido.
  - Resumen rápido si el JSON contiene `ok / opportunity_count / component_count / warnings_count / validation_issues_count / f2_ms / f3_ms`.
- Botón **"Copiar RAW"** (usa `navigator.clipboard.writeText`).

Implementación interna:

- `import { supabase } from "@/integrations/supabase/client"`.
- Lee `session.access_token` desde `supabase.auth.getSession()`.
- Hace `fetch` directo a `https://${VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-wizard-step` con `Authorization: Bearer <token>` y body `{ action: "build_registry", projectId }`.
  - Se usa `fetch` directo en vez de `supabase.functions.invoke` para capturar el `STATUS` HTTP exacto y el `RAW` text aunque la respuesta no sea JSON (504 IDLE_TIMEOUT, 401, etc.).
- `try/catch` que muestra el error de red en pantalla (no rompe el wizard).
- Sin timeout propio — deja que el navegador resuelva (el límite real es el 150 s del Edge Function).

Props: `{ projectId: string }`.

### 2. Integrar en `src/pages/ProjectWizard.tsx`

- Importar `BuildRegistryPanel`.
- Renderizarlo dentro de `ProjectWizardEdit`, justo **después del bloque del paso 2** y **antes del paso 3** (alrededor de la línea 269), envuelto en su propia `Card` para que sea visible en cualquier momento (no condicionado a `currentStep`).
  - Razón: queremos poder dispararlo independientemente del paso actual del wizard.

### 3. Restricciones (lo que NO se toca)

- No se modifican prompts F1/F2/F3 ni `useProjectWizard.ts`.
- No se corrigen las 9 violaciones pendientes del Step 2.
- No se añade lógica que apruebe el briefing ni regenere downstream legacy.
- No se modifica el Edge Function `project-wizard-step`.
- No se añaden migraciones de base de datos.

## Verificación

Una vez aplicado:

1. El usuario navega al wizard de AFFLUX (`/projects/wizard/6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf`).
2. Pulsa **"Ejecutar build_registry"**.
3. Espera (puede tardar ~60–120 s).
4. Comparte el `STATUS` y `RAW` mostrados en pantalla.
5. Con eso, el AI procede a leer el Step 25 desde DB y entrega el informe completo (oportunidades F2, componentes F3, checklist AFFLUX de los 11 componentes esperados, validaciones críticas, problemas, recomendación final).
