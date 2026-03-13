

# Plan: Resolver cacheo agresivo del Service Worker (PWA)

## Diagnóstico

El problema es el **Service Worker generado por VitePWA con Workbox**. Así funciona el ciclo problemático:

1. VitePWA genera un SW que **precachea** `index.html` + todos los JS/CSS con un hash de revisión fijo
2. Cuando Lovable deploya una nueva versión, el SW viejo **sigue interceptando** las peticiones y sirve el `index.html` antiguo, que carga los JS antiguos
3. `runtimeFreshness.ts` intenta limpiar, pero en preview **explícitamente no recarga** (línea 46: `return false`)
4. El `autoUpdate` de Workbox eventualmente detecta el nuevo SW, pero **la página ya está renderizada** con la versión vieja
5. Solo un refresh manual fuerza la carga del SW nuevo

## Solución (3 cambios)

### 1. `vite.config.ts` — Cambiar estrategia de navegación

Reemplazar la estrategia de precache para `index.html` por `NetworkFirst`: así siempre intenta cargar el HTML fresco de la red primero, y solo usa cache como fallback offline.

```typescript
workbox: {
  maximumFileSizeToCacheInBytes: 10000000,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigateFallback: undefined,  // ← No precache index.html para navegación
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: { cacheName: 'html-cache', expiration: { maxEntries: 1 } }
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } }
    }
  ]
}
```

### 2. `src/lib/runtimeFreshness.ts` — Permitir reload también en preview

Eliminar el early return de preview. Si se detecta un build diferente, limpiar caches y recargar (una sola vez, con la misma protección anti-loop que ya existe).

### 3. `index.html` — Desregistrar SW antes del módulo en preview

Añadir un script inline que, en hosts de preview, desregistre SWs inmediatamente al cargar. Esto asegura que en la siguiente navegación no se sirva contenido cacheado.

## Ficheros a modificar

| Fichero | Cambio |
|---|---|
| `vite.config.ts` | Workbox: `NetworkFirst` para navegación, eliminar precache de index.html |
| `src/lib/runtimeFreshness.ts` | Eliminar early return en preview, permitir reload controlado |
| `index.html` | Script inline: desregistrar SWs en hosts preview |

## Impacto

- **Preview**: Siempre cargará la versión más reciente del HTML
- **Live/PWA**: Seguirá funcionando offline (assets JS/CSS precacheados), pero el HTML se obtendrá de red primero
- **Sin loops**: Se mantienen todas las protecciones anti-loop existentes (sessionStorage flags, cooldown de 30s)

