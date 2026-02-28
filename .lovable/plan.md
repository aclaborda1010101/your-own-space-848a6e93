

## Fix: App no arranca — "Error loading app"

### Causa raíz
`ensureRuntimeFreshness()` hace `window.location.reload()` pero el código después (`loadApp()`) intenta ejecutarse antes del reload efectivo, causando un race condition. Además, el `reload()` invalida las caches y el Vite dev server necesita recompilar, pero `loadApp` con 3 retries de 1s no es suficiente si el SW cleanup + reload se ejecutó.

El import dinámico de `bootstrap.tsx` falla con "Failed to fetch dynamically imported module" porque el reload + cache purge deja al navegador en un estado transitorio.

### Solución

**1. Simplificar `src/main.tsx` a bootstrap estático**
- Eliminar el import dinámico de `./bootstrap`
- Importar `App` y `createRoot` directamente en `main.tsx`
- Eliminar la función `loadApp` con retries
- Mantener `initSafeStorage()` y `ensureRuntimeFreshness()` pero con `return` inmediato si va a hacer reload (no ejecutar nada más)

```typescript
import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

initSafeStorage();
ensureRuntimeFreshness(); // sync check, reload if needed (stops execution)
createRoot(document.getElementById("root")!).render(<App />);
```

**2. Modificar `src/lib/runtimeFreshness.ts`**
- Cambiar de `async` a función síncrona que programa la limpieza pero no bloquea el render
- Si detecta que hay SW registrados o caches, programar limpieza async y reload, pero NO bloquear el hilo principal
- Si el flag de reload ya existe (ya se limpió), simplemente retornar
- Restringir `PREVIEW_PATTERNS` para NO incluir `lovable.app` (que es el dominio publicado) — solo `lovableproject.com` y `localhost`

**3. Eliminar `src/bootstrap.tsx`**
- Ya no necesario porque el render se hace directamente en `main.tsx`

### Archivos

| Archivo | Acción |
|---------|--------|
| `src/main.tsx` | Reescribir: import estático, sin retries |
| `src/lib/runtimeFreshness.ts` | Simplificar: no-async, restringir patterns |
| `src/bootstrap.tsx` | Eliminar |

