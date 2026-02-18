

# Fix: Eliminar sidebar/topbar duplicada en StrategicNetwork

## Problema

La pagina `/strategic-network` sigue renderizando su propio `SidebarNew` y `TopBar` (lineas 469-478), cuando `AppLayout` ya los proporciona. Esto causa:

- Doble barra superior ("Buenas tardes" aparece 2 veces)
- Doble sidebar
- Padding/offset incorrecto

## Solucion

Modificar `src/pages/StrategicNetwork.tsx`:

1. **Eliminar imports** de `SidebarNew`, `TopBar`, `useSidebarState`, `cn` (lineas 7-10)
2. **Eliminar** `useSidebarState()` del componente (linea 379)
3. **Eliminar** el wrapper `<div className="min-h-screen">` con `<SidebarNew>`, el `<div>` con padding lateral, y `<TopBar>` (lineas 468-480)
4. **Eliminar** los cierres `</div></div>` correspondientes (lineas 600-601)
5. El return quedara simplemente:

```text
return (
  <main className="p-4 lg:p-6 space-y-4">
    {/* Header */}
    ...contenido existente sin cambios...
  </main>
);
```

## Archivo a modificar

- `src/pages/StrategicNetwork.tsx` (unico archivo)

