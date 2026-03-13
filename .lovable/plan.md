

## Diagnóstico

El problema tiene **dos causas raíz**:

1. **`__APP_BUILD_ID__` siempre es `"dev-preview"`** en el entorno de build de Lovable (no hay `COMMIT_SHA`, `RAILWAY_GIT_COMMIT_SHA` ni `GITHUB_SHA`). Esto significa que `ensureRuntimeFreshness()` compara `"dev-preview" === "dev-preview"` → **nunca detecta un cambio de build** → nunca limpia caché ni recarga.

2. **El Service Worker de la PWA sigue activo** y precachea los assets JS/CSS antiguos. Aunque `index.html` tiene un script que desregistra SWs en hosts de preview, el SW puede activarse y servir contenido cacheado antes de que ese script ejecute.

## Plan de corrección

### 1. `vite.config.ts` — Usar timestamp como fallback para BUILD_ID

Cambiar el fallback de `"dev-preview"` a `Date.now().toString()` para que cada build genere un ID diferente, activando la detección de cambio de build:

```ts
__APP_BUILD_ID__: JSON.stringify(
  process.env.COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || 
  process.env.GITHUB_SHA || Date.now().toString()
),
```

### 2. `src/lib/runtimeFreshness.ts` — Hacer cleanup en preview sin reload

Actualmente en preview el código detecta el cambio pero hace un `reload()` que puede causar loops. Cambiar para que en preview solo haga `backgroundClean()` (limpiar SWs y caches) sin recargar la página:

```ts
if (isPreviewHost()) {
  backgroundClean();
  return false;
}
// Solo recargar en published
cleanWithTimeout().finally(() => window.location.reload());
return true;
```

### 3. `index.html` — Ampliar el check de hosts para incluir `lovable.app`

El script inline solo busca `lovableproject.com` pero la preview usa `lovable.app`. Añadir `lovable.app`:

```js
if(h==='localhost'||h.includes('lovableproject.com')||h.includes('lovable.app')||h.startsWith('preview--')||h.startsWith('id-preview--')){
```

### Ficheros a modificar

| Fichero | Cambio |
|---|---|
| `vite.config.ts` | Fallback BUILD_ID → `Date.now()` |
| `src/lib/runtimeFreshness.ts` | Preview: solo cleanup sin reload |
| `index.html` | Añadir `lovable.app` al check de hosts |

