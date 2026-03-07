

## Reordenar secciones del wizard y hacer todas colapsables

### Estado actual
El orden actual debajo del pipeline (stepper + step content) es:
1. Live Summary Panel (colapsable ✓)
2. Discovery Panel (colapsable ✓)
3. Activity Timeline (colapsable ✓)
4. Documents Panel (**NO colapsable**)

### Orden solicitado
1. **Resumen vivo** (Live Summary) — ya colapsable
2. **Detección de necesidades** (Discovery) — ya colapsable
3. **Historial de actividad** (Timeline) — ya colapsable
4. **Pipeline** (Stepper + step content) — mover aquí, hacer colapsable
5. **Documentos de proyecto** — hacer colapsable

### Cambios

**`src/pages/ProjectWizard.tsx`**:
- Mover el grid de stepper+step content debajo del Timeline, envuelto en un `Collapsible` con header "Pipeline del proyecto"
- Mover `ProjectDocumentsPanel` al final
- Mantener header, progress bar y cost badge arriba (no se mueven)

**`src/components/projects/wizard/ProjectDocumentsPanel.tsx`**:
- Envolver en `Collapsible` con el mismo patrón visual que los otros paneles (ChevronDown rotable, hover en header)

