# Plan: Forzar recarga del Check-in con WHOOP

## Diagnóstico

- BD confirma: NO hay check-in para hoy (último: 2026-05-01) y SÍ hay WHOOP reciente (recovery 63, hrv 35).
- El código actual de `useCheckIn.tsx` ya tiene el fix con `whoopLoading` + `useRef` y debería pre-rellenar.
- En el preview interno se ve el badge "Pre-rellenado desde WHOOP" con valores 4/4/3 (correctos).
- En tu pantalla NO sale: la PWA está sirviendo el bundle anterior desde el service worker (`public/sw.js`). Por eso el cambio "no aparece" para ti aunque ya está aplicado.

## Solución

1. **Cache-bust de Lovable preview**: actualizar el marcador `// cache-bust:` en `src/main.tsx` con timestamp nuevo para forzar rebuild y romper el cache del service worker.
2. **Endurecer el effect de pre-rellenado** para que sobreviva mejor a re-renders y no dependa del orden de carga:
   - Si `whoopData` cambia (nueva sincronización mientras estás en la página), volver a aplicar siempre que el usuario no haya tocado los sliders y no haya check-in registrado. Cambiar `appliedRef` para que solo bloquee si el usuario interactuó manualmente.
   - Añadir un `console.log` informativo (`[CheckIn] WHOOP prefill applied`) para que en próximas dudas se pueda diagnosticar desde la consola.
3. **Refetch defensivo**: cuando se monta la página `/start-day`, llamar a `refetch()` del hook WHOOP por si el dato llegó después del primer render (no-op si ya hay).

## Archivos a tocar

- `src/main.tsx` — actualizar comentario `// cache-bust:` con timestamp.
- `src/hooks/useCheckIn.tsx` — relajar `appliedRef` (solo bloquea con `userTouchedRef`), añadir log de diagnóstico.

No se toca lógica de mapeo ni de guardado.

## Verificación

- Tras el rebuild, recargar `/start-day` (o cerrar y reabrir la PWA si es la app instalada).
- En consola debe aparecer `[CheckIn] WHOOP prefill applied` con los valores derivados.
- En el paso 3 deben verse Energía 4/5, Ánimo 4/5, Foco 3/5 y badge "Pre-rellenado desde WHOOP".

## Nota importante para ti

Si estás usando la app instalada como PWA en el móvil, puede que necesites:
- Cerrarla por completo y reabrirla, o
- En el navegador: pull-to-refresh + esperar 5s + recargar otra vez.

Esto es porque el service worker mantiene la versión antigua hasta el siguiente "ciclo".
