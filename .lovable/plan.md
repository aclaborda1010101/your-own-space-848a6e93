
# Plan: Correccion visual global - Layout, emojis y datos

## Problemas detectados

### 1. Sidebar/TopBar duplicada en 18 paginas
Todas las paginas se renderizan dentro de `ProtectedPage` -> `AppLayout` (que ya incluye `SidebarNew` + `TopBar`). Sin embargo, **18 paginas** ademas renderizan su propio `SidebarNew` y `TopBar` internamente, causando **doble barra lateral y doble barra superior**.

Paginas afectadas:
- `StrategicNetwork.tsx`
- `Communications.tsx`
- `BrainsDashboard.tsx`
- `Sports.tsx`
- `Calendar.tsx`
- `Tasks.tsx`
- `Finances.tsx`
- `Coach.tsx`
- `Content.tsx`
- `AgustinState.tsx`
- `AINews.tsx`
- `Nutrition.tsx`
- `Bosco.tsx`
- `BoscoAnalysis.tsx`
- `StartDay.tsx`
- `AICourse.tsx`
- `English.tsx`
- `Challenges.tsx`

### 2. Emojis en 22 archivos (345 coincidencias)
Se encontraron emojis en componentes y paginas. Todos deben ser reemplazados por iconos de Lucide React.

Archivos principales:
- `StrategicNetwork.tsx`: emojis de mic, chat, user, star, trophy
- `Logs.tsx`: trophy, heart, refresh, check, lightning, smiley
- `BrainsDashboard.tsx`: TV, mic, calendar
- `Communications.tsx`: emojis varios en badges
- `Dashboard.tsx`: posibles emojis en cards
- `GoogleCalendarSettingsCard.tsx`: warning emoji
- Otros componentes con emojis dispersos

### 3. Contactos "favoritos" que no son del usuario
La consulta a la base de datos muestra que **0 contactos estan marcados como favoritos** (`is_favorite = false` en todos). El filtro "Activos" (vista por defecto) muestra los 349 contactos porque todos tienen `interaction_count > 0`. No hay datos demo; son contactos reales. El problema visual es que la vista "Activos" muestra demasiados contactos sin priorizar.

## Solucion

### Paso 1: Limpiar las 18 paginas con sidebar/topbar duplicada

Para cada pagina afectada:
1. Eliminar imports de `SidebarNew`, `TopBar`, `useSidebarState`
2. Eliminar el wrapper `<div className="min-h-screen bg-background">` con `<SidebarNew>` y `<TopBar>`
3. Eliminar el `<div>` con padding lateral (`lg:pl-20` / `lg:pl-72`)
4. Dejar solo el contenido `<main>` con clases estandar `p-4 lg:p-6 space-y-6`

Estructura objetivo para cada pagina:
```text
return (
  <main className="p-4 lg:p-6 space-y-6">
    <Breadcrumbs ... />
    {/* contenido de la pagina */}
  </main>
);
```

### Paso 2: Eliminar todos los emojis

Reemplazar emojis por iconos Lucide en los 22 archivos afectados. Ejemplos:

| Emoji | Reemplazo Lucide |
|-------|-----------------|
| mic | `<Mic className="w-3 h-3" />` |
| chat | `<MessageCircle className="w-3 h-3" />` |
| star | `<Star className="w-3 h-3" />` |
| trophy | `<Trophy className="w-3 h-3" />` |
| heart | `<Heart className="w-3 h-3" />` |
| refresh | `<RotateCcw className="w-3 h-3" />` |
| user | `<User className="w-3 h-3" />` |
| check | `<Check className="w-3 h-3" />` |
| lightning | `<Zap className="w-3 h-3" />` |
| warning | `<AlertTriangle className="w-3 h-3" />` |
| calendar | `<Calendar className="w-3 h-3" />` |
| TV | `<Monitor className="w-3 h-3" />` |

### Paso 3: Mejorar filtro de contactos activos

Cambiar la vista "Activos" en `StrategicNetwork.tsx` para que sea mas selectiva:
- Subir el umbral: mostrar solo contactos con `interaction_count >= 3` (en vez de > 0)
- O usar el filtro "Top 100" como vista por defecto en lugar de "Activos"
- Asi se evita que aparezcan los 349 contactos por defecto y se ven solo los mas relevantes

## Orden de implementacion

1. Limpiar las 18 paginas (eliminar sidebar/topbar duplicadas)
2. Eliminar emojis en todos los archivos
3. Ajustar filtro de contactos activos

## Archivos a modificar

18 paginas para limpieza de layout + 22 archivos para emojis = ~30 archivos unicos a editar.
