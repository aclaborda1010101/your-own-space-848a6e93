

# Arreglar WHOOP 404 y separar noticias/videos en la seccion de IA

## Problema 1: WHOOP devuelve 404

La URL de OAuth de WHOOP esta mal. La API usa `https://api.prod.whoop.com/oauth/oauth2/authorize` pero la documentacion oficial de WHOOP indica que la URL de autorizacion correcta es:

- Authorize: `https://api.prod.whoop.com/oauth/oauth2/auth`
- Token: `https://api.prod.whoop.com/oauth/oauth2/token`

El endpoint `/authorize` no existe, por eso devuelve 404. Hay que cambiarlo a `/auth`.

### Cambio en `supabase/functions/whoop-auth/index.ts`

Linea 11: cambiar la URL base y ajustar el endpoint de authorize:

```
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2";
```

Y en linea 47, la URL generada es `${WHOOP_AUTH_URL}/authorize` -> cambiar a `${WHOOP_AUTH_URL}/auth`:

```typescript
const authUrl = `${WHOOP_AUTH_URL}/auth?client_id=${WHOOP_CLIENT_ID}&redirect_uri=...`
```

## Problema 2: La pestaña "Hoy" muestra videos mezclados con noticias

En `src/pages/AINews.tsx`, la tab "today" (lineas 302-334) muestra primero los videos del dia y luego las noticias. Solo deberia mostrar noticias en "Hoy" y los videos solo en la pestaña "Videos".

### Cambio en `src/pages/AINews.tsx`

Eliminar las secciones de `todayVideos` y `yesterdayVideos` del TabsContent de "today". La tab "Hoy" solo mostrara noticias (ya filtradas con `!item.is_video`). Los videos ya estan correctamente en la tab "Videos" con `allVideos`.

Cambio concreto en lineas 302-334: eliminar los bloques de `todayVideos` y `yesterdayVideos`, dejando solo `todayNews` y `yesterdayNews`.

La condicion de "no hay noticias" (linea 305) tambien debe ajustarse para solo comprobar `todayNews.length === 0` sin considerar videos.

## Seccion tecnica

### Archivo: `supabase/functions/whoop-auth/index.ts`

- Linea 47: cambiar `${WHOOP_AUTH_URL}/authorize` por `${WHOOP_AUTH_URL}/auth`
- Redesplegar la edge function

### Archivo: `src/pages/AINews.tsx`

- Lineas 305-306: cambiar condicion a solo `todayNews.length === 0`
- Lineas 309-314: eliminar bloque completo de "Videos de hoy"
- Lineas 321-326: eliminar bloque completo de "Videos de ayer"

### Archivos modificados

- `supabase/functions/whoop-auth/index.ts` - Fix URL OAuth
- `src/pages/AINews.tsx` - Separar videos de la tab "Hoy"

