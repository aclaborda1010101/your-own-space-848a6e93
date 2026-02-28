

## Plan: Fix definitivo de navegación stale + menú incompleto

### Problema
Al iniciar sesión o recargar, el bundle PWA cacheado sirve versiones viejas. Además, `hidden_menu_items` puede contener rutas protegidas como `/rag-architect` o `/projects/detector`, ocultándolas del sidebar.

### Cambios (5 archivos)

---

**1. Crear `src/lib/runtimeFreshness.ts`** (nuevo)
- Guard que detecta entorno preview (`lovableproject.com`, `lovable.app`, `localhost`)
- Desregistra service workers y limpia `CacheStorage`
- Si limpió algo, hace UN reload controlado (con flag `sessionStorage` anti-loop)

**2. Modificar `src/main.tsx`**
- Antes de `loadApp()`, llamar `await ensureRuntimeFreshness()` importada del nuevo archivo
- Esto garantiza que siempre arranca con el bundle fresco

**3. Modificar `vite.config.ts`**
- En el bloque `workbox` de VitePWA añadir:
  - `skipWaiting: true`
  - `clientsClaim: true`  
  - `cleanupOutdatedCaches: true`

**4. Modificar `src/hooks/useUserSettings.tsx`**
- Definir constante: `const ALWAYS_VISIBLE = ['/projects', '/rag-architect', '/projects/detector']`
- Añadir `useEffect` que observe `settings.hidden_menu_items`:
  - Filtra items que estén en `ALWAYS_VISIBLE`
  - Si encontró alguno, llama `updateSettings({ hidden_menu_items: cleaned })` para corregir y persistir
- Usar un `useRef` flag para evitar loops infinitos (el `updateSettings` cambia `settings` que re-dispararía el effect)
- En `fetchSettings`: cambiar el sanitize de solo `/rag-architect` a usar `ALWAYS_VISIBLE` completo
- En `updateSettings`: cambiar el filtro de solo `/rag-architect` a filtrar todos los `ALWAYS_VISIBLE`

**5. Modificar `src/components/settings/MenuVisibilityCard.tsx`**
- En el grupo "Proyectos", añadir:
  - `{ icon: Database, label: "RAG Architect", path: "/rag-architect", permanent: true }`
  - `{ icon: Radar, label: "Detector Patrones", path: "/projects/detector", permanent: true }`
- Importar `Database` y `Radar` de lucide-react
- Eliminar el check especial `if (path === "/rag-architect") return` en `toggleItem` — el `permanent` + `disabled` del Switch ya lo cubre
- Eliminar la condición especial `item.path === "/rag-architect" ? true :` en `isVisible` — el `ALWAYS_VISIBLE` en useUserSettings ya lo garantiza

