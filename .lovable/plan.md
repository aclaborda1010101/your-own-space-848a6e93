

## Diagnóstico: Página blanca sin errores

**Causa**: El `try/catch` en `main.tsx` re-lanza cualquier excepción con `throw new Error(...)`, lo que mata la app silenciosamente. Si `ensureRuntimeFreshness()` falla por cualquier motivo inesperado (storage bloqueado, race condition), el `throw` impide que `createRoot` se ejecute y la página queda en blanco sin error visible.

**Fix** (1 archivo):

**`src/main.tsx`** — Eliminar el `try/catch` con re-throw. `ensureRuntimeFreshness()` ya maneja errores internamente y nunca lanza intencionalmente. Simplificar a llamada directa:

```typescript
import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";
import { ensureRuntimeFreshness } from "./lib/runtimeFreshness";
import { createRoot } from "react-dom/client";
import App from "./App";

initSafeStorage();
ensureRuntimeFreshness();
createRoot(document.getElementById("root")!).render(<App />);
```

Esto garantiza que la app siempre arranca, incluso si el guard de frescura falla.

