

# Traductor de Intent: Input Simple a Peticion Tecnica

## Que se construye

Un paso intermedio en el flujo de Pattern Intelligence que traduce la descripcion simple del usuario en una peticion tecnica expandida, la muestra para confirmacion, y solo entonces arranca el pipeline.

## Flujo actual vs nuevo

```text
ACTUAL:
Setup Dialog (sector, geografia, objetivo) -> Crear run -> Pipeline automatico

NUEVO:
Setup Dialog (sector, geografia, objetivo) 
  -> Llamada IA "translate_intent" 
  -> Pantalla de confirmacion con peticion tecnica expandida
  -> Usuario confirma/edita 
  -> Crear run con peticion tecnica como business_objective
  -> Pipeline automatico
```

## Cambios necesarios

### 1. Edge Function: nueva accion `translate_intent` en `pattern-detector-pipeline`

Anadir una accion `translate_intent` al handler HTTP existente. Recibe `sector`, `geography`, `time_horizon`, `business_objective` (el texto simple del usuario). Llama a la IA con un prompt que genera:

- Definicion precisa del problema
- Variable objetivo
- Variables predictivas sugeridas
- Tipo de modelo recomendado
- Metricas de exito
- Fuentes de datos probables
- Riesgos y limitaciones
- Baseline sugerido

Devuelve JSON estructurado con estos campos. No crea ningun run — solo traduce.

**Archivo:** `supabase/functions/pattern-detector-pipeline/index.ts`

### 2. Componente: `PatternIntentReview`

Nuevo componente que muestra la peticion tecnica generada en un dialog/card con:

- Cada seccion (problema, variables, modelo, metricas, fuentes, riesgos, baseline) como bloques visuales
- Boton "Confirmar y arrancar analisis"
- Boton "Editar" que permite modificar el texto expandido antes de confirmar
- Boton "Volver" para cambiar el input original

**Archivo:** `src/components/projects/PatternIntentReview.tsx`

### 3. Modificar `PatternDetectorSetup`

Cambiar el flujo del boton "Iniciar Analisis":
- En vez de llamar directamente a `onStart`, llama a una nueva funcion `onTranslate` que invoca `translate_intent`
- Pasa el resultado al componente `PatternIntentReview`
- Solo cuando el usuario confirma en `PatternIntentReview`, se llama a `onStart` con el `business_objective` expandido

**Archivo:** `src/components/projects/PatternDetectorSetup.tsx`

### 4. Modificar `usePatternDetector`

Anadir funcion `translateIntent(params)` que invoca la Edge Function con `action: "translate_intent"`. Devuelve la peticion tecnica estructurada.

**Archivo:** `src/hooks/usePatternDetector.tsx`

### 5. Modificar `PatternDetector`

Gestionar el estado del flujo de 2 pasos: setup -> review -> pipeline. Pasar las nuevas props a los componentes.

**Archivo:** `src/components/projects/PatternDetector.tsx`

## Detalle tecnico del prompt de traduccion

El prompt para `translate_intent` instruye a la IA a actuar como analista senior de datos y generar un JSON con esta estructura:

```json
{
  "problem_definition": "string",
  "target_variable": "string",
  "predictive_variables": ["string"],
  "recommended_model_type": "string",
  "success_metrics": ["string"],
  "likely_data_sources": ["string"],
  "risks_and_limitations": ["string"],
  "suggested_baseline": "string",
  "prediction_horizons": ["string"],
  "expanded_objective": "string (texto completo que reemplaza business_objective)"
}
```

El campo `expanded_objective` es la version tecnica completa que se pasa al pipeline como `business_objective`, asegurando que Phase 1 (Domain Comprehension) reciba un input de calidad analista senior en vez de 10 palabras del usuario.

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Anadir accion `translate_intent` |
| `src/components/projects/PatternIntentReview.tsx` | Crear nuevo |
| `src/components/projects/PatternDetectorSetup.tsx` | Modificar flujo |
| `src/hooks/usePatternDetector.tsx` | Anadir `translateIntent` |
| `src/components/projects/PatternDetector.tsx` | Gestionar estado 2 pasos |

## Sin cambios de base de datos

No se necesitan tablas ni columnas nuevas. El `business_objective` existente en `pattern_detector_runs` almacena el texto expandido en vez del texto simple.

