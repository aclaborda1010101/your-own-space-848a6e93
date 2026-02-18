

## Configuracion de visibilidad del menu lateral en Ajustes

### Objetivo
Agregar una tarjeta en la pagina de Ajustes que permita habilitar/deshabilitar cada elemento del menu lateral (sidebar). Los elementos desactivados desapareceran del menu.

### Estado actual
- La base de datos ya tiene una columna `hidden_menu_items` (JSONB, default `[]`) en `user_settings`
- El sidebar (`SidebarNew.tsx`) tiene 4 grupos de items: principales (7), modulos (5), Bosco (2), y Formacion (3) = 17 items totales
- Dashboard y Ajustes seran permanentes (no se pueden ocultar)

### Cambios necesarios

**1. Ampliar `useUserSettings.tsx`**
- Anadir `hidden_menu_items: string[]` al tipo `UserSettings`
- Leerlo y escribirlo desde/a Supabase junto con el resto de settings
- Default: array vacio (todos visibles)

**2. Crear componente `MenuVisibilityCard.tsx`**
- Nueva tarjeta en `src/components/settings/MenuVisibilityCard.tsx`
- Muestra todos los items del sidebar agrupados (Principal, Modulos, Bosco, Formacion)
- Cada item tiene un Switch para habilitar/deshabilitar
- Dashboard y Ajustes aparecen siempre activos y deshabilitados (no se pueden ocultar)
- Guardado automatico al cambiar cada toggle (sin boton de guardar)

**3. Filtrar items en `SidebarNew.tsx`**
- Importar `useUserSettings` para acceder a `hidden_menu_items`
- Filtrar `navItems`, `moduleItems`, `boscoItems` y `academyItems` antes de renderizar
- Ocultar secciones completas (Bosco, Formacion) si todos sus items estan ocultos

**4. Integrar en `Settings.tsx`**
- Importar y anadir `MenuVisibilityCard` en la pagina de ajustes

### Detalles tecnicos

- Se almacenara un array de paths (ej: `["/ai-news", "/finances"]`) en `hidden_menu_items`
- El filtrado sera: `items.filter(item => !hiddenItems.includes(item.path))`
- Los items permanentes (Dashboard `/dashboard`, Ajustes `/settings`) no se podran ocultar
- Tambien se corregiran los errores de build existentes en `Chat.tsx`, `ChatSimple.tsx` y `AppLayout.tsx` que usan propiedades incorrectas de `useSidebarState`

