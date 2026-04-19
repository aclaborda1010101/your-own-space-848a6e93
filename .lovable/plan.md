
Continúo con el Lote 2 del plan ya aprobado. No hace falta nuevo plan — sigo ejecutando.

## Lote 2 — Salud + Tareas + Calendario

### Salud (`src/pages/Health.tsx` + nuevos componentes)
1. **`HealthMetricRing.tsx` nuevo**: anillo SVG con gradient neon (no plano), glow, número grande dentro, etiqueta debajo. Reutilizable para Recuperación, Sueño, HRV, Esfuerzo.
2. **Hero rediseño**: Recuperación como número GIGANTE `text-7xl font-serif italic`, color dinámico (rojo <34, ámbar 34-66, verde >66), mensaje italic debajo ("Estás en rojo. Prioriza descanso." / "Equilibrio frágil." / "Listo para empujar.").
3. **Reemplazar HealthMeter actual** por HealthMetricRing donde aplique para look más IA/futurista.

### Tareas (`src/pages/Tasks.tsx`)
4. **Selector inline de tipo** en el form "Nueva tarea": pills compactos Profesional · Personal · Privado en una sola fila, full-width agrupado.
5. **Lista pendientes mobile-safe**: quitar overflow horizontal, cards verticales, badges en stack si no caben.

### Calendario (`src/components/calendar/MonthView.tsx`)
6. **Celdas más cuadradas** (`aspect-square` en móvil), número arriba pequeño, **dot debajo si hay eventos** (no listar texto).
7. **Tap día → panel inferior** con tareas/eventos del día (sheet o expandible).

### Archivos a tocar
- `src/components/health/HealthMetricRing.tsx` (nuevo)
- `src/pages/Health.tsx` (hero + métricas)
- `src/pages/Tasks.tsx` (form + lista mobile)
- `src/components/calendar/MonthView.tsx` (celdas + dots + panel día)

### Lo que NO se toca
- Lógica WHOOP, hooks de tasks, lógica de eventos.
- Otras páginas (van en lotes posteriores).

Tras este lote sigue: Lote 3 (Proyectos + Detector + Auditoría) y Lote 4 (Importar + Red Estratégica).
