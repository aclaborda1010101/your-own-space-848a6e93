
# Fix: Seccion Noticias IA - Header duplicado y filtro "Hoy" vacio

## Problemas detectados

1. **Header duplicado**: La pagina `AINews.tsx` renderiza su propia `SidebarNew` y `TopBar` (lineas 410-418), pero la ruta en `App.tsx` ya la envuelve en `ProtectedPage` > `AppLayout`, que tambien incluye sidebar y topbar. Esto causa el doble "Buenos dias, viernes 20 de febrero" que se ve en la captura.

2. **Pestana "Hoy" siempre vacia**: El filtro `todayNews` usa `isToday(parseISO(item.date))` que solo muestra noticias con fecha de hoy. Si no se han buscado noticias hoy, aparece "No hay noticias de hoy" aunque haya 143 noticias en la base de datos. Segun la logica de la app, deberia mostrar el ultimo lote disponible.

## Solucion

### Cambio 1: Eliminar sidebar y topbar duplicados
**Archivo:** `src/pages/AINews.tsx`

Eliminar las lineas 408-419 (el wrapper con `SidebarNew`, `TopBar` y el div con padding) y reemplazar por la estructura estandar de pagina:

```text
Antes:
<div className="min-h-screen bg-background">
  <SidebarNew ... />
  <div className={cn("transition-all...", ...)}>
    <TopBar onMenuClick={openSidebar} />
    <main className="p-4 lg:p-6 space-y-6">
      ...
    </main>
  </div>
</div>

Despues:
<main className="p-4 lg:p-6 space-y-6">
  ...
</main>
```

Tambien eliminar los imports de `SidebarNew`, `TopBar`, `useSidebarState` y `cn` (si no se usa en otro sitio).

### Cambio 2: Mostrar noticias recientes cuando no hay de hoy
**Archivo:** `src/pages/AINews.tsx`

En la pestana "Hoy" (linea 546), cambiar la logica para que si no hay noticias de hoy, muestre las mas recientes disponibles en lugar del mensaje vacio:

```text
Antes:
todayNews.length === 0 && todayVideos.length === 0 ? "No hay noticias de hoy"

Despues:
Si no hay de hoy, usar las noticias del ultimo dia disponible con un aviso tipo
"Ultimas noticias (ayer)" o "Ultimas noticias (fecha)"
```

Se creara un `useMemo` adicional `latestNews` que agrupe las noticias del dia mas reciente como fallback.

## Resultado esperado
- Un solo header/sidebar visible
- La pestana "Hoy" siempre muestra contenido: noticias de hoy si las hay, o las mas recientes con indicador de fecha
