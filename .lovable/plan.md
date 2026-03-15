

## Problema

Dos problemas relacionados con el Service Worker (PWA):

1. **App publicada se queda en "Cargando JARVIS..."**: El Service Worker de Workbox cachea los archivos JS del build anterior. Cuando se publica una nueva version, el SW viejo sirve chunks obsoletos que ya no existen, causando errores de carga silenciosos. El `runtimeFreshness` hace reload pero el SW sigue sirviendo los archivos viejos del cache.

2. **Pantalla de "precarga" en cada actualizacion**: El SW con `registerType: "autoUpdate"` y `skipWaiting: true` activa el nuevo SW inmediatamente, pero los assets cacheados del build anterior persisten hasta que se limpien.

## Causa raiz

El PWA con Workbox esta precacheando todos los assets estaticos (JS chunks, CSS, etc.). En el entorno de Lovable, donde cada deploy genera nuevos hashes de archivos, esto causa conflictos constantes entre el cache del SW y los archivos reales del servidor.

## Plan de correccion

### 1. Desactivar el Service Worker en dominios de Lovable (`src/main.tsx`)

Ampliar la condicion de no-registro del SW para incluir tambien `lovable.app` (dominio publicado de Lovable), no solo preview. El PWA solo tiene sentido en un dominio custom o en Railway.

```typescript
const isLovableHost = window.location.hostname.includes('lovable.app') 
  || window.location.hostname.includes('lovableproject.com');

if (!(window as any).__jarvis_is_preview && !isLovableHost) {
  // register SW only on custom domains
}
```

### 2. Agregar limpieza de SW en el index.html para lovable.app

En el script inline del `<head>`, ampliar la deteccion para incluir `lovable.app` (no solo preview) y desregistrar SWs existentes + limpiar caches.

### 3. Simplificar runtimeFreshness para lovable.app

Tratar `lovable.app` como un entorno donde se debe hacer nuke de SW/caches al detectar un build nuevo, sin necesidad de reload loop.

### Archivos a modificar
- `src/main.tsx` -- no registrar SW en `lovable.app`
- `index.html` -- ampliar limpieza anti-SW a `lovable.app`
- `src/lib/runtimeFreshness.ts` -- agregar nuke de SW para `lovable.app` en deteccion de build change

