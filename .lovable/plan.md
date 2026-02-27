

## Plan: Mejorar la visualización del Briefing Extraído (Step 2)

### Problemas actuales
- Todo el briefing está metido en un solo panel scrollable estrecho con labels diminutos (`text-[10px] font-mono`)
- Las secciones son visualmente planas: no hay jerarquía visual clara entre Resumen, Necesidad, Objetivos, etc.
- Los campos editables (Textarea) no se distinguen bien del contenido de solo lectura
- Falta iconografía y color que ayude a escanear rápidamente

### Cambios en `src/components/projects/wizard/ProjectWizardStep2.tsx`

1. **Layout**: Cambiar de grid 2 columnas iguales a layout con panel derecho más ancho (material original colapsable o en drawer, briefing ocupa el ancho completo)

2. **Secciones como cards individuales**: Cada sección (Resumen, Necesidad, Objetivos, Problemas, Stakeholders, etc.) será una card independiente con:
   - Icono representativo + título legible (`text-sm font-semibold`, no `text-[10px] font-mono`)
   - Borde lateral de color por categoría (azul info, verde confirmado, amber pendiente, rojo alertas)
   - Expandible/colapsable con estado visual claro

3. **Campos clave destacados**: Resumen Ejecutivo y Necesidad Principal van en cards prominentes en la parte superior (texto más grande, sin textarea en modo lectura — toggle edición)

4. **Objetivos**: Mostrar como lista con pills de prioridad coloreadas (P0 rojo, P1 amber, P2 verde) y métrica visible

5. **Badges de estado** (Complejidad, Urgencia, Confianza): Mover a una barra superior horizontal junto al título, con colores semánticos

6. **Material original**: Convertir en un panel colapsable/toggle en la parte superior en lugar de ocupar 50% del espacio permanentemente

### Archivos afectados
- `src/components/projects/wizard/ProjectWizardStep2.tsx` — Reescritura del bloque de visualización del briefing (líneas 101-419)

