

## Plan: Enriquecer Phase 5 con señales accionables y fuentes reales

### Problema
Las señales de capas 3-5 son genéricas: dicen "Datos de mercado" o "INE (Tier A)" sin especificar URL real, variable concreta, cruce con dato interno, ni decisión de negocio habilitada. Expert Forge no puede actuar sobre esto.

### Cambios en `supabase/functions/pattern-detector-pipeline/index.ts`

#### 1. Reescribir prompt de Phase 5 (líneas 2167-2222)
Añadir al prompt del user message las instrucciones de accionabilidad para capas 3-5:
- Bloque completo con los 5 requisitos obligatorios (fuente concreta con URL, variable extraída, cruce con dato interno, decisión de negocio, RAG necesario)
- Los 3 ejemplos concretos del sector centros comerciales (SEPE/CNAE 47, Colegios Arquitectos visados, CNMC ecommerce)
- Instrucción de degradar señales sin fuente concreta
- Nuevo schema JSON de output con campos `concrete_data_source`, `variable_extracted`, `cross_with_internal`, `business_decision_enabled`, `rag_requirement` obligatorios para layer >= 3

#### 2. Enriquecer hardcoded signals de centros_comerciales (líneas 2230-2252)
Añadir a cada señal hardcoded los campos nuevos:
- `concrete_data_source` con URL real (SEPE, INE, Inside Airbnb, CNMC, etc.)
- `variable_extracted` con unidad y granularidad
- `cross_with_internal` con variable interna + lógica de cruce + lag time
- `business_decision_enabled` con decisión + valor económico estimado
- `rag_requirement` con nombre RAG + método de hidratación + volumen

#### 3. Validación post-generación (nuevo bloque después de línea 2268)
Después de inyectar hardcoded signals y antes de aplicar confidence cap:
- Para cada señal con `layer >= 3`: verificar que tiene `concrete_data_source.url`
  - Si no: degradar layer a `layer - 1` (mínimo 2) y `confidence *= 0.5`
- Verificar `cross_with_internal.internal_variable`
  - Si no: `confidence *= 0.7`
- Verificar `business_decision_enabled.decision`
  - Si no: eliminar señal (return null + filter)

#### 4. Propagar campos enriquecidos al output (línea 2561-2578)
Añadir al mapping de `signalsByLayer`:
```
concrete_data_source: s.concrete_data_source || null,
variable_extracted: s.variable_extracted || null,
cross_with_internal: s.cross_with_internal || null,
business_decision_enabled: s.business_decision_enabled || null,
rag_requirement: s.rag_requirement || null,
```

#### 5. Enriquecer PRD injection (líneas 2612-2678)
- **Sección 7 (patternsSection)**: Para señales de capa 3+, añadir fuente concreta + URL + decisión habilitada
- **Sección 15.1 (ragsAdicionales)**: Usar `rag_requirement` de las señales enriquecidas (con hydration_method y estimated_volume) en lugar de solo agrupar por data_source
- **Sección 19 (integracionesExternas)**: Añadir tabla con `concrete_data_source` de cada señal: URL, tipo, formato, frecuencia, coste, acceso

### Archivo a modificar
| Archivo | Sección |
|---------|---------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Phase 5 prompt (2167-2222), hardcoded signals (2230-2252), validación post (nuevo ~2270), output mapping (2561-2578), PRD injection (2612-2678) |

### Resultado esperado
- Cada señal de capa 3+ tiene URL de fuente real verificable
- Cada señal dice exactamente qué variable cruza con qué dato interno
- Cada señal habilita una decisión de negocio concreta con valor económico
- RAGs externos con métodos de hidratación específicos
- Señales sin fuente concreta se degradan automáticamente

