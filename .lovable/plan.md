

## 2 Ajustes Finales al Pipeline

### Cambio 1: Regla anti-UI en Sección 15 (Part 4 prompt)

**Archivo:** `supabase/functions/project-wizard-step/index.ts` (~L1459)

Añadir al bloque de instrucciones de la Sección 15, justo después del warning `⚠️ INSTRUCCIÓN CRÍTICA PARA LA SECCIÓN 15:`, esta regla:

```
⚠️ EXCLUSIÓN DE COMPONENTES UI/FRONTEND:
La Sección 15 es EXCLUSIVAMENTE para componentes IA y motores (RAGs, agentes, motores deterministas, orquestadores, Soul, módulos de mejora).
NO incluir en la Sección 15: dashboards, pantallas, formularios, componentes React, páginas, layouts, navegación ni ningún elemento de interfaz de usuario.
Los componentes de frontend/UI se describen en las secciones de flujos (10-14) y en el Blueprint (Part 5), NUNCA en el inventario de componentes IA.
Si un componente no tiene modelo LLM, embedding, fórmula determinista o lógica de scoring, NO pertenece a la Sección 15.
```

### Cambio 2: Validar RAG WhatsApp con Gorka

Esto no es un cambio de código — es una decisión de producto. Cuando regeneres el PRD de F&G/Mirnidón, pregunta a Gorka si el RAG de WhatsApp tiene datos reales disponibles para el MVP. Si no los tiene, mueve manualmente ese componente a `phase: "F2"` en el brief o en la aprobación del scope.

### Deploy
Solo edge function `project-wizard-step`. Sin migraciones, sin frontend.

