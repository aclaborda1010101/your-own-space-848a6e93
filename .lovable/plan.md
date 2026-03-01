

## Plan: Mínimo 15 preguntas en cuestionario de auditoría IA

### Problema
El número de preguntas depende del tamaño del negocio (`maxQ`): micro=8, small=12, medium=15, large=20. Para negocios micro/small se generan menos de 15 preguntas, insuficientes para evaluar el alcance real. Además, el cuestionario hardcodeado de farmacia solo tiene 13 preguntas.

### Cambios

**`supabase/functions/ai-business-leverage/index.ts`**

1. **Línea 237**: Cambiar el cálculo de `maxQ` para que el mínimo sea 15:
   ```js
   const maxQ = Math.max(15, size === "micro" ? 15 : size === "small" ? 15 : size === "medium" ? 18 : 22);
   ```
   Simplificado: `const maxQ = size === "large" ? 22 : size === "medium" ? 18 : 15;`

2. **Cuestionario farmacia (líneas 252-323)**: Añadir 2 preguntas adicionales (actualmente tiene 13, necesita al menos 15). Preguntas a añadir:
   - `q13`: "¿Ofrecen servicios adicionales como formulación magistral, dermofarmacia, nutrición u ortopedia?" (single_choice) — para identificar líneas de negocio adicionales con potencial de digitalización.
   - `q14`: "¿Qué canales digitales utilizan para comunicarse con sus pacientes/clientes?" (multi_choice: WhatsApp, Email, App propia, Redes sociales, Web con e-commerce, Ninguno) — para evaluar madurez digital en captación y fidelización.

3. **Prompt de Claude (línea 332)**: Actualizar instrucción a `Genera exactamente ${maxQ} preguntas` en lugar de `Máximo ${maxQ} preguntas` para asegurar que siempre se generen al menos 15.

