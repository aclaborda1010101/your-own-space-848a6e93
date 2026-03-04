

## Plan: Logo PNG real + margen izquierdo en cuestionario

### 1. Logo — Usar la imagen PNG real

El SVG de texto actual no replica el logo real (la tipografia, pesos y proporciones son diferentes). La solución definitiva es **convertir el PNG subido a base64 y embederlo directamente como data URI**, pero con un tamaño pequeño optimizado para el PDF.

El problema anterior con base64 era que la imagen original era muy grande (142KB). La solución:
- Copiar el PNG subido (`MANIAS_LOGO_PNG-2.png`) al proyecto
- En la Edge Function, embeber el logo como **base64 hardcodeado** directamente en el código (el PNG del logo a tamaño razonable no debería exceder unos KB)
- Usar `<img src="data:image/png;base64,..." />` en el cover HTML

Alternativa más robusta: dado que html2pdf.app no cargaba URLs externas ni base64 grandes, la opción es **reducir el PNG** y hardcodear el base64 en el código. Para esto necesito que me confirmes: **puedes subir una versión del logo de ~200-300px de ancho?** Eso sería <10KB en base64 y funcionaría sin problemas.

Si prefieres, puedo usar el PNG que acabas de subir, leerlo, y hardcodear su base64 directamente en el código de la función.

### 2. Cuestionario — Margen izquierdo en contenido de preguntas

El `.content-body` actual solo tiene `padding: 0 5px`. Las preguntas del cuestionario quedan pegadas al mismo nivel que los títulos.

**Fix**: Aumentar el padding izquierdo del contenido dentro de `.content-body`:

```css
.content-body {
  padding: 0 5px 0 15px;
}
```

Y añadir reglas para que los elementos de lista y párrafos dentro del contenido tengan indent:

```css
.content-body ul, .content-body ol {
  padding-left: 20px;
}
.content-body p {
  margin-left: 5px;
}
```

### Archivos
- `supabase/functions/generate-document/index.ts` — base64 del logo + CSS del margen
- Redeploy de la función

