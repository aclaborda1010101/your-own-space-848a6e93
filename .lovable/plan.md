

# Plan: Generador de Documento Estratégico de Lanzamiento (PDF)

## Resumen

Implementar un generador de documento de estrategia comercial dentro del panel "Lanzamiento del Producto" de cada proyecto. El sistema usará IA (Gemini/Claude via `ai-client.ts`) para analizar los datos del proyecto (briefing, alcance, PRD, MVP) y generar un documento Markdown de 5-8 páginas con las 8 secciones especificadas. El documento se exporta como PDF reutilizando la infraestructura existente de `generate-document`.

## Componentes a crear/modificar

### 1. Nueva Edge Function: `generate-launch-strategy`
- Recibe `projectId`, carga los steps del proyecto (briefing F2, alcance F3, PRD F5, MVP F4) de `project_wizard_steps`
- Construye un prompt detallado con la estructura de 8 secciones obligatorias (ICP, competencia/pricing, adquisicion, GTM, crecimiento, activacion/retencion, riesgos, roadmap comercial)
- Llama a Gemini Pro (o fallback Claude) con `maxOutputTokens: 65536` para generar Markdown completo
- Guarda resultado en `project_wizard_steps` con `step_number = 200` (slot reservado para lanzamiento)
- Devuelve el Markdown generado
- Registra en `supabase/config.toml` con `verify_jwt = false`

### 2. Modificar `ProjectLaunchPanel.tsx`
- Pasar props adicionales: `steps`, `company` (desde ProjectWizard)
- Reemplazar placeholder actual por UI funcional:
  - Boton "Generar Estrategia de Lanzamiento" (deshabilitado si no hay PRD aprobado)
  - Estado de generacion con spinner
  - Vista del Markdown generado (renderizado con tabs raw/preview como en step 3)
  - Boton de edicion del documento
  - Boton de exportacion PDF usando `ProjectDocumentDownload` con `stepNumber=200`
- Cargar datos existentes del step 200 si ya fue generado previamente

### 3. Modificar `generate-document/index.ts`
- Añadir `200: "Estrategia de Lanzamiento"` en `STEP_TITLES`
- El flujo generico de Markdown→HTML→PDF ya cubre este caso sin cambios adicionales

### 4. Modificar `ProjectWizard.tsx`
- Pasar `steps`, `company` y callbacks al `ProjectLaunchPanel`
- Mostrar panel solo cuando step 3 (PRD) esta aprobado (o step 4 MVP existe)

## Flujo del usuario

1. Usuario completa el pipeline del proyecto (al menos PRD aprobado)
2. Abre panel "Lanzamiento del Producto"
3. Pulsa "Generar Estrategia de Lanzamiento"
4. La edge function carga contexto del proyecto, genera documento con IA
5. Se muestra el documento Markdown con preview
6. Usuario puede editar y exportar como PDF

## Estructura del prompt IA

El prompt del sistema incluira instrucciones para generar las 8 secciones con formato Markdown profesional:
1. Mercado Objetivo (ICP) -- con tablas de segmentos
2. Analisis de Mercado, Competencia y Pricing -- tabla comparativa obligatoria
3. Estrategia de Adquisicion -- max 3 canales priorizados
4. Estrategia GTM -- 3 fases (early adopters, lanzamiento, expansion)
5. Estrategia de Crecimiento -- modelo recomendado con justificacion
6. Activacion y Retencion -- time-to-value, onboarding, engagement
7. Riesgos del Lanzamiento -- tabla impacto/mitigacion
8. Roadmap Comercial -- 3 capas con metricas

## Detalles tecnicos

- Step number: `200` (fuera del rango pipeline principal 1-6)
- Modelo IA: `gemini-pro` (fallback Claude via `ai-client.ts`)
- Persistencia: reutiliza tabla `project_wizard_steps` existente
- PDF: reutiliza `generate-document` con stepNumber=200
- Sin migraciones SQL necesarias (la tabla ya soporta cualquier step_number)

