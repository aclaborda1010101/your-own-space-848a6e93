
Objetivo: dejar la visibilidad de **RAG Architect** blindada para que no vuelva a “desaparecer” del menú, incluso con estados previos en `localStorage` o configuraciones antiguas de usuario.

## 1) Diagnóstico técnico (lo que está pasando)

He revisado la implementación actual y hay un patrón que explica por qué “a veces aparece y a veces no”:

1. `RAG Architect` está dentro de una sección colapsable (**Proyectos**) en `SidebarNew`.
2. El estado de esa sección (`sidebar-section-projects`) se persiste en `localStorage`.
3. Si esa sección quedó guardada en `false` (cerrada), el enlace de `RAG Architect` no se renderiza visualmente en modo expandido (solo se ve el header “Proyectos”).
4. Aunque ya se forzó que no pueda ocultarse por `hidden_menu_items`, sigue pudiendo “desaparecer” de la vista por el colapsado persistido.
5. Los errores de WebSocket (`ws://` en página HTTPS) que aparecen en consola son reales, pero **no son la causa directa** de esta desaparición del item de navegación.

## 2) Solución definitiva (en capas, para que no vuelva a romperse)

Voy a aplicar una solución de 4 capas, no solo un parche puntual:

### Capa A — Enlace fijo fuera del colapsable
En `SidebarNew`, añadir **RAG Architect como acceso fijo independiente** (top-level), no dependiente de que “Proyectos” esté abierto/cerrado.

- Mantener también la entrada en Proyectos si quieres organización, pero con un acceso fijo arriba para no perder descubribilidad.
- El acceso fijo no depende de `hidden_menu_items`.

Resultado: aunque “Proyectos” esté cerrado, el enlace sigue visible.

### Capa B — Autoapertura por ruta activa
En `SidebarNew`, sincronizar estado de sección con la ruta actual:

- Si `location.pathname === "/rag-architect"` o empieza por `/projects`, forzar `isProjectsOpen = true`.
- Así, al navegar a RAG Architect, la sección no puede quedarse cerrada por un valor viejo de `localStorage`.

Resultado: navegación consistente; no queda “oculto por colapsado”.

### Capa C — Saneado defensivo de preferencias antiguas
En `useUserSettings`:

- Normalizar `hidden_menu_items` para asegurar que siempre es array válido.
- Eliminar `/rag-architect` si apareciera heredado de estados antiguos.
- Aplicar la misma limpieza en `updateSettings` antes de persistir.

Resultado: aunque haya datos legacy o inconsistentes, RAG Architect no puede volver a quedar ocultable por datos.

### Capa D — Ajustes UI reforzados
En `MenuVisibilityCard`:

- Mantener `RAG Architect` como `permanent: true`.
- Mostrarlo bloqueado visualmente (sin toggling real) y con etiqueta tipo “Siempre visible”.

Resultado: evita confusión de usuario (“parece que se puede tocar pero no hace nada”).

## 3) Validación end-to-end (obligatoria)

Probaré estos escenarios para cerrarlo de forma definitiva:

1. Con `localStorage.sidebar-section-projects = false`, recargar y comprobar que RAG Architect sigue visible.
2. Entrar en `/rag-architect` directamente por URL y verificar que:
   - la página carga,
   - el link existe y/o la sección se autoabre.
3. Cambiar visibilidad de otros menús desde Ajustes y confirmar que RAG Architect nunca desaparece.
4. Probar en desktop y móvil (sidebar abierta/cerrada, colapsada/no colapsada).
5. Verificar que no hay regresión en rutas `/projects` y `/projects/detector`.

## 4) Archivos a tocar

- `src/components/layout/SidebarNew.tsx`
  - acceso fijo + autoopen por ruta activa
- `src/hooks/useUserSettings.tsx`
  - normalización/saneado defensivo de `hidden_menu_items`
- `src/components/settings/MenuVisibilityCard.tsx`
  - UI bloqueada explícita para item permanente

## 5) Riesgo y mitigación

Riesgo: duplicar visualmente “RAG Architect” (si queda en acceso fijo y dentro de Proyectos).  
Mitigación: dejar una sola fuente de verdad visual (recomendado: acceso fijo único) o mantener ambos temporalmente con etiqueta clara y luego consolidar.

## 6) Criterio de “arreglo definitivo”

Se considera resuelto solo si:
- RAG Architect no desaparece tras recargas,
- no depende de estados colapsados previos,
- no depende de `hidden_menu_items`,
- y pasa pruebas desktop/mobile con persistencia activa.
