

# Plan: Mejorar descripciones de modelos de monetización

Hacer las descripciones más claras para un cliente no técnico, reflejando lo que realmente implica cada modelo.

## Cambios

### `src/components/projects/wizard/ProjectBudgetPanel.tsx` (líneas 12-17)

Actualizar labels y descriptions de `MONETIZATION_OPTIONS`:

| Modelo | Label actual | Label nuevo | Descripción nueva |
|---|---|---|---|
| `license_fee` | "Licencia de software" | "Licencia por unidad" | "Coste de implementación inicial reducido + cuota mensual por cada licencia activa (ej: por camión, por sede, por equipo)." |
| `fixed_price_maintenance` | "Precio fijo + Mantenimiento" | "Desarrollo a medida + Mantenimiento" | "El cliente paga el desarrollo completo y es propietario del sistema. Solo paga una cuota mensual por infraestructura y mantenimiento." |

Los demás modelos (`saas_subscription`, `revenue_share`, `per_user_seat`) se mantienen sin cambios.

### `supabase/functions/project-wizard-step/index.ts` (línea 2265)

Sincronizar el label del backend:
- `license_fee`: "Licencia por unidad (coste por licencia mensual)"
- `fixed_price_maintenance`: "Desarrollo a medida + Mantenimiento mensual"

Esto asegura que el prompt de IA y la UI usen la misma terminología.

