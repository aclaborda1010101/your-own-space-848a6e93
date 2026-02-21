

# Fix: Scores faltantes y cuantificacion en hallazgos

## Bug 1: Scores Digital Maturity y AI Opportunity no se muestran

### Causa raiz

En `useBusinessLeverage.tsx` linea 150, al recibir la respuesta de Claude, se hace:

```text
{ ...data.diagnostic.scores, ...data.diagnostic.critical_findings, ... }
```

Claude devuelve los scores como `digital_maturity` y `ai_opportunity` (sin sufijo `_score`), pero el componente `DiagnosticTab` busca `digital_maturity_score` y `ai_opportunity_score`. Los otros dos (`automation_level` y `data_readiness`) coinciden por casualidad.

La edge function los mapea correctamente al guardar en DB (lineas 280-283), pero el `setDiagnostic` intermedio usa las claves incorrectas. `loadExisting` deberia corregirlo al recargar de DB, pero como hasta ahora el upsert fallaba (constraint faltante, ya corregido), nunca habia datos en DB.

### Solucion

Modificar `useBusinessLeverage.tsx` linea 150 para mapear correctamente las claves de la respuesta de Claude:

```text
setDiagnostic({
  digital_maturity_score: data.diagnostic.scores.digital_maturity,
  automation_level: data.diagnostic.scores.automation_level,
  data_readiness: data.diagnostic.scores.data_readiness,
  ai_opportunity_score: data.diagnostic.scores.ai_opportunity,
  ...data.diagnostic.critical_findings,
  data_gaps: data.diagnostic.data_gaps,
  id: data.id,
  project_id: projectId,
})
```

---

## Bug 2: Hallazgos sin cuantificacion de impacto

### Causa

El prompt de Claude en `ai-business-leverage/index.ts` (lineas 237-272) no pide cuantificacion en los hallazgos criticos. Solo pide arrays de strings descriptivos.

### Solucion

**Cambio 1: Actualizar el prompt de `analyze_responses`** en la edge function para pedir cuantificacion obligatoria en cada hallazgo.

El formato de cada item en los arrays cambia de `"string"` a un string que incluye la descripcion + cuantificacion en formato enriquecido:

```text
"manual_processes": [
  "Descripcion del proceso manual. Ahorro estimado: X-Y horas/semana. Fuente: estimacion logica."
]
```

Reglas que se anaden al prompt:
- SIEMPRE usar rangos, nunca cifras absolutas
- SIEMPRE indicar fuente (benchmark sectorial / caso similar / estimacion logica)
- Ser conservador cuando hay incertidumbre
- Si no se puede estimar, indicar "Requiere datos del negocio para cuantificar"

El formato sigue siendo `string[]` en la DB (no cambia el schema), pero cada string ahora contiene la cuantificacion integrada.

**Cambio 2: Actualizar el formato de `data_gaps`** para incluir cuantificacion en los campos `impact` y `unlocks`:

```text
{
  "gap": "Datos historicos sin explotacion predictiva",
  "impact": "Reduccion estimada de desabastecimientos: 15-25%. Fuente: benchmark sector farmaceutico.",
  "unlocks": "Prediccion de demanda automatizada. Oportunidad estimada: EUR2.000-5.000/mes."
}
```

**Cambio 3: Actualizar `DiagnosticTab.tsx`** para mejorar el renderizado de hallazgos cuantificados:
- Separar visualmente la descripcion de la cuantificacion
- Mostrar la cuantificacion en un estilo diferenciado (color mas sutil, badge)

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useBusinessLeverage.tsx` | Mapeo explicito de claves de scores (linea 150) |
| `supabase/functions/ai-business-leverage/index.ts` | Prompt de analyze_responses con cuantificacion obligatoria |
| `src/components/projects/DiagnosticTab.tsx` | Renderizado mejorado para hallazgos cuantificados |

## Resultado esperado

- Los 4 scores siempre visibles: Digital Maturity, Automation Level, Data Readiness, AI Opportunity
- Cada hallazgo incluye estimacion de impacto con rango, fuente y nivel de confianza
- Data gaps incluyen cuantificacion economica
- El formato es compatible con el schema existente (no requiere migracion SQL)

