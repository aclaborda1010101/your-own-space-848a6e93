

## Plan: Logo con URL firmada en vez de base64

### Problema real
Los logs muestran que el logo **sí se descarga** correctamente (142,206 bytes). Pero 142KB de PNG convertido a 190KB de base64 embebido como data URI puede ser problemático para html2pdf.app — el renderizador puede no soportar data URIs tan grandes o distorsionar la imagen.

### Solución: usar URL firmada de Supabase Storage

En vez de embeber el logo como `data:image/png;base64,...`, generar una **signed URL** del archivo en Storage y pasarla directamente como `<img src="https://...signedUrl...">`. html2pdf.app renderiza el HTML en un navegador real, así que puede descargar imágenes desde URLs externas sin problema.

```text
Flujo actual (falla):
  Storage → download → bytes → base64 → data URI en HTML → html2pdf.app

Flujo nuevo (fiable):
  Storage → createSignedUrl(1h) → URL pública temporal → <img src="URL"> → html2pdf.app
```

### Cambios en `supabase/functions/generate-document/index.ts`

1. **Reemplazar el bloque de fetch del logo** (líneas 1198-1219): en vez de `download()` + base64, usar `createSignedUrl("brand/manias-logo.png", 3600)` y pasar la URL como string.

2. **Cambiar `buildCoverHtml`** (línea 982): el parámetro `logoBase64` pasa a ser `logoUrl: string | undefined`. El `<img>` usa `src="${logoUrl}"` directamente.

3. **Cambiar `buildFullHtml`** (línea 1031): mismo cambio de tipo del parámetro.

4. **CSS sin cambios** — `height: 84px; width: auto; display: block; margin: 0 auto;` ya está correcto.

### Archivo
- `supabase/functions/generate-document/index.ts` — cambiar de base64 a signed URL
- Redeploy

