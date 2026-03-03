

## Plan: Gemini 3.1 Pro + Linter determinista + Normalización nombres

### 3 cambios concretos:

---

### Cambio 1: Modelo Gemini 3.1 Pro (nomenclatura exacta: `gemini-3.1-pro`)

**`supabase/functions/_shared/ai-client.ts`** (líneas 39-40):
```
"gemini-pro": "gemini-3.1-pro",
"gemini-pro-3": "gemini-3.1-pro",
```

**`supabase/functions/project-wizard-step/index.ts`** (línea 162):
```
gemini-2.5-pro → gemini-3.1-pro
```

**`supabase/functions/project-wizard-step/index.ts`** (línea 527):
```
mainModelUsed = "gemini-3.1-pro"
```

**`src/config/projectPipelinePrompts.ts`** (línea 5 y 28): Actualizar comentarios de `Gemini Pro 2.5` → `Gemini 3.1 Pro`.

---

### Cambio 2: Linter determinista post-merge (P0)

Insertar entre la concatenación (línea 612) y la extracción del blueprint (línea 617) un bloque de ~50 líneas que:

1. Verifica las 15 secciones por regex: `# 1.` hasta `# 15.`
2. Verifica existencia de `# LOVABLE BUILD BLUEPRINT`
3. Verifica que el blueprint extraído tenga >100 caracteres
4. Verifica que specs contenga `## D1` y `## D2`

**Lógica de reintento selectivo:**
- Si faltan secciones 11-15 → reintenta solo Part 3
- Si falta Blueprint o D1/D2 → reintenta solo Part 4
- Si faltan secciones 1-10 → no reintenta (error grave, continuar con warning)
- Máximo 1 reintento por parte
- Si tras reintento sigue fallando → continuar con warning en metadata (`linter_warnings`)

El linter es puramente mecánico (string matching), sin LLM.

---

### Cambio 3: Normalización de nombres propios (P0)

En el system prompt del PRD (línea 522-523), reemplazar la regla genérica:

```
## REGLAS DE NOMBRES PROPIOS
Verifica que los nombres de empresas...
```

Por una inyección del nombre canónico del cliente desde `stepData`:

```
## REGLAS DE NOMBRES PROPIOS
El nombre canónico del cliente es: "${companyName}".
Usa SIEMPRE y EXCLUSIVAMENTE esta grafía. Cualquier variación (typos, abreviaciones, traducciones) es un error grave.
Si aparece una variación en los documentos de entrada, corrígela silenciosamente a la forma canónica.
```

Donde `companyName` se extrae de `sd.companyName || sd.briefingJson?.company_name || "el cliente"`.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `supabase/functions/_shared/ai-client.ts` | Aliases → `gemini-3.1-pro` |
| `supabase/functions/project-wizard-step/index.ts` | Modelo en `callGeminiPro`, `mainModelUsed`, linter post-merge (~50 líneas), normalización nombre en system prompt |
| `src/config/projectPipelinePrompts.ts` | Comentarios del modelo |

### Sin cambios
- UI, fases 2-6, 8-9, helpers (`recordCost`, `truncate`, `callGeminiFlash`, `callClaudeSonnet`) — intactos.

