## Corrección Estructural Completa — COMPLETADA

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/project-wizard-step/index.ts` | Regla precedencia + check final + anti-flat guard (Part 4) + bloqueo MVP absoluto + naming por capas (Part 5) |
| `supabase/functions/project-wizard-step/manifest-schema.ts` | Prioridad de fuente Sección 15 + prohibiciones anti-invención + buildManifestCompilationPrompt reforzado |
| `supabase/functions/publish-to-forge/index.ts` | Regla de precedencia absoluta: no re-inferir si manifest existe |
| `src/components/projects/wizard/ManifestViewer.tsx` | Badges de gobernanza: sensitivity_zone, automation_level, requires_human_approval (candado), execution_mode |
| `src/config/projectPipelinePrompts.ts` | Header LEGACY para evitar drift con flujo chained |

### Edge functions desplegadas
- `project-wizard-step` ✅
- `publish-to-forge` ✅
