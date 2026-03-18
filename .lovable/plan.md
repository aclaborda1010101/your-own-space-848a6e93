

## Plan: Mejorar comprensión contextual de terceros en análisis familiar y sugerencias

### Problema
El sistema atribuye temas de salud/médicos al contacto directamente, cuando en realidad la conversación habla sobre un TERCERO (la hermana de "Mi Nena" que está hospitalizada). Esto causa:
- `proxima_accion`: "Preguntarle por la medicación" (parece que es SU medicación)
- Sugerencias WhatsApp: "¿Qué tal la medicación?" (como si ella fuera la paciente)

### Causa raíz
1. La `FAMILIAR_LAYER` en `contact-analysis` no instruye al modelo a distinguir entre salud del contacto vs. salud de terceros mencionados
2. La `proxima_accion.que` no incluye contexto de A QUIÉN se refiere la acción
3. El `generate-response-draft` recibe un `proactive_context` ambiguo sin saber que la medicación es de la hermana

### Cambios

**1. `supabase/functions/contact-analysis/index.ts`**

En `FAMILIAR_LAYER` (línea ~156), añadir regla de atribución de terceros:

```
### ⚠️ ATRIBUCIÓN DE SITUACIONES A TERCEROS — CRÍTICO
- Cuando el contacto HABLA SOBRE un familiar (hermana, madre, hijo, etc.) que tiene un problema de salud, 
  la situación es DEL FAMILIAR, NO del contacto.
- Ejemplo: Si "Mi Nena" cuenta que su hermana está en el hospital → la hospitalización es de LA HERMANA, 
  no de "Mi Nena". "Mi Nena" es quien informa/acompaña.
- En proxima_accion, ESPECIFICA siempre a quién te refieres: 
  "Preguntarle cómo sigue su hermana con la medicación" NO "Preguntarle por la medicación".
- En alertas de salud, indica QUIÉN es el afectado: "Hermana hospitalizada" NO "Contacto hospitalizado".
```

En el schema de `proxima_accion` (línea ~1119), reforzar:

```
"que": "...Cuando la acción se refiera a un tercero (familiar del contacto, compañero, etc.), 
ESPECIFICA a quién: 'Preguntarle cómo sigue su hermana en el hospital' NO 'Preguntarle por el hospital'."
```

En la sección de bienestar familiar (línea ~176), añadir campo de terceros:

```
"salud_terceros": [{ "quien": "hermana/madre/hijo...", "situacion": "...", "estado": "..." }]
```

**2. `supabase/functions/generate-response-draft/index.ts`**

En el `systemPrompt` (línea ~150), añadir regla de contexto de terceros:

```
8. CONTEXTO DE TERCEROS: Si el historial habla de la salud/situación de un FAMILIAR del contacto 
   (su hermana, su madre, etc.), NO asumas que el contacto es el afectado. 
   Pregunta por ESA persona específica: "qué tal tu hermana?" NO "qué tal la medicación?".
   Lee el historial para entender QUIÉN es el paciente/afectado.
```

### Archivos a editar
- `supabase/functions/contact-analysis/index.ts` (FAMILIAR_LAYER + schema proxima_accion)
- `supabase/functions/generate-response-draft/index.ts` (regla de terceros en systemPrompt)

### Resultado esperado
- Próxima acción: "Preguntarle cómo sigue su hermana en el hospital y cómo lleva ella la situación"
- Sugerencias: "Ey cariño, cómo va tu hermana? ha mejorado?" (natural, refiriéndose a la persona correcta)

