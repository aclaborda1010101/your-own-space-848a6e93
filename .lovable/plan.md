# Plan: Iniciar día — barra móvil + Check-in con WHOOP

Dos problemas a resolver en `/start-day`:

## 1. Barra superior de 8 pasos se sale en móvil (390px)

**Estado actual** (`src/pages/StartDay.tsx`, líneas 515-548):
- 8 botones circulares de 40×40px (`w-10 h-10`) + 7 conectores `flex-1` con `mx-2` (16px de margen) + `gap-2` entre items.
- Mínimo necesario: 8·40 + 7·(8+16) ≈ 488px → desborda en móvil de 390px.

**Solución**: hacer la barra responsive sin tocar lógica.
- En móvil (`<sm`): botones `w-7 h-7` (28px), conectores con `mx-0.5`, `gap-0.5`, iconos `w-3.5 h-3.5`.
- En `sm+`: mantener tamaños actuales (`w-10 h-10`, `gap-2`, `mx-2`, iconos `w-5 h-5`).
- Total móvil: 8·28 + 7·(2+4) ≈ 266px → cabe holgado.

## 2. Check-in (paso 3) no se pre-rellena con WHOOP

**Diagnóstico**:
- BD confirma que existe `whoop_data` reciente para el usuario (recovery=63, hrv=35, sleep=4.3h del 2026-05-05).
- `useJarvisWhoopData` lee correctamente.
- El effect de pre-rellenado en `useCheckIn` (líneas 41-56) tiene una condición frágil:
  ```
  if (!isRegistered && !loading && hasWhoopData && whoopData) { ... }
  ```
  Falla si:
  - `whoopData` aún está cargando cuando `loading` (del check-in) pasa a false → effect corre con `hasWhoopData=false`.
  - El estado interno de `useJarvisWhoopData` (`isLoading`) no se expone aquí, así que no esperamos a que termine.
- El `setDraftCheckIn` solo dispara una vez. Si después el usuario no toca nada pero los valores ya se quedaron en `defaultCheckIn` (3/3/3), no hay nada que vuelva a recalcular.

**Solución** en `src/hooks/useCheckIn.tsx`:
1. Importar y exponer también `isLoading` de `useJarvisWhoopData` y esperar a `!whoopLoading` antes de decidir.
2. Reescribir el effect para que: cuando termine la carga del check-in y de WHOOP, si NO hay check-in registrado y SÍ hay datos WHOOP → aplica el mapeo y marca `prefilledFromWhoop=true`. Si no hay datos WHOOP, no toca nada (deja `defaultCheckIn`).
3. Asegurar que `prefilledFromWhoop` no se resetee por re-renders intermedios. Usar un `useRef` (`appliedRef`) que marque "ya pre-rellené hoy" para no sobrescribir cambios manuales del usuario.
4. Si el usuario interactúa con un slider (`updateDraft`), `appliedRef.current = true` y `prefilledFromWhoop=false` (igual que ya hace).

## Archivos a tocar

- `src/pages/StartDay.tsx` — solo clases Tailwind responsive en el bloque de step indicators.
- `src/hooks/useCheckIn.tsx` — exponer `whoopLoading`, reescribir effect con `useRef` guard.

No se toca lógica de negocio, mapeo WHOOP→check-in (`src/lib/whoopToCheckIn.ts`), ni el guardado.

## Verificación

- Abrir `/start-day` en móvil 390px → la barra de 8 pasos cabe sin scroll horizontal.
- Ir al paso 3 sin haber registrado check-in del día → los sliders muestran valores derivados de WHOOP (energía≈4 con recovery=63, ánimo según sleep performance, focus≈3 con HRV=35) y aparece el badge "Pre-rellenado desde WHOOP".
- Mover un slider → el badge desaparece y el valor manual se respeta.
