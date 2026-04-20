

## Diagnóstico

Acabo de mirar la BD: tienes **1.341 contactos**, de los cuales:
- 536 tienen `wa_id` (los que sí funcionan).
- 804 **no tienen ni `wa_id` ni `phone_numbers`** — están vacíos de teléfono en la base de datos.
- 1 sin nada.

O sea: el backfill desde la propia BD que planteamos **no puede arreglar nada**, porque la mayoría de tus contactos antiguos perdieron el teléfono al importarse en su día (o se importaron solo con nombre). Por eso WhatsApp no los encuentra y crea duplicados.

**La importación de tu CSV de Contactos de Mac (1.813 filas) es exactamente lo que necesitamos.** Tiene `Teléfono móvil`, `Teléfono de la casa`, `Teléfono del trabajo`, etc.

## Plan

### 1. Importador de CSV de Contactos de Mac que enriquece, no duplica
Crear un flujo de importación específico para este formato (o adaptar el VCF actual) que para cada fila del CSV:
- Normalice los teléfonos a dígitos (quitar `+`, espacios, paréntesis).
- Busque contacto existente por **nombre exacto** O por cualquier teléfono normalizado.
- Si existe → **actualiza** `wa_id` (primer móvil válido) y `phone_numbers` (todos los teléfonos), sin tocar el resto de campos.
- Si no existe → crea contacto nuevo con todos los datos.
- Cuenta: enriquecidos / creados / saltados.

### 2. Resolución de colisiones de `wa_id`
Si al rellenar `wa_id` en un contacto choca con otro que ya lo tiene (típicamente un duplicado fantasma creado por el webhook tipo "Dani" suelto):
- Mover los mensajes del fantasma → contacto real del CSV.
- Borrar el fantasma.
- Limpiar `contact_headlines` de ambos.

### 3. Backfill final + recálculo
- Recalcular `last_contact` de todos los contactos tocados.
- Borrar `contact_headlines` de los enriquecidos para que se regeneren con datos limpios.

### 4. UI
Botón **"Importar contactos de Mac (CSV)"** en Ajustes / Onboarding que:
- Acepta este CSV.
- Muestra preview (cuántos enriquecerá, cuántos creará, cuántas colisiones).
- Confirmación → ejecuta.
- Reporte final con contadores.

## Archivos a tocar

- `src/lib/contacts-csv-mac.ts` (nuevo) — parser del formato de Contactos de Mac.
- `src/components/contacts/ImportMacContactsDialog.tsx` (nuevo) — UI con preview y confirmación.
- Punto de entrada en Ajustes o en `Onboarding.tsx` para llamar al diálogo.
- Edge function nueva (o ampliar `import-whatsapp-backup`) si el volumen lo requiere para procesar en background.
- Migración SQL pequeña post-import para limpiar `contact_headlines` de los IDs tocados.

## Resultado esperado

- Los ~800 contactos sin teléfono pasan a tener `wa_id` y `phone_numbers` correctos.
- Los duplicados fantasma creados por el webhook se fusionan con su contacto real del CSV.
- A partir de ahí, cualquier WhatsApp entrante encuentra contacto por teléfono y deja de crear duplicados.
- Las sugerencias de IA dejan de mezclar conversaciones.

**Nota:** sí, importa el CSV. Es el camino más limpio y rápido. ¿Tiro?

