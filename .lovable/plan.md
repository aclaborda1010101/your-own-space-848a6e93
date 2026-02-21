

# Recalibracion completa: red de 3.800 farmacias

## Resumen de cambios

7 correcciones que afectan al cuestionario, la radiografia, las recomendaciones y el roadmap. Todo se resuelve en 4 archivos.

---

## 1. Cuestionario: campo de texto libre para numero exacto

**Archivo:** `supabase/functions/ai-business-leverage/index.ts` (lineas 100-166)

Anadir pregunta `q3b` condicional despues de `q3`. Cuando la respuesta a q3 es "Mas de 50 farmacias", se muestra un campo de texto libre:

```text
{
  id: "q3b",
  question: "Indica el numero exacto de puntos de venta en tu red",
  type: "open",
  options: null,
  internal_reason: "Dato critico para escalar calculos de impacto",
  priority: "high",
  area: "operations"
}
```

**Archivo:** `src/components/projects/QuestionnaireTab.tsx`

Anadir logica condicional: si `q3 === "Mas de 50 farmacias"`, renderizar `q3b`. Esto requiere comprobar `localResponses["q3"]` y mostrar/ocultar `q3b` dinamicamente.

---

## 2. Extraer numero real de red y pasarlo a todos los prompts

**Archivo:** `supabase/functions/ai-business-leverage/index.ts`

En `analyze_responses` y `generate_recommendations` y `generate_roadmap`, extraer el numero de puntos de venta de las respuestas:

```text
const networkSize = parseInt(responses["q3b"]) || null;
const networkLabel = networkSize ? `${networkSize} farmacias` : responses["q3"] || "desconocido";
```

Inyectar en TODOS los prompts de Claude:
- `analyze_responses`: "Tamano real de la red: {networkLabel}"
- `generate_recommendations`: mismo dato + reglas de calculo unitario
- `generate_roadmap`: mismo dato

---

## 3. Radiografia: mostrar "Tamano real de la red"

**Archivo:** `src/components/projects/DiagnosticTab.tsx`

Anadir un banner visible encima de los scores cuando el diagnostico tenga el dato de red. Para esto, guardar `network_size` en `bl_diagnostics`.

**Migracion SQL:**
```sql
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS network_size integer;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS network_label text;
```

En la edge function, guardar `network_size` y `network_label` al hacer upsert del diagnostico.

En `DiagnosticTab.tsx`, mostrar:
```text
Tamano real de la red: 3.800 farmacias
```
como un badge/card destacado antes de los scores.

---

## 4. Recomendaciones: calculo unitario + total

**Archivo:** `supabase/functions/ai-business-leverage/index.ts` (prompt de `generate_recommendations`)

Modificar el prompt para incluir reglas obligatorias:

```text
REGLAS DE CALCULO UNITARIO (OBLIGATORIAS):
- Para cada recomendacion, calcular PRIMERO el impacto por farmacia media individual
- Luego escalar a la red total ({networkSize} farmacias)
- revenue_impact_month_range: impacto TOTAL de la red, no unitario
- En "description", incluir SIEMPRE: "Impacto por farmacia: EUR X-Y/mes. Impacto total red (x{networkSize}): EUR X-Y/mes"

INVERSIONES CENTRALIZADAS (no escalan linealmente):
- Capa 1 (Quick Wins): EUR 500-1.500/mes (plataforma centralizada)
- Capa 2 (Workflow): EUR 5.000-12.000/mes (integracion de {networkSize} puntos de datos)
- Capa 3 (Ventaja): EUR 15.000-30.000/mes (infraestructura predictiva)
- Capa 4 (Nuevos ingresos): inversion segun validacion de mercado

HORAS AHORRADAS:
- Se refieren al equipo central de 4-6 personas, NO escalan con farmacias
- Rango maximo realista: 30-60h/semana de analisis manual recuperable

CONFIANZA:
- Capa 4 con {networkSize} farmacias generando datos predictivos: confianza "medium" (no "low")
- Una red de {networkSize} farmacias tiene volumen suficiente para vender insights a laboratorios

COHERENCIA OBLIGATORIA:
- Inversion mensual NUNCA debe superar el 50% del impacto estimado mensual
- Si confianza es "low", NO mostrar rangos de euros, solo descripcion cualitativa
- Cada numero debe pasar el "test de la servilleta"
- Ser conservador en el unitario por farmacia
```

**Archivo:** `src/components/projects/RecommendationsTab.tsx`

Modificar el renderizado de cada recomendacion para mostrar:
- Linea de "Impacto por farmacia" (extraida de la description)
- Linea de "Impacto total red" (el revenue_impact existente)
- Ocultar rangos de euros cuando `confidence_display === "low"`

---

## 5. Roadmap: inyectar datos de red

**Archivo:** `supabase/functions/ai-business-leverage/index.ts` (prompt de `generate_roadmap`)

Anadir al prompt: "Tamano de la red: {networkSize} farmacias" y las mismas reglas de coherencia.

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| Migracion SQL | `network_size` y `network_label` en `bl_diagnostics` |
| `supabase/functions/ai-business-leverage/index.ts` | q3b en cuestionario, extraer network_size, inyectar en 3 prompts, reglas unitarias/inversion/horas/confianza/coherencia |
| `src/components/projects/QuestionnaireTab.tsx` | Renderizar q3b condicionalmente |
| `src/components/projects/DiagnosticTab.tsx` | Mostrar banner "Tamano real de la red" |
| `src/components/projects/RecommendationsTab.tsx` | Mostrar impacto unitario vs total, ocultar euros en low confidence |

## Resultado esperado

- Cuestionario captura el numero exacto de farmacias
- Radiografia muestra "Tamano real de la red: 3.800 farmacias"
- Cada recomendacion muestra impacto unitario (por farmacia) e impacto total (red)
- Inversiones calibradas: Capa 1 EUR500-1.500, Capa 2 EUR5.000-12.000, Capa 3 EUR15.000-30.000
- Horas: maximo 30-60h/semana (equipo central)
- Capa 4: confianza "medium" con 3.800 farmacias
- Nunca inversion > 50% del impacto
- Confianza "low" = sin euros, solo cualitativo
- Todo persiste en DB y sobrevive navegacion

