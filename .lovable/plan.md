

## Plan: Logo desde Storage + centrado 84px + footer con márgenes

### Problema raíz
La Edge Function hace `fetch("https://pure-logic-flow.lovable.app/manias-logo.png")` — descarga el PNG del public folder de la app, que es una copia vieja/incorrecta. En Storage solo hay un SVG de 401 bytes (`brand/manias-logo.svg`) y un PNG antiguo en `assets/manias-logo.png`.

### Solución

#### 1. Subir el logo correcto a Storage
Subir el PNG que el usuario ha proporcionado (MANIAS_LOGO_PNG, fondo negro, 1500x400px) a `project-documents/brand/manias-logo.png` reemplazando el SVG actual. Esto se hará copiando el archivo desde `public/manias-logo.png` (que ya contiene la última subida del usuario) usando la Edge Function al arrancar, o mejor: **cambiar el código para descargar desde Storage usando el admin client**.

#### 2. Cambiar fetch del logo: usar Supabase Storage admin
En vez de `fetch(url_pública)`, usar el Supabase admin client que ya existe en la función:

```typescript
const supabase = getSupabaseAdmin();
const { data: logoData, error: logoError } = await supabase.storage
  .from("project-documents")
  .download("brand/manias-logo.png");

if (logoData) {
  const logoBytes = new Uint8Array(await logoData.arrayBuffer());
  let binary = "";
  for (let b = 0; b < logoBytes.length; b++) {
    binary += String.fromCharCode(logoBytes[b]);
  }
  logoBase64 = btoa(binary);
}
```

Esto es **100% fiable** — no depende de URLs externas, CORS, ni cachés. Descarga directa desde el bucket con service role key.

#### 3. CSS del logo: 84px centrado
```css
.cover-header {
  padding: 60px 40px 30px;
  text-align: center;
}
.cover-header img {
  height: 84px;
  width: auto;
  display: block;
  margin: 0 auto;
}
```

#### 4. Footer con márgenes (ya aplicado pero verificar)
Confirmar que el `footerTemplate` usa `width:calc(100% - 40mm);margin:0 18mm 0 22mm;` correctamente.

#### 5. Subir logo al bucket
Necesito subir el PNG del usuario al path `brand/manias-logo.png` en el bucket `project-documents`. Lo haré copiando desde `public/manias-logo.png` dentro de la propia Edge Function en el primer deploy, o usando un script de migración.

### Archivos
- `supabase/functions/generate-document/index.ts` — cambiar fetch logo a Storage admin download + CSS 84px
- Subir `public/manias-logo.png` a Storage bucket `project-documents/brand/manias-logo.png`
- Redeploy

