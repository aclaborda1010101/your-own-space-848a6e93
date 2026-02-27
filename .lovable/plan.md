

## Plan: Reforzar prompts de Fase 4 (Auditoría) y Fase 5 (Doc Final)

### Cambios en `src/config/projectPipelinePrompts.ts`

#### 1. Fase 4 — `AUDIT_SYSTEM_PROMPT` (línea ~259, antes del cierre)
Añadir 3 reglas nuevas al bloque REGLAS:

```
- COMPARA SIEMPRE el orden de implementación del documento con lo acordado en la reunión original. Si el cliente o proveedor propuso demostrar X primero, eso debe reflejarse en Fase 1 del cronograma. Si no coincide, generar hallazgo de tipo INCONSISTENCIA.
- VERIFICA que todos los temas discutidos en la reunión tienen módulo asignado. Si se habló de control horario, pausas, horas extra u otra funcionalidad, debe existir un módulo para ello. Si falta, generar hallazgo de tipo OMISIÓN.
- NO permitas que el documento de alcance baje presupuestos a rangos irrealistas solo para alinear con expectativas del cliente. Si el presupuesto propuesto es insuficiente para el alcance definido, señálalo como hallazgo CRÍTICO de tipo RIESGO_NO_CUBIERTO.
```

#### 2. Fase 5 — `FINAL_DOC_SYSTEM_PROMPT` (línea ~324, antes del cierre)
Añadir 2 reglas nuevas al bloque REGLAS:

```
- NUNCA bajes un presupuesto sin reducir alcance proporcionalmente. Si la auditoría indica que el presupuesto es excesivo para el cliente, la solución NO es poner un precio inferior por el mismo trabajo — es añadir una Fase 0/PoC de bajo coste como punto de entrada y mantener el presupuesto real para el proyecto completo.
- Verifica que TODAS las funcionalidades discutidas en el material original tienen módulo asignado en el documento final. Si alguna falta, añádela al módulo correspondiente o crea uno nuevo.
```

### Archivos afectados
- `src/config/projectPipelinePrompts.ts` — solo prompt text, sin lógica

