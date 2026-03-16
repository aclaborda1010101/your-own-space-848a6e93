## Plan: Reemplazar prompts Alcance → Auditoría IA → Part 4 PRD ✅ DONE

### Cambios aplicados en `project-wizard-step/index.ts`

1. **Alcance (Step 10)**: System prompt expandido para preservar granularidad IA. User prompt con 10 secciones incluyendo "Inventario Preliminar de Componentes IA" (tabla tipada RAG/AGENTE_IA/MOTOR_DETERMINISTA/ORQUESTADOR/MODULO_APRENDIZAJE con columna Fase y Origen en briefing).

2. **Auditoría IA (Step 11)**: Prompt reemplazado por JSON estructurado con `componentes_validados[]` (modelo, temperatura, fase, rags_vinculados), `componentes_faltantes[]`, `rags_recomendados[]`, `validaciones` (flags de consolidación incorrecta), `stack_ia` y `services_decision`. Ya no trunca el briefing ni el alcance.

3. **Part 4 (Sección 15)**: Inyección directa de `auditComponentsBlock` (componentes_validados + rags_recomendados + componentes_faltantes del JSON de auditoría) + briefing original. 7 subsecciones obligatorias (15.1-15.7) con columna Fase en todas las tablas, 15.4 Orquestadores y 15.5 Módulos de Aprendizaje obligatorios.

4. **Part 6 Blueprint**: Inventario IA reemplazado por tabla explícita de componentes MVP + nota de referencia a sección 15 para fases posteriores.

### Flujo de información corregido

```
Briefing (granular) → Alcance (inventario preliminar tipado)
    → Auditoría IA (JSON validado con modelo/temp/fase)
        → Part 4 / Sección 15 (7 subsecciones, todas las fases)
            → Expert Forge (lee sección 15 e instancia)
```
