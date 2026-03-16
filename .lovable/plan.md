

## Plan: Reemplazar prompts de Alcance, Auditoría IA y Part 4 del PRD

### Diagnóstico

El flujo actual pierde granularidad en dos puntos:
1. **Alcance (L1138-1142)**: Prompt genérico de 4 líneas que comprime componentes IA en módulos.
2. **Auditoría (L1186-1192)**: Pide "oportunidades IA" genéricas, no un inventario validado con modelo/temperatura/fase.
3. **Part 4 (L1553-1562)**: Sección 15 con solo 5 subsecciones, sin columna Fase, sin inyección directa de auditoría.

El `sharedContext` (L1494-1507) ya incluye `briefStr` y `aiLevStr`, pero Part 4 no los aprovecha correctamente.

### Cambios en `supabase/functions/project-wizard-step/index.ts`

**Bloque 1 — Alcance (L1137-1142)**
Reemplazar system + user prompt con el nuevo que exige:
- Sección 4 "Inventario Preliminar de Componentes IA" con tabla tipada (RAG/AGENTE_IA/MOTOR_DETERMINISTA/ORQUESTADOR/MODULO_APRENDIZAJE) y columna Fase.
- Sección 5.2 vinculada al inventario.
- 10 secciones completas (Resumen, Objetivos, Stakeholders, Inventario IA, Alcance, Arquitectura, Fases, Integraciones, Riesgos, Pendientes).

**Bloque 2 — Auditoría IA (L1186-1192)**
Reemplazar system + user prompt con el nuevo que genera JSON estructurado con:
- `componentes_validados[]` (id, nombre, tipo, modelo, temperatura, fase, rags_vinculados, estado).
- `componentes_faltantes[]` con justificación.
- `rags_recomendados[]` separados por fuente.
- `validaciones` (conteos, flags de consolidación incorrecta).

**Bloque 3 — Part 4 userPrompt4 (L1553-1562)**
Reemplazar con el nuevo que:
- Inyecta explícitamente `auditData.componentes_validados` y `auditData.rags_recomendados` (extraídos del JSON de auditoría, no truncados).
- Pide usar 3 fuentes: Auditoría (primaria), Briefing (granularidad), Parts 1-3 (contexto).
- Define 7 subsecciones obligatorias (15.1-15.7) con todas las columnas exactas y columna Fase.
- Secciones 16-20 sin cambios.

**Bloque 4 — Part 6 Blueprint (L1598)**
En `userPrompt6`, reemplazar la línea de inventario IA por tabla MVP explícita + nota de referencia a sección 15.

### Cambio de inyección de datos (L1553-1566)

Antes de construir `userPrompt4`, extraer los componentes validados del audit:

```text
// Extract audit components for Part 4 injection
let auditComponentsBlock = "";
try {
  const auditObj = typeof sd.aiLeverageJson === 'object' ? sd.aiLeverageJson : {};
  if (auditObj.componentes_validados) {
    auditComponentsBlock += "\nCOMPONENTES VALIDADOS (Auditoría IA):\n" + JSON.stringify(auditObj.componentes_validados, null, 2);
  }
  if (auditObj.rags_recomendados) {
    auditComponentsBlock += "\nRAGs RECOMENDADOS (Auditoría IA):\n" + JSON.stringify(auditObj.rags_recomendados, null, 2);
  }
  if (auditObj.componentes_faltantes) {
    auditComponentsBlock += "\nCOMPONENTES FALTANTES (Auditoría IA):\n" + JSON.stringify(auditObj.componentes_faltantes, null, 2);
  }
} catch { /* fallback to existing aiLevStr */ }
```

Luego inyectar en `userPrompt4`:
```text
const userPrompt4 = `PARTES 1-3:\nP1:\n${result1.text}\nP2:\n${result2.text}\nP3:\n${result3.text}
${auditComponentsBlock}
BRIEFING ORIGINAL:\n${briefStr}
${servicesBlockP4}
GENERA SECCIONES 15-20...`
```

### Archivos modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `supabase/functions/project-wizard-step/index.ts` | 1137-1142 | Scope prompt completo |
| `supabase/functions/project-wizard-step/index.ts` | 1186-1192 | Audit prompt completo con JSON schema |
| `supabase/functions/project-wizard-step/index.ts` | 1553-1562 | Part 4 con 7 subsecciones + inyección audit+briefing |
| `supabase/functions/project-wizard-step/index.ts` | 1598 | Blueprint con tabla MVP |

### Post-cambio

Redeploy de `project-wizard-step` via `supabase--deploy_edge_functions`.

