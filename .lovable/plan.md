

## Plan: Fix 3 bugs + continue P1

### Bug 1: Title Case con acentos (línea 95-97)

El regex `\b\w+` no reconoce caracteres acentuados porque `\w` solo matchea ASCII. "IMPLEMENTACIÓN" se parte en "IMPLEMENTACI" + "N" (la Ó rompe el word boundary).

**Fix**: Reescribir `toTitleCase` para hacer `.toLowerCase()` primero y luego capitalizar la primera letra de cada palabra usando un regex Unicode-aware:

```typescript
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}
```

Esto convierte "IMPLEMENTACIÓN" → "implementación" → "Implementación".

### Bug 2: Sub-índices H2 duplicados (líneas 433-442)

El regex `^\d+[\.\)]\s*` solo detecta prefijos simples como "5." pero NO detecta compuestos como "5.1 " o "5.2 ". Entonces "## 5.1 Módulos" no se detecta como ya numerado, y el código le añade `${h1Counter}.${h2Counter}` delante → "5.1 1 Módulos".

**Fix**: Cambiar el regex de H2 a `^\d+\.\d+[\.\)]*\s*` para detectar prefijos compuestos tipo "5.1", "5.2 ", etc. Si ya tiene número compuesto, stripear y usar solo el nuestro.

En línea 436: `const hasNumber = /^\d+[\.\)]\s*/.test(title);`
→ `const hasNumber = /^\d+(\.\d+)*[\.\)]*\s/.test(title);`

Y el replace correspondiente en línea 437.

### Bug 3: Tablas reales

El código YA genera `Table()` reales con `TableRow` y `TableCell`. El problema que ve el usuario es probablemente el visor (pandoc/preview), no Word. No hay cambio de código necesario aquí — las tablas son objetos docx nativos. Se confirma en la implementación.

### Archivo a modificar

`supabase/functions/generate-document/index.ts` — líneas 95-97 (toTitleCase) y líneas 436-437 (H2 regex en TOC).

