## Plan: Reforzar Sección 15 y Blueprint IA en prompts del PRD ✅ DONE

### Cambios aplicados

1. **REGLA S15 reforzada** (`projectPipelinePrompts.ts` — system prompt):
   - Campos obligatorios detallados por tipo: RAG (Fallback, Guardrails, RAGs vinculados, Métricas, Chunk strategy), Agente (Input/Output JSON, Prompt base, Guardrails, Fallback, Métricas), Orquestador (Componentes coordinados, nota "No requiere LLM")
   - Nueva subsección **15.5 Módulos de Aprendizaje** (tipo KMG)
   - Renumerado: Mapa Interconexiones → 15.6, Resumen Infraestructura → 15.7
   - Regla de completitud por fases: inventario solo-MVP en proyecto multi-fase = ERROR
   - Regla de diferenciación de agentes complementarios
   - Regla de consistencia de modelos LLM entre secciones
   - Nueva validación **V-S15-08**: fases futuras sin componentes = ERROR

2. **Part 3 prompt reforzado** (genera sección 15):
   - Paso 6 de derivación: revisar CADA FASE del roadmap
   - Campos obligatorios explícitos por tipo de componente
   - 7 subsecciones obligatorias (antes 6)
   - Tabla 15.7 con columnas por fase y filas detalladas
   - Instrucción de consistencia de modelos LLM
   - 8 validaciones (antes 7)

3. **Part 5 prompt actualizado** (Lovable Blueprint):
   - Eliminado "NO incluir RAGs, especialistas IA"
   - Añadida tabla obligatoria "Inventario IA (Resumen MVP)" con componentes fase MVP
   - Nota al pie referenciando sección 15 completa para fases posteriores

4. **contracts.ts**: Añadidas secciones requeridas "Módulos de Aprendizaje" y "Resumen de Infraestructura"

### Qué NO cambia
- Pipeline de 6 partes paralelas
- Prompts de Parts 1, 2, 4, 6
- Edge Function de generación
- Schema de base de datos
