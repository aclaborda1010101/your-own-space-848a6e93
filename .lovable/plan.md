

# Plan de Implementacion: Mejoras Acumuladas v4.1

Este es un conjunto grande de 6 mejoras interconectadas. Se implementaran en orden secuencial para que cada mejora se apoye en la anterior.

---

## Fase 1: Base de datos y enums

### 1.1 Crear tabla `project_context`
Nueva tabla para almacenar el contexto empresarial obtenido por Auto-Research.

```sql
CREATE TABLE project_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
  source_url TEXT,
  company_name TEXT,
  company_description TEXT,
  sector_detected TEXT,
  geography_detected TEXT,
  products_services JSONB DEFAULT '[]',
  tech_stack_detected JSONB DEFAULT '[]',
  social_media JSONB DEFAULT '{}',
  competitors JSONB DEFAULT '[]',
  reviews_summary JSONB DEFAULT '{}',
  sector_trends JSONB DEFAULT '[]',
  news_mentions JSONB DEFAULT '[]',
  public_data JSONB DEFAULT '{}',
  raw_research TEXT,
  confidence_score NUMERIC(3,2),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Con indice, RLS y trigger de `updated_at`.

### 1.2 Actualizar enums
- Agregar `'pending'` a `source_status` (si existe como enum; si es texto libre, no se necesita migracion)
- Agregar `'PASS_CONDITIONAL'` a `gate_status` (si existe como enum)

Nota: Revisando el codigo actual, el `status` en `data_sources_registry` y `rag_quality_logs` ya se usan como texto libre (no enums SQL), por lo que los valores `"pending"` y `"PASS_CONDITIONAL"` ya estan funcionando en el codigo existente. No se necesitan migraciones de enums.

---

## Fase 2: Auto-Research de Contexto Empresarial (Mejora 1)

### 2.1 Conectar Firecrawl
El workspace ya tiene una conexion de Firecrawl disponible (`Luxury`, connector_id: `firecrawl`). Se vinculara al proyecto para scraping de URLs.

### 2.2 Conectar Perplexity
El workspace ya tiene una conexion de Perplexity disponible. Se vinculara para el research externo (noticias, competidores, resenas).

### 2.3 Nueva Edge Function: `auto-research`
Creara `supabase/functions/auto-research/index.ts` con dos fases:

- **Fase 1 (Firecrawl)**: Scrape de la URL proporcionada para extraer: descripcion, productos/servicios, ubicacion, stack tecnologico, redes sociales, propuesta de valor.
- **Fase 2 (Perplexity)**: Busqueda externa del nombre de empresa para: noticias recientes, competidores, estado del sector, resenas, presencia en directorios.
- **Guardar**: Insertar todo en `project_context`.

### 2.4 Nuevo hook: `useAutoResearch`
- `src/hooks/useAutoResearch.ts`
- Funciones: `runResearch(projectId, url)`, `loadContext(projectId)`, `updateContext(projectId, updates)`
- Gestiona estados: `researching`, `context`, `error`

### 2.5 Nuevo componente: `AutoResearchCard`
- `src/components/projects/AutoResearchCard.tsx`
- Input de URL + boton "Investigar"
- Muestra spinner durante el research
- Muestra resumen estructurado con los resultados
- Botones "Confirmar" / "Corregir"
- Se integra en `PatternDetectorSetup` y en `QuestionnaireTab`

---

## Fase 3: Traductor de Intent mejorado (Mejora 2)

El traductor ya existe en la edge function `pattern-detector-pipeline` (accion `translate_intent`). Se mejorara para:

### 3.1 Usar contexto de `project_context`
Si existe contexto del Auto-Research, se incluye en el prompt del traductor para generar peticiones tecnicas mas precisas.

### 3.2 Actualizar el prompt
Incluir en el prompt del `translate_intent` el contexto empresarial cuando este disponible.

---

## Fase 4: Formulario actualizado de Pattern Intelligence (Mejora 6)

### 4.1 Actualizar `PatternDetectorSetup.tsx`
Nuevo orden de campos:
1. URL de la empresa (opcional) -- si se proporciona, ejecuta Auto-Research
2. Sector (pre-rellenado si hay Auto-Research)
3. Geografia (pre-rellenada si hay Auto-Research)
4. Horizonte temporal
5. "Que quieres detectar o predecir?" (texto libre)

El flujo cambia:
- Si hay URL: se ejecuta Auto-Research, se muestra resumen, se pre-rellenan campos
- Luego se ejecuta Traductor de Intent
- Se muestra peticion tecnica en `PatternIntentReview`
- Usuario confirma y arranca el pipeline

### 4.2 Actualizar `PatternDetector.tsx`
Pasar el `projectId` al setup para que el Auto-Research se vincule al proyecto.

---

## Fase 5: PASS_CONDITIONAL en Quality Gate (Mejora 3)

### 5.1 Ya implementado parcialmente
Revisando el codigo actual de `executePhase3` en `pattern-detector-pipeline/index.ts`, el status `PASS_CONDITIONAL` ya esta implementado (lineas 237-271). El pipeline ya continua cuando el gate es condicional.

### 5.2 Mejoras pendientes
- Actualizar el UI del Quality Gate en `PatternDetector.tsx` para mostrar el badge `PASS_CONDITIONAL` (actualmente solo muestra PASS/FAIL)
- Mostrar las fuentes pendientes y la nota de cap de confianza
- Agregar color amarillo/naranja para el status condicional

---

## Fase 6: Ajustes al cuestionario de farmacia (Mejora 4)

### 6.1 Actualizar cuestionario hardcoded
En `ai-business-leverage/index.ts`, el cuestionario de farmacia ya tiene 12 preguntas con la mayoria de los ajustes solicitados. Verificando contra los requisitos:

- Las preguntas CRM (q7 original), marketing (q11) y ratio prescripcion/libre (q13) ya fueron eliminadas en versiones anteriores
- La pregunta de AEMPS/CISMED ya esta incluida (q7 actual)
- Los importes ya estan en euros
- Los rangos de presupuesto ya estan actualizados

**Pendiente**: Verificar y ajustar el orden exacto segun las especificaciones (12 preguntas en el orden indicado).

---

## Fase 7: Protocolo de autocorreccion del Quality Gate (Mejora 5)

### 7.1 Ya implementado parcialmente
El codigo actual en `executePhase3` ya incluye las fuentes sectoriales de farmacia (FEDIFAR, Datacomex, EMA, INE, AEMPS, CGCOF/CISMED) y las registra como `"pending"` cuando el gate falla.

### 7.2 Mejoras pendientes
Agregar logica de 2 iteraciones de autocorreccion:
- **Iteracion 1**: Buscar fuentes primarias (ISCIII epidemiologicos, INE produccion farmaceutica)
- **Iteracion 2**: Buscar datos proxy de supply chain (las fuentes ya listadas)

Esto se implementara como un bucle en `executePhase3` que reintenta hasta 2 veces buscando fuentes adicionales antes de decidir PASS_CONDITIONAL o FAIL.

---

## Resumen de archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| **Migracion SQL** | Crear tabla `project_context` |
| `supabase/functions/auto-research/index.ts` | **Nuevo** - Edge function para scraping + research |
| `src/hooks/useAutoResearch.ts` | **Nuevo** - Hook para gestionar Auto-Research |
| `src/components/projects/AutoResearchCard.tsx` | **Nuevo** - Componente de UI para research |
| `src/components/projects/PatternDetectorSetup.tsx` | Modificar - Anadir campo URL, integrar Auto-Research |
| `src/components/projects/PatternDetector.tsx` | Modificar - UI de PASS_CONDITIONAL, pasar projectId |
| `src/components/projects/QuestionnaireTab.tsx` | Modificar - Integrar Auto-Research opcional |
| `supabase/functions/pattern-detector-pipeline/index.ts` | Modificar - Usar context en translate_intent, autocorreccion QG |
| `supabase/functions/ai-business-leverage/index.ts` | Modificar - Verificar orden cuestionario farmacia |
| `supabase/config.toml` | Modificar - Anadir nueva edge function |

## Requisitos previos

1. **Conectar Firecrawl** al proyecto (ya disponible en el workspace)
2. **Conectar Perplexity** al proyecto (ya disponible en el workspace)

## Nota sobre el alcance

Este es un cambio grande que toca 10+ archivos incluyendo 3 nuevos. Se implementara en orden secuencial: primero la base de datos, luego la edge function de research, despues los componentes de UI, y finalmente las mejoras al pipeline existente.

