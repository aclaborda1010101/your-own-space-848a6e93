

## Plan: Reforzar Sección 15 y Blueprint IA en prompts del PRD

### Diagnóstico

Las reglas actuales en `projectPipelinePrompts.ts` ya describen que la Sección 15 debe ser un inventario COMPLETO de todas las fases. Sin embargo, el LLM las ignora parcialmente porque:

1. **Part 3 prompt** (genera sección 15): Las instrucciones de derivación son correctas pero les falta especificidad sobre los campos obligatorios por tipo de componente y sobre las subsecciones 15.4 (Orquestadores) y 15.5 (Módulos de Aprendizaje).
2. **Part 5 prompt** (Lovable Blueprint): Dice "NO incluir RAGs, especialistas IA" pero debería incluir una tabla resumen de los componentes MVP del inventario IA con referencia a la sección 15 completa.
3. **Falta enforcement explícito**: No hay una regla que diga "si el proyecto tiene fases 2-4 con componentes IA mencionados en el scope/briefing, la sección 15 DEBE tener más componentes que solo los del MVP".

### Cambios en `src/config/projectPipelinePrompts.ts`

**1. Reforzar la REGLA S15 en el system prompt (líneas ~412-469)**

Añadir reglas más específicas:

- **Campos obligatorios por tipo de componente**: Especificar exactamente qué campos debe tener cada RAG, cada Agente, cada Motor, cada Orquestador y cada Módulo de Aprendizaje (nueva categoría 15.5). Actualmente solo hay tablas genéricas; añadir campos como `Fallback`, `Guardrails`, `RAGs vinculados`, `Métricas target` como obligatorios, no opcionales.
- **Nueva subsección 15.5 Módulos de Aprendizaje**: Añadir al formato obligatorio la subsección para componentes que aprenden de datos históricos (tipo KMG). Renumerar Mapa Interconexiones a 15.6 y Resumen Infraestructura a 15.7.
- **Regla de completitud por fases**: "Si el Documento de Alcance define funcionalidades para Fase 2, 3 o 4 que implican IA, la sección 15 DEBE contener componentes con esas fases. Un inventario que solo tiene componentes MVP cuando el proyecto tiene roadmap de fases futuras es INCOMPLETO y debe corregirse."
- **Diferenciación explícita entre agentes complementarios**: "Si dos agentes operan sobre el mismo tipo de input (ej. emails) pero con funciones diferentes (clasificación de intención vs clasificación documental), ambos deben existir como componentes separados con nota explicativa de por qué no son redundantes."
- **Añadir validación V-S15-08**: "¿Hay fases futuras en el Documento de Alcance con componentes IA implícitos que no aparecen en la sección 15? Si sí → ERROR. Añadir con fase correcta."

**2. Reforzar Part 3 prompt (líneas ~519-553)**

Añadir instrucciones más explícitas:

- "Para CADA componente, incluir TODOS los campos obligatorios del formato de la REGLA S15. No resumir ni omitir campos."
- "Incluir subsección 15.5 Módulos de Aprendizaje si el proyecto tiene componentes que aprenden de datos históricos."
- "La tabla 15.7 (Resumen Infraestructura) debe tener columnas por fase (MVP, Fase 2, Fase 3, Fase 4, Total) y filas para cada tipo de componente más coste IA mensual estimado, Edge Functions nuevas y Secrets adicionales."
- "Si el modelo LLM de un componente difiere entre secciones del PRD (ej. sección 14 dice gpt-4o-mini pero sección 15 dice gpt-4o), UNIFICAR al valor técnicamente correcto y documentar la decisión."

**3. Actualizar Part 5 prompt — Lovable Blueprint (líneas ~580-604)**

Cambiar la línea que dice "NO incluir: RAGs, especialistas IA" para añadir una excepción:

- "Incluir una tabla 'Inventario IA (Resumen MVP)' con TODOS los componentes de la sección 15 que tienen fase MVP. Columnas: ID, Nombre, Tipo, Rol, Modelo LLM, Fase."
- "Añadir nota al pie: 'Los componentes de fases posteriores están documentados en la sección 15 del PRD completo pero NO se implementan en este Blueprint.'"

### Resultado esperado

- La sección 15 contendrá TODOS los componentes de TODAS las fases (no solo MVP)
- Cada componente tendrá campos completos (fallback, guardrails, RAGs vinculados, métricas)
- El Lovable Blueprint incluirá tabla resumen de componentes MVP con referencia al inventario completo
- Las inconsistencias de modelo LLM entre secciones se detectarán y corregirán automáticamente

