
# Por qué el brief repite "Plataforma VTC" tantas veces

## Diagnóstico

El problema tiene **dos causas que se amplifican mutuamente**:

### Causa 1: El LLM ya genera repeticiones leves
Cuando Gemini extrae señales de cada chunk, a veces repite el nombre del proyecto en sus descripciones (stuttering del modelo). Esto es leve pero existe.

### Causa 2 (principal): Sustitución cascada de aliases
En `brief-normalizer.ts` (función `cleanupSpanishMarkdown`, líneas 1029-1055), el sistema:

1. Detecta aliases como `"VTC"`, `"plataforma"`, `"Plataforma"` del nombre canónico `"Plataforma VTC"`
2. Aplica reemplazos regex secuenciales: cada alias → `"Plataforma VTC"`
3. **Problema**: al reemplazar `"VTC"` → `"Plataforma VTC"`, el texto resultante ahora contiene un nuevo "Plataforma" que vuelve a matchear como alias, generando una cascada de repeticiones

Ejemplo de cascada:
- Original: `"flota VTC y licencias VTC"`
- Paso 1 (VTC→Plataforma VTC): `"flota Plataforma VTC y licencias Plataforma VTC"`
- Paso 2 (Plataforma→Plataforma VTC): `"flota Plataforma VTC VTC y licencias Plataforma VTC VTC"`
- Y así sucesivamente si hay más pasadas

## Plan de fix

### 1. `brief-normalizer.ts` — Evitar cascada de aliases (cambio principal)

En la sección de sustitución de aliases (línea ~1029), cambiar la estrategia:

- **Excluir aliases que son substrings del `projectName`**: si el projectName es "Plataforma VTC", no reemplazar "VTC" ni "Plataforma" individualmente, porque ya forman parte del nombre canónico y causan cascada.
- Solo reemplazar aliases que son variantes completas (ej: "AFFLUX" → "Afflux", "AFLU" → "AFFLUX").
- Añadir un **post-paso de deduplicación**: regex que detecte el projectName repetido y lo colapse (ej: `"Plataforma VTC Plataforma VTC VTC"` → `"Plataforma VTC"`).

### 2. `clean-brief-builder.ts` — Sanitización de salida

Añadir un paso final en `buildCleanBrief` que limpie repeticiones del projectName en el markdown resultante, como red de seguridad.

### 3. Prompt del chunked-extractor (mejora menor)

Añadir instrucción explícita al prompt: "NO repitas el nombre del proyecto innecesariamente en las descripciones. Usa pronombres o referencia indirecta cuando sea obvio."

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/project-wizard-step/brief-normalizer.ts` | Filtrar aliases substring del projectName; añadir dedup post-reemplazo |
| `supabase/functions/project-wizard-step/clean-brief-builder.ts` | Añadir limpieza de repeticiones en markdown final |
| `supabase/functions/project-wizard-step/chunked-extractor.ts` | Instrucción anti-repetición en prompts de extracción |

## Detalles técnicos

En `brief-normalizer.ts`, la lógica de filtrado sería:

```text
// Antes de añadir un alias como reemplazo, verificar:
// 1. El alias normalizado NO es substring del projectName normalizado
// 2. El projectName normalizado NO es substring del alias normalizado
// (ya cubierto por looksLikeAliasOf pero falta el filtro de substring)
```

El regex de dedup post-reemplazo:

```text
// Colapsar repeticiones: "Plataforma VTC Plataforma VTC VTC" → "Plataforma VTC"
const escapedName = projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = projectName.split(/\s+/);
// Detectar el nombre o partes repetidas adyacentes y colapsar
```
