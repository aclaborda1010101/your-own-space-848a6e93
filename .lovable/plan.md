
# Cuestionario fijo de farmacia para AI Business Leverage

## Problema

El cuestionario se genera dinamicamente via IA, lo que significa que no se puede controlar con precision las preguntas, el orden ni las opciones. El usuario necesita un cuestionario fijo de 12 preguntas especificas para el sector farmaceutico, con un orden concreto y opciones exactas.

## Solucion

Hardcodear un cuestionario fijo para el sector farmaceutico en la Edge Function. Cuando el sector detectado sea farmacia/farmaceutico, usar el cuestionario fijo en vez de llamar a Claude.

## Cambios en `supabase/functions/ai-business-leverage/index.ts`

### En la accion `generate_questionnaire` (lineas 83-147):

Antes de llamar a Claude, comprobar si el sector es farmacia. Si lo es, usar directamente las 12 preguntas fijas sin llamar a la IA:

**Las 12 preguntas en orden:**

| # | Pregunta | Tipo | Area |
|---|----------|------|------|
| 1 | Sistema de gestion actual | single_choice | software |
| 2 | Frecuencia de desabastecimientos | single_choice | operations |
| 3 | Numero de farmacias | single_choice | operations |
| 4 | Datos historicos disponibles (>=2 anos) | single_choice | data |
| 5 | Principal dolor del desabastecimiento | open | pain_points |
| 6 | Metodos actuales de prediccion de demanda | single_choice | operations |
| 7 | Acceso a alertas AEMPS/CISMED (nueva) | single_choice | data |
| 8 | Integracion de datos externos | multi_choice | data |
| 9 | Numero de proveedores | single_choice | operations |
| 10 | Personas dedicadas a inventario/compras | single_choice | team |
| 11 | Nivel de automatizacion en reposicion | single_choice | operations |
| 12 | Presupuesto anual en tecnologia | single_choice | budget |

**Cambios especificos:**
- Eliminar preguntas de CRM, marketing digital y ratio prescripcion/libre
- Anadir pregunta sobre alertas AEMPS/CISMED con 4 opciones
- Todos los importes en euros con rangos: <5.000, 5.000-15.000, 15.000-30.000, 30.000-60.000, >60.000
- Deteccion de sector farmacia via regex (farmacia, pharmaceutical, etc.)

### Logica de deteccion

```
const isFarmacia = /farmac|pharma/i.test(sector);
if (isFarmacia) {
  // usar cuestionario fijo
} else {
  // llamar a Claude como antes
}
```

El resto del flujo (guardar template, crear response con `_questions`) permanece igual.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/ai-business-leverage/index.ts` | Cuestionario fijo farmacia antes de la llamada a Claude |

## Sin cambios de base de datos

El cuestionario fijo se guarda en las mismas tablas (`bl_questionnaire_templates`, `bl_questionnaire_responses`) con el mismo formato.
