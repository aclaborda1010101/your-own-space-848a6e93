

## Plan: Reemplazar Parts 5/6 por un único Blueprint combinado

### Diagnóstico

Actualmente el PRD se genera en 6 llamadas LLM:
- Parts 1-4: Secciones 1-20 del PRD
- Part 5 (L1608): Secciones 21-25 (UX, Telemetría, Riesgos, Fases, Matriz)
- Part 6 (L1632): Blueprint + Checklist + Specs + Glosario

El nuevo prompt del usuario **fusiona Parts 5 y 6** en una sola llamada que genera directamente el Blueprint completo con inventario IA detallado, eliminando las secciones 21-25 intermedias.

### Cambios en `supabase/functions/project-wizard-step/index.ts`

**1. Eliminar Part 5 completa (L1607-1616)**
- Eliminar `userPrompt5`, su llamada `callPrdModel`, contadores de tokens y logs.
- Eliminar `truncP` (ya no se necesita para resumir 5 partes).

**2. Reemplazar `userPrompt6` (L1618-1632) por el nuevo prompt combinado**
- El nuevo prompt recibe Parts 1-4 completas (no truncadas).
- Genera: Blueprint (con inventario IA de 8 columnas incluyendo Temp y Edge Function), Checklist Maestro (P0/P1/P2), Specs para fases posteriores.
- Termina con `---END_PART_5---`.
- Preservar la inyección de `servicesDecision` (secrets, proxies) que ya existe en L1619-1631.

**3. Ajustar el ensamblaje del documento final (L1645-1698)**
- `earlyFullPrd` une `result1-4 + result5` (antes era result1-6).
- Cambiar regex de `---END_PART_[1-6]---` a `---END_PART_[1-5]---`.
- Actualizar progress de "6 partes" a "5 partes".
- Las variables `result5` y `result6` se renombran: el nuevo Blueprint pasa a ser `result5`.

**4. Ajustar la validación (L1700+)**
- La validación recibe P1-P5 (no P1-P6).
- Ajustar el prompt de validación y los logs.

### Estructura del nuevo prompt (resumen)

```text
PARTES 1-4 → Blueprint con:
  - Contexto, Stack, Pantallas, Wireframes, Componentes
  - Base de Datos SQL completa (incluye tablas IA)
  - Edge Functions detalladas
  - ⚠️ Inventario IA MVP (8 columnas, validación cruzada con sección 15.7)
  - Design System, Auth, QA
  - Checklist P0/P1/P2
  - Specs fases futuras
→ ---END_PART_5---
```

### Archivo modificado

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `project-wizard-step/index.ts` | 1606-1640 | Eliminar Part 5, reemplazar Part 6 por prompt combinado |
| `project-wizard-step/index.ts` | 1645-1710 | Ajustar ensamblaje y validación a 5 partes |

### Post-cambio
Redeploy de `project-wizard-step`.

