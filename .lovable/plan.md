
Objetivo: dejar el bloque de **Proyectos** estable y siempre visible en cada login, eliminando la causa raíz de “desaparición” de Pipeline/Detector/RAG.

1) Diagnóstico confirmado (causa real)
- `SidebarNew` vive dentro de `AppLayout` y no se desmonta entre rutas.
- El estado de apertura de Proyectos se persiste en `localStorage` (`sidebar-section-projects`).
- Si quedó guardado en `false`, al volver a entrar (normalmente en `/dashboard`) Proyectos arranca cerrado.
- El `useEffect` actual solo autoabre cuando la ruta activa es `/projects*` o `/rag-architect`; en `/dashboard` no autoabre.
- No hay conflicto por sidebars duplicadas (arquitectura global ya centralizada).
- En DB, `hidden_menu_items` no está ocultando `/projects` ni `/projects/detector` en los datos actuales; el problema principal es colapsado persistido + comportamiento de arranque.

2) Solución definitiva (implementación)
- En `src/components/layout/SidebarNew.tsx`:
  - Quitar persistencia de apertura para **Proyectos** (dejar de leer/escribir `sidebar-section-projects`).
  - Renderizar **Proyectos** como sección siempre expandida (sin `Collapsible` para ese bloque).
  - Mantener `Pipeline`, `Detector Patrones` y `RAG Architect` dentro del mismo bloque visual de Proyectos (estructura fija, sin reordenamientos inesperados).
  - Añadir limpieza de migración al montar: `localStorage.removeItem("sidebar-section-projects")` (safe/best-effort).
- Mantener la lógica actual de visibilidad de menú (`hidden_menu_items`) sin cambios para el resto de secciones.

3) Archivos a tocar
- `src/components/layout/SidebarNew.tsx` (único archivo)

4) Detalles técnicos
- Reemplazar `renderProjectsSection()` colapsable por un bloque estático:
  - Header “Proyectos” + lista de enlaces hijos siempre visible.
- Eliminar:
  - `isProjectsOpen` state
  - `handleProjectsToggle`
  - `safeGet/safeSet` para key `sidebar-section-projects`
  - `useEffect` de autoapertura de Proyectos (ya no necesario si siempre está abierto)
- Conservar comportamiento colapsable en Bosco/Formación/Datos si se desea.

5) Validación end-to-end obligatoria
- Caso A: borrar storage, login en `/dashboard` ⇒ Proyectos visible con hijos.
- Caso B: cerrar sesión e iniciar 3 veces seguidas ⇒ misma estructura, sin desapariciones.
- Caso C: navegar `/dashboard` → `/chat` → `/projects` → `/dashboard` ⇒ Proyectos sigue visible.
- Caso D: cambiar visibilidad de otros menús en Ajustes ⇒ Proyectos no se desestructura.
- Caso E: probar desktop + móvil (sidebar abierta/cerrada).

6) Criterio de cierre
- Se considera resuelto solo si en cada nuevo login Proyectos aparece siempre con sus subitems visibles y no depende de estado previo de `localStorage`.
