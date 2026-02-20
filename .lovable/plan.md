

# Limpiar contactos invalidos y prevenir futuras importaciones basura

## Problema identificado

La base de datos tiene **183 contactos sin letras** en el nombre:
- **178 numeros de telefono** usados como nombre (ej: "+1 (210) 421-3954", "+34 601 01 81 81")
- **5 emojis/simbolos** como nombre (ej: "🍉", "🎭", "💙")

**Origen**: La importacion VCF (onboarding) toma el campo `fullName` del vCard sin validar. Cuando un contacto no tiene nombre guardado en el telefono, el VCF exporta el numero de telefono como nombre. Tambien exporta contactos con emojis o simbolos como nombre.

## Solucion en 2 partes

### Parte 1: Limpiar datos existentes (SQL)

Eliminar de `people_contacts` todos los registros cuyo nombre no contenga al menos una letra real. Esto borra los 183 contactos basura de golpe.

### Parte 2: Validacion en codigo (2 archivos)

**Archivo 1: `src/hooks/useOnboarding.tsx`** (importacion VCF)

Antes de insertar un contacto nuevo (linea ~170), validar que `fullName`:
- Contenga al menos una letra (a-z, acentos, etc.)
- No sea solo un numero de telefono
- Tenga al menos 2 caracteres utiles

Contactos que no pasen la validacion se saltan silenciosamente.

**Archivo 2: `src/pages/DataImport.tsx`** (funcion `findOrCreateContact`)

Agregar la misma validacion en `findOrCreateContact` (linea ~237) antes de hacer el INSERT. Si el nombre no es valido, lanzar un skip en vez de crear el contacto.

### Funcion de validacion compartida

Crear una funcion reutilizable:

```text
function isValidContactName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Debe contener al menos una letra (cualquier alfabeto)
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùüäëïöüç]/i.test(trimmed)) return false;
  // No puede ser solo un numero de telefono con formato
  if (/^\+?[\d\s\(\)\-\.]+$/.test(trimmed)) return false;
  return true;
}
```

## Resultado esperado

- Se eliminan ~183 contactos basura existentes
- Futuras importaciones VCF y WhatsApp ignoran entradas sin nombre real
- Los contactos validos no se ven afectados

## Detalles tecnicos

| Accion | Ubicacion |
|--------|-----------|
| SQL: DELETE contactos invalidos | Migracion |
| Validacion VCF | `src/hooks/useOnboarding.tsx` linea ~170 |
| Validacion findOrCreateContact | `src/pages/DataImport.tsx` linea ~237 |
| Funcion isValidContactName | Inline en ambos archivos o en `src/lib/utils.ts` |

