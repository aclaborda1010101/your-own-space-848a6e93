

## Plan: Logo como HTML/CSS puro — sin imágenes

### Problema
Llevan demasiadas iteraciones intentando cargar un PNG (base64, signed URLs, Storage). Ninguna funciona fiablemente con html2pdf.app. La solución definitiva es **eliminar toda dependencia de imágenes** y renderizar el logo como HTML+CSS puro.

### Cambios en `supabase/functions/generate-document/index.ts`

#### 1. Añadir CSS del logo (en el bloque `CSS`, después de `.cover-header img`)
```css
.logo-text {
  font-family: 'Raleway', 'Arial Black', sans-serif;
  font-size: 36pt;
  font-weight: 800;
  text-align: center;
  padding: 50px 0 30px;
}
.logo-text .man { color: #FFFFFF; font-style: italic; }
.logo-text .ias { color: #BFFF00; font-weight: 900; }
.logo-text .lab { color: #FFFFFF; }
.logo-text .dot { color: #BFFF00; }
```

#### 2. Reemplazar `buildCoverHtml` (línea 982)
- Eliminar parámetro `logoUrl`
- Reemplazar `<img>` y SVG fallback por:
```html
<div class="logo-text">
  <span class="man">Man</span><span class="ias">IAS</span>
  <span class="lab"> Lab</span><span class="dot">.</span>
</div>
```

#### 3. Simplificar `buildFullHtml` (línea 1031)
- Eliminar parámetro `logoUrl`
- Eliminar paso de `logoUrl` a `buildCoverHtml`

#### 4. Eliminar bloque de signed URL (líneas 1198-1213)
- Borrar toda la lógica de `createSignedUrl` y la variable `logoUrl`
- Eliminar paso de `logoUrl` en la llamada a `buildFullHtml` (línea 1224)

#### 5. Redeploy de la Edge Function

### Resultado
- CERO imágenes, CERO storage, CERO base64, CERO signed URLs
- HTML puro que siempre renderiza correctamente en cualquier motor PDF
- Tipografía Raleway ya importada en el CSS existente

