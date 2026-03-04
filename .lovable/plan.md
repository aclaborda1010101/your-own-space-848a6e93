

## Plan: Quitar cursiva del "Man" en el logo

El logo aparece correctamente pero "Man" no debe estar en cursiva.

### Cambio

En `supabase/functions/generate-document/index.ts`, en el CSS del logo, cambiar:

```css
.logo-text .man { color: #FFFFFF; font-style: italic; }
```

a:

```css
.logo-text .man { color: #FFFFFF; }
```

Eliminar `font-style: italic;` y redeploy de la Edge Function.

