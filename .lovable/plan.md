
# Fix: Eliminar Sidebar/TopBar duplicados de todas las paginas

## Problema

`AppLayout` (usado en `ProtectedPage` en `App.tsx`) ya renderiza `SidebarNew`, `TopBar`, y `BottomNavBar` globalmente. Pero cada pagina individual TAMBIEN renderiza su propia copia de estos componentes, causando:
- Doble sidebar
- Doble TopBar
- Layout roto con margenes duplicados

## Solucion

Limpiar **20 paginas** eliminando de cada una:
1. El import y uso de `SidebarNew`
2. El import y uso de `TopBar`
3. El import y uso de `BottomNavBar` (donde aplique)
4. El import y uso de `useSidebarState`
5. El wrapper `<div className="min-h-screen bg-background">` + `<div className={cn("transition-all", ...)}>` que simula el layout
6. Dejar solo el contenido interno (`<main>` o equivalente) sin wrappers de layout

## Paginas afectadas (20 ficheros)

| Pagina | Tiene SidebarNew | Tiene TopBar | Tiene useSidebarState |
|--------|:-:|:-:|:-:|
| Dashboard.tsx | Si | Si | Si |
| Chat.tsx | Si | Si | Si |
| Tasks.tsx | Si | Si | Si |
| Settings.tsx | Si | Si | Si |
| Calendar.tsx | Si | Si | Si |
| Communications.tsx | Si | Si | Si |
| Health.tsx | Si | Si | Si |
| Sports.tsx | Si | Si | Si |
| Finances.tsx | Si | Si | Si |
| Nutrition.tsx | Si | Si | Si |
| AINews.tsx | Si | Si | Si |
| Bosco.tsx | Si | Si | Si |
| English.tsx | Si | Si | Si |
| AICourse.tsx | Si | Si | Si |
| Coach.tsx | Si | Si | Si |
| Challenges.tsx | Si | Si | Si |
| StartDay.tsx | Si | Si | Si |
| Content.tsx | Si | Si | Si |
| Logs.tsx | Si | Si | Si |
| Analytics.tsx | Si | Si | Si |

## Patron de cambio (igual en todas las paginas)

Antes:
```text
return (
  <div className="min-h-screen bg-background">
    <SidebarNew isOpen={...} onClose={...} isCollapsed={...} onToggleCollapse={...} />
    <div className={cn("transition-all", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
      <TopBar onMenuClick={openSidebar} />
      <main className="p-4 lg:p-6 space-y-6">
        {/* contenido real */}
      </main>
    </div>
  </div>
);
```

Despues:
```text
return (
  <main className="p-4 lg:p-6 space-y-6">
    {/* contenido real -- sin cambios */}
  </main>
);
```

## Modificaciones en AppLayout

Verificar que `AppLayout` incluye `TopBar` dentro del area de contenido. Actualmente solo tiene SidebarNew y BottomNavBar. Hay que anadir `TopBar` al AppLayout para que se muestre globalmente.

## Detalles tecnicos

- Se eliminan ~3-5 imports por fichero (SidebarNew, TopBar, useSidebarState, cn, BottomNavBar)
- Se elimina la linea de destructuring de `useSidebarState()`
- Se eliminan los wrappers `div.min-h-screen > SidebarNew + div.transition-all > TopBar + main`
- Se conserva intacto todo el contenido funcional de cada pagina
- `AppLayout` se actualiza para incluir `<TopBar>` antes del `{children}`
- Las paginas que usan `Breadcrumbs` lo mantienen dentro de su `<main>`
