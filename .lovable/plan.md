

## Plan: Cambiar color primario de #0D9488 a #0A3039

Cambio directo en `supabase/functions/generate-document/index.ts`:

1. **Línea 12**: Cambiar `primary: "0D9488"` → `primary: "0A3039"`
2. **Línea 296**: Cambiar el array de tints de las barras de fases del executive summary para usar tonos coherentes con `#0A3039` en lugar de `#0D9488`

El color `primaryDark` (línea 13) ya es `"0A3039"`, así que se unificará — ambos apuntarán al mismo valor. Todos los usos de `BRAND.primary` en portada, headings H1, bordes, header/footer, tablas y KPIs cambiarán automáticamente.

