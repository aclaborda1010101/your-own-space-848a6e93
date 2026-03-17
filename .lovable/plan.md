

## Plan: Auto-recuperación tras suspensión del portátil

### Problema

Cuando el portátil se suspende, el sandbox de preview de Lovable se congela. Al despertar, la página muestra contenido obsoleto (404, caché vieja) porque el JS ya montado no se re-ejecuta. Solo se refresca cuando escribes un mensaje porque eso reinicia el sandbox desde Lovable.

### Solución

Añadir un listener de `visibilitychange` + detección de "salto temporal" en `runtimeFreshness.ts`. Cuando la pestaña vuelve a ser visible tras >30s oculta (indicativo de suspensión), forzar un hard reload con cache-buster. Esto cubre tanto preview como producción.

### Cambios

**`src/lib/runtimeFreshness.ts`** -- añadir al final de `ensureRuntimeFreshness()` (antes del return final):

```ts
// Resume-from-sleep detector
let lastTick = Date.now();
const SLEEP_THRESHOLD_MS = 30_000; // 30s gap = likely suspend

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const gap = Date.now() - lastTick;
    if (gap > SLEEP_THRESHOLD_MS) {
      // Laptop was suspended — force fresh reload
      nukeSwAndCaches();
      const nextUrl = appendOrReplaceQueryParam(
        window.location.href,
        "_cb",
        Date.now().toString(),
      );
      window.location.replace(nextUrl);
    }
  }
});

// Heartbeat: update lastTick every 10s so we can detect gaps
setInterval(() => { lastTick = Date.now(); }, 10_000);
```

Esto hace que al abrir el portátil, la app detecte que pasaron >30s sin heartbeat y se auto-recargue con cache-buster. Sin intervención manual, sin botón.

### Anti-loop

La protección anti-loop ya existente (`RELOAD_DONE` en sessionStorage) evita bucles infinitos. Además, tras el reload el `lastTick` se reinicia a `Date.now()` por lo que no vuelve a disparar.

