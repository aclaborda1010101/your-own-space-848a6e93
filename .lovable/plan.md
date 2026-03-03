

## Plan: Paralelizar Parts 1-3 del PRD con Contexto Compartido

### Problema
Las 4 llamadas secuenciales a Gemini Pro tardan ~250s, superando el timeout de 150s de Edge Functions. Parts 1, 2 y 3 son independientes pero actualmente Parts 2-3 reciben `result1.text` como contexto de continuidad.

### Solución

**`supabase/functions/project-wizard-step/index.ts`** — En el bloque `generate_prd`:

1. **Construir bloque de contexto compartido** antes de las llamadas, extrayendo del briefing y documento de alcance:

```typescript
// Extraer nombres canónicos del briefing
const briefObj = typeof sd.briefingJson === 'object' ? sd.briefingJson : {};
const companyName = sd.companyName || briefObj.company_name || briefObj.cliente?.empresa || 'el cliente';
const modules = /* extraer módulos del scopeDocument (headers ##) o del briefObj.modulos */ ;
const roles = /* extraer roles del briefObj.personas o briefObj.roles */ ;

const sharedContext = `CONTEXTO COMPARTIDO (para consistencia de nombres):
- Empresa: ${companyName}
- Módulos: ${modules}
- Roles: ${roles}
- Fase objetivo: ${targetPhase}

DOCUMENTO FINAL APROBADO:
${finalStr}

AI LEVERAGE (oportunidades IA):
${aiLevStr}

BRIEFING ORIGINAL:
${briefStr}`;
```

2. **Modificar prompts de Parts 2 y 3**: reemplazar las referencias a `result1.text` / `result2.text` por el `sharedContext`. El prompt de Part 1 ya no necesita cambios (usa `contextBlock` que es equivalente).

3. **Ejecutar Parts 1-3 en paralelo**:
```typescript
const [result1, result2, result3] = await Promise.all([
  callPrdModel(prdSystemPrompt, userPrompt1),
  callPrdModel(prdSystemPrompt, userPrompt2),
  callPrdModel(prdSystemPrompt, userPrompt3),
]);
```

4. **Part 4 y Validation** siguen secuenciales (dependen de Parts 1-3).

5. **Actualizar prompts de retry del linter** para usar `sharedContext` en vez de `result1.text`.

### Cambios concretos en los prompts

- **userPrompt1**: sin cambios (ya usa `contextBlock` propio)
- **userPrompt2** (línea ~586): reemplazar `PARTE 1 YA GENERADA (para continuidad):\n${result1.text}` → `${sharedContext}`
- **userPrompt3** (línea ~595): reemplazar `PARTES 1 Y 2 YA GENERADAS:\n${result1.text}\n---\n${result2.text}` → `${sharedContext}`
- **userPrompt1**: actualizar para usar `sharedContext` en vez de `contextBlock` para uniformidad

### Resultado esperado
- Tiempo total: ~73s (max Part) + ~60s (Part 4) + ~20s (Validation) ≈ **~153s**
- Las 3 partes usan vocabulario idéntico (empresa, módulos, roles) → la validación cruzada (Call 5) solo necesita pillar inconsistencias residuales

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `supabase/functions/project-wizard-step/index.ts` | Bloque `generate_prd`: construir sharedContext, Promise.all para Parts 1-3, actualizar prompts 2-3 |

