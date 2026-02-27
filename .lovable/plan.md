

## Plan: Renombrar "AI Leverage" → "Auditoría IA" en todo el pipeline

Hay 3 archivos donde el paso 6 aún dice "AI Leverage" en inglés. El resto del pipeline ya usa nombres en español.

### Cambios

1. **`src/config/projectPipelinePrompts.ts`** (línea 10)
   - `"AI Leverage"` → `"Auditoría IA"`

2. **`src/hooks/useProjectWizard.ts`** (línea 47)
   - `"AI Leverage"` → `"Auditoría IA"`

3. **`src/components/projects/wizard/ProjectCostBadge.tsx`** (línea 15)
   - `"AI Leverage"` → `"Auditoría IA"`

Solo texto de UI, sin cambios de lógica ni prompts.

