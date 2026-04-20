

## Qué quieres

Reorganizar `/red-estrategica` en 3 puntos concretos:

1. **Toolbar superior limpio en una línea ancho completo**: solo `Buscar contacto` + toggle vista (cards/lista) + `Añadir contacto`. **Fuera** de esta línea: las 3 acciones pesadas (Actualizar novedades, Regenerar perfiles, Re-importar multimedia).
2. **Acciones pesadas en su propia línea ancho completo, debajo del buscador**: las 3 juntas, separadas visualmente del flujo de búsqueda.
3. **Filtros (Relación / Salud / Actividad) colapsados en una sola fila con desplegables** (no 3 filas de píldoras siempre visibles).
4. **Fichas de contacto rediseñadas** al estilo de los KPIs de arriba (Contactos / Activos 7d / Críticos / Podcasts): score grande tipo "8" / "9" en la esquina (no anillo SVG con número minúsculo), más respiración, más jerarquía visual, más información por ficha.

## Cómo lo voy a hacer

### Layout nuevo de la zona superior (`src/pages/RedEstrategica.tsx`)

```text
┌────────────────────────────────────────────────────────────────────┐
│ [🔍 Buscar contacto..............]  [⊞|≡]   [+ Añadir contacto]    │  ← Línea 1
├────────────────────────────────────────────────────────────────────┤
│ [↻ Actualizar novedades]  [🧠 Regenerar perfiles]  [🎙 Re-import]   │  ← Línea 2 (full width, grid de 3)
├────────────────────────────────────────────────────────────────────┤
│ [Relación: Todas ▾]  [Salud: Toda ▾]  [Actividad: Toda ▾]   3/19   │  ← Línea 3 (dropdowns)
└────────────────────────────────────────────────────────────────────┘
```

- **Línea 1**: `flex` con search ocupando todo el espacio (`flex-1`), toggle de vista compacto, botón añadir contacto. Mismo estilo redondeado actual.
- **Línea 2**: `grid grid-cols-1 sm:grid-cols-3 gap-3`. Los 3 botones ahora son del mismo ancho, igual de prominentes, con icono + label completo siempre visible (no solo en `sm:`). En móvil se apilan verticales.
- **Línea 3**: 3 dropdowns shadcn (`DropdownMenu` con `DropdownMenuRadioGroup`). Cada uno muestra el filtro activo en el trigger ("Relación: Profesional") con un check ✓ junto a la opción seleccionada. A la derecha, el contador `X de Y` y `Limpiar filtros` cuando hay alguno activo. Mucho más compacto: pasamos de ocupar ~140px verticales a ~50px.

### Rediseño de la `ContactCard` — estilo "KPI de persona"

Actualmente la ficha tiene avatar + nombre + 2 chips minúsculos + anillo SVG raquítico con un "8" diminuto. La voy a rehacer para que se sienta de la misma familia visual que los Kpi de arriba (mismo `GlassCard` con borde tonal según salud, número grande tipográfico, padding generoso):

```text
┌─────────────────────────────────────┐
│ AB  Adolfo Belloso          ┌───┐   │
│     [💼 Profesional]        │ 8 │   │  ← número grande, tipo Kpi
│                             └───┘   │
│ ─────────────────────────────────── │
│ ✓ 24d sin contacto · 🎧 podcast     │  ← meta-fila compacta
│                                     │
│ "Importado desde grupo WhatsApp:    │  ← contexto / último tema
│  2024 Las Vegas Team"               │
│                                     │
│ [⚡ Seguimiento]      [+ Redactar]   │  ← acciones (si aplica)
└─────────────────────────────────────┘
```

Cambios concretos:

- **Score como número grande (no anillo)**: caja redondeada arriba a la derecha de 56×56px con el número en `font-display text-3xl font-semibold`, fondo y borde tonal según rango (`bg-success/15 border-success/40` si ≥7, `warning` 4-6, `destructive` <4) → mismo lenguaje visual que los KPIs `19`, `12`, `0`, `2` de arriba. Tooltip al hover explica el cálculo (lo que ya tiene).
- **Avatar más grande** (56×56) alineado con el score → composición equilibrada izq/der.
- **Chip de categoría** en su línea propia debajo del nombre, no apretado al lado del recency.
- **Meta-fila** con separador `border-t`: recency + podcast + nº mensajes WhatsApp si los hay (`r.wa_message_count`) → más información útil.
- **Contexto** (`last_topic`) como cita en cursiva con `line-clamp-2`, más respirado.
- **Acciones inferiores** sólo cuando `needsFollowUp`, con el mismo botón "Redactar".
- **Hover**: borde se ilumina hacia primary, ligero glow (igual que los KPIs).
- **Eliminar (X)** sigue arriba a la derecha, ahora no compite con el anillo (que ya no está ahí).

### Lo que NO toco

- La lógica de filtrado (`filtered`, `computeScore`, KPIs, carga, acciones) — solo cambia la presentación.
- El comportamiento de las 3 acciones pesadas — solo se reubican.
- La vista lista (`view === "list"`) — sigue igual, ya es compacta.
- `HealthMeter` — se queda para la ficha de detalle del contacto, donde sí tiene sentido el anillo grande.
- `KpiCard` superior — está bien, es la referencia estética.

### Ficheros que tocaré

1. **`src/pages/RedEstrategica.tsx`** — reorganizar las 3 líneas del toolbar y reemplazar el bloque de píldoras por dropdowns.
2. **`src/components/contact/ContactCard.tsx`** — rediseño completo de la card con score grande tipo KPI y mejor jerarquía.

## Resultado esperado

- Toolbar superior limpio y predecible: una línea para buscar/añadir, otra para acciones pesadas, otra para filtros desplegables. Pasamos de ~7 filas verticales a 3.
- Las cards se sienten de la misma familia que los KPIs de arriba: el `8`, `9`, `7` se lee de un vistazo a 3 metros, no hay que entrecerrar los ojos.
- Cada ficha aporta más información útil (mensajes, contexto, recency) sin sentirse cargada.

