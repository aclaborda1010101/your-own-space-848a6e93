

## Plan: RAGs de nivel profesional + sistema de actualización con Perplexity

### Situación actual
Los RAGs están embebidos como strings estáticos en `rag-loader.ts` (~1230 líneas). Son buenos pero les falta profundidad en metodologías reales y no se actualizan.

### Lo que pides (resumido)
1. **Coach**: Mario Peláez, Robin Sharma, Tony Robbins, Brendon Burchard, etc. Metodologías completas
2. **Nutrición**: Todas las dietas (keto, paleo, mediterránea, ayuno intermitente, sin azúcar, etc.)
3. **Bosco**: Montessori, Reggio Emilia, Waldorf + actividades IA + inglés + gestión emocional
4. **English**: Métodos adultos Y niños, actividades de listening/reading/writing/speaking
5. **IA Formación**: Actualizable semanalmente con lo último en IA
6. **IA Kids**: Teoría + actividades prácticas padre-hijo
7. **Secretaria**: Gestión integral de agenda, tareas, emails
8. **Agentes**: Cada especialista con su edge function funcional

### Problema con el enfoque actual
Un string estático en `rag-loader.ts` no puede:
- Actualizarse semanalmente (IA formación)
- Contener la profundidad que pides (sería un archivo de 10,000+ líneas)
- Buscar fuentes externas

### Arquitectura propuesta

```text
┌─────────────────────────────────────────────┐
│  1. Edge Function: rag-knowledge-builder    │
│     - Usa Perplexity para buscar fuentes    │
│     - Usa Firecrawl para scraping           │
│     - Genera contenido estructurado con AI  │
│     - Guarda en tabla specialist_knowledge   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  2. Tabla: specialist_knowledge             │
│     - specialist (coach, nutrition, etc.)   │
│     - category (metodología, dieta, etc.)   │
│     - content (texto enriquecido)           │
│     - source_url, source_type               │
│     - updated_at                            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  3. rag-loader.ts actualizado               │
│     - RAG base (estático, siempre presente) │
│     - + contenido dinámico de la tabla      │
│     - buildAgentPrompt() combina ambos      │
└─────────────────────────────────────────────┘
```

### Implementación en 4 fases

**Fase 1: Base de datos + RAGs estáticos ampliados**
- Crear tabla `specialist_knowledge` para contenido dinámico
- Ampliar los RAGs estáticos con todo el contenido que puede ser permanente:
  - **Coach**: Añadir Robin Sharma (regla 5AM, Lead Without a Title), Mario Peláez (coaching ejecutivo español), Brendon Burchard (High Performance Habits), Jim Rohn, Mel Robbins (regla 5 segundos), David Goggins (mentalidad), Ray Dalio (principios)
  - **Nutrición**: Dieta keto (mecanismo cetosis, macros 70/25/5), paleolítica (alimentos permitidos/prohibidos), mediterránea (pirámide), ayuno intermitente (16:8, 5:2, OMAD), sin azúcar, vegetariana/vegana, DASH, Whole30, anti-inflamatoria, carnívora
  - **Bosco**: Montessori (periodos sensibles, ambiente preparado, materiales), Waldorf (ritmo, juego libre, arte), Reggio Emilia (100 lenguajes, documentación), Pikler (movimiento libre), gestión emocional infantil (RULER de Brackett, Zones of Regulation), actividades IA adaptadas por edad
  - **English**: Método directo, TPR, CLIL, Callan Method, Pimsleur, actividades creativas por skill y nivel, sección específica niños (songs, games, TPR)
  - **IA Formación**: MCP, A2A protocol, Vibe Coding, últimos modelos 2025
  - **Secretaria**: Pomodoro, Eat That Frog, batching, 4DX

**Fase 2: Edge function `rag-knowledge-builder`**
- Crear function que use Perplexity API para investigar temas específicos
- Usar Firecrawl para scraping de fuentes autorizadas
- Procesar con Gemini y guardar en `specialist_knowledge`
- Invocable manualmente o por cron semanal

**Fase 3: Integrar conocimiento dinámico en rag-loader**
- `buildAgentPrompt()` consulta `specialist_knowledge` para el especialista activo
- Combina RAG base + conocimiento dinámico relevante
- Prioriza contenido reciente para IA formación

**Fase 4: Verificar agentes edge functions**
- Confirmar que cada especialista tiene su edge function operativa
- Los que ya existen: `jarvis-coach`, `jarvis-nutrition`, `jarvis-bosco`, `jarvis-english-pro`, `jarvis-ia-formacion`, `jarvis-contenidos`
- Crear/actualizar los que falten: secretaria, ia-kids
- Asegurar que `jarvis-gateway` enruta correctamente a cada uno

### Archivos a crear/modificar
- `supabase/functions/_shared/rag-loader.ts` - RAGs estáticos ampliados significativamente
- `supabase/functions/rag-knowledge-builder/index.ts` - NUEVO: builder con Perplexity + Firecrawl
- `supabase/functions/jarvis-gateway/index.ts` - Actualizar routing si necesario
- Migración SQL para tabla `specialist_knowledge`

### Requisitos previos
- Verificar que `PERPLEXITY_API_KEY` y `FIRECRAWL_API_KEY` están configurados (ya existen en `rag-architect`)
- Las claves ya están disponibles en el proyecto

### Estimación
- Fase 1: RAGs ampliados (~3000-4000 líneas de contenido experto)
- Fase 2-3: Sistema dinámico con Perplexity
- Fase 4: Verificación de agentes

Empezaría por la Fase 1 (ampliar RAGs) + Fase 2 (crear el builder) en paralelo, ya que son independientes.

