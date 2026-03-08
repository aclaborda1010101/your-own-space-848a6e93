

## Plan: Sincronizar menús (Sidebar, MenuVisibilityCard, BottomNavBar)

### Discrepancias detectadas

1. **`/contacts` es un redirect** → App.tsx redirige `/contacts` a `/strategic-network`, pero el sidebar y MenuVisibilityCard apuntan a `/contacts`. Debería apuntar directamente a `/strategic-network` con label "Red Estratégica".

2. **Rutas existentes sin presencia en menús**:
   - `/strategic-network` (Red Estratégica) — no aparece en sidebar ni en MenuVisibilityCard
   - `/brains-dashboard` (Brains) — no aparece en ningún menú
   - `/calibracion-scoring` (Calibración) — no aparece en ningún menú

3. **Import no usado**: `Mail` se importa en SidebarNew pero no se usa.

### Cambios propuestos

**`src/components/layout/SidebarNew.tsx`**:
- Reemplazar `ContactRound / Contactos / /contacts` por `ContactRound / Red Estratégica / /strategic-network` en `dataItems`.
- Eliminar import `Mail` (no usado).

**`src/components/settings/MenuVisibilityCard.tsx`**:
- En grupo "Datos", reemplazar `Contactos / /contacts` por `Red Estratégica / /strategic-network`.

**Sin cambios** en BottomNavBar (ya está bien con Dashboard/Tareas/JARVIS/Chat/Ajustes) ni en App.tsx (el redirect `/contacts` se mantiene por retrocompatibilidad).

