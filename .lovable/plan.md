
## Problema a corregir

La app está entrando en un estado inaceptable de “medio logueado”:

- el layout protegido sigue visible
- el dashboard se queda cargando o vacío
- a veces acaba expulsando la sesión o forzando a refrescar/manual re-login

Leyendo el código actual, hay 4 causas probables y dos de ellas son claramente bugs:

1. `src/lib/runtimeFreshness.ts` fuerza recargas agresivas tras solo 30 segundos en background (`SLEEP_THRESHOLD_MS = 30_000`) y además limpia caches/SW.
2. `src/hooks/useAuth.tsx` hace `supabase.auth.signOut()` si `getSession()` falla una vez, lo cual destruye la sesión por un error transitorio.
3. El listener `onAuthStateChange` se registra después de `getSession()`, cuando Supabase recomienda montar primero la suscripción y luego hidratar.
4. Dentro de `onAuthStateChange` hay trabajo async extra (upsert a `user_integrations`) que no debería bloquear ni contaminar la reconciliación de auth.

## Qué voy a cambiar

### 1) Endurecer la capa de auth en `src/hooks/useAuth.tsx`
Objetivo: que un fallo temporal no borre la sesión ni deje la app en limbo.

Cambios:
- Registrar `supabase.auth.onAuthStateChange(...)` antes de la hidratación inicial.
- Reescribir `initAuth()` para:
  - intentar `getSession()` con 1 reintento corto
  - no llamar jamás a `signOut()` por error transitorio
  - separar claramente estos estados:
    - sesión válida
    - sin sesión real
    - error temporal de hidratación
- Añadir un estado derivado de “auth recuperándose” para evitar falsos redirects.
- Mover el `upsert` de `user_integrations` a una función best-effort no bloqueante, disparada aparte.
- Manejar explícitamente:
  - `INITIAL_SESSION`
  - `SIGNED_IN`
  - `TOKEN_REFRESHED`
  - `SIGNED_OUT`
  - `USER_UPDATED`
- Solo limpiar estado local y mandar a `/login` cuando Supabase confirme de verdad que no hay sesión, no cuando falle una llamada aislada.

### 2) Domesticar `runtimeFreshness` en `src/lib/runtimeFreshness.ts`
Objetivo: que volver del móvil bloqueado o pestaña dormida no rompa auth.

Cambios:
- Subir el umbral de sueño de 30 segundos a algo razonable para app real, por ejemplo 30 minutos.
- En el detector de sleep:
  - quitar `nukeSwAndCaches()` al volver de background
  - quitar el `replace()` con `_cb` para este caso
  - usar, como máximo, un `window.location.reload()` suave y solo tras sueño largo real
- Mantener la lógica de “build nuevo desplegado” separada, porque eso sí justifica refresh.
- Evitar instalar múltiples listeners/intervals si `ensureRuntimeFreshness()` se llama más de una vez.

### 3) Hacer la persistencia de Supabase más estable en `src/integrations/supabase/client.ts`
Objetivo: reducir conflictos de almacenamiento y mejorar recuperación de sesión.

Cambios:
- Añadir `storageKey` explícito para auth.
- Añadir `flowType: "pkce"`.
- Mantener `persistSession: true` y `autoRefreshToken: true`.
- Conservar el storage seguro actual, pero sin usar borrados globales alrededor del ciclo de auth.

### 4) Blindar la navegación protegida en `src/components/ProtectedRoute.tsx`
Objetivo: no redirigir al login mientras auth aún se está recuperando.

Cambios:
- Seguir mostrando loader mientras la hidratación no haya terminado de verdad.
- Solo hacer `<Navigate to="/login" replace />` cuando exista certeza de sesión nula estable.
- Evitar el caso “user null durante milisegundos” que dispara redirect innecesario.

### 5) Evitar pantallas vacías en los hooks que dependen del usuario
Objetivo: que al perder temporalmente `user/session`, el dashboard no quede colgado.

Ajustes puntuales en hooks usados por `/dashboard`:
- `src/hooks/useTasks.tsx`
- `src/hooks/useUserSettings.tsx`
- `src/hooks/useUserProfile.tsx`
- `src/hooks/useCalendar.tsx`

Cambios:
- cuando `user` desaparezca temporalmente, cerrar `loading` correctamente
- no dejar estados “true para siempre” por un `if (!user) return`
- resetear datos de forma controlada si no hay sesión
- rehidratar automáticamente cuando vuelva la sesión

Ejemplo del problema actual:
- `useTasks.fetchTasks()` hace `if (!user) return;` pero `loading` puede quedarse activo según el ciclo de montaje
- varios hooks del dashboard dependen de auth y pueden dejar esqueletos eternos si auth rebota

### 6) Mantener el comportamiento manual de logout intacto
No voy a tocar el logout intencional del usuario:
- `purgeLocalAuthArtifacts`
- `signOut()` manual con redirect a `/login`

Eso sí está bien cuando el usuario pulsa salir.

## Archivos a editar

- `src/hooks/useAuth.tsx`
- `src/lib/runtimeFreshness.ts`
- `src/integrations/supabase/client.ts`
- `src/components/ProtectedRoute.tsx`
- `src/hooks/useTasks.tsx`
- `src/hooks/useUserSettings.tsx`
- `src/hooks/useUserProfile.tsx`
- `src/hooks/useCalendar.tsx`

## Resultado esperado

Después del cambio:

- bloqueas el móvil o dejas la pestaña en segundo plano unos minutos y vuelves sin que te expulse
- el dashboard ya no se queda en skeleton infinito
- no hará falta refrescar ni cerrar sesión manualmente
- solo se irá a login cuando la sesión haya expirado de verdad o el usuario cierre sesión
- los despliegues nuevos seguirán refrescando, pero sin romper la persistencia normal

## Verificación que haré al implementarlo

1. Entrar logueado en `/dashboard`.
2. Dejar la pestaña en background varios minutos y volver.
3. Confirmar que:
   - no hay redirect a `/login`
   - el sidebar y el contenido cargan
   - `tasks`, `calendar`, `profile` y `settings` salen del estado loading
4. Simular recuperación tras reconexión de red.
5. Validar logout manual para asegurar que sigue funcionando.

## Detalle técnico

La corrección central será cambiar este patrón destructivo:

```ts
const { data, error } = await supabase.auth.getSession();
if (error) {
  await supabase.auth.signOut();
}
```

por una hidratación tolerante a fallos, con listener primero y reconciliación no destructiva:

```ts
const { data: authSub } = supabase.auth.onAuthStateChange(handleAuthEvent);
const sessionResult = await getSessionWithRetry();

if (sessionResult.session) {
  setSession(sessionResult.session);
  setUser(sessionResult.session.user);
} else {
  setSession(null);
  setUser(null);
}
setLoading(false);
```

Y en `runtimeFreshness`, dejar de hacer esto al volver de background:

```ts
nukeSwAndCaches();
navigateToFreshUrl();
```

para pasar a una política no destructiva y con umbral realista.
